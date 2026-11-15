// Part 1 · Simulation engine (digital twin)
// 6 astronauts × 36 metrics, one per tick. This is the only file that changes when real sensors are connected.
//
// How it works:
//  1. Personal baseline: built once per astronaut at start with seeded randomness
//     (parameters.ts NORMALS + personal offset + CREW_TRAITS shifts). Same seed = same crew.
//  2. Target: baseline + active scenario effects (scenarios/*.json) + autonomous actions.
//  3. Natural movement: each tick the value eases towards the target: x += 0.25 × (target − x).
//     The reading sent to the screen = x + gaussian × sd × 0.3 (sensor noise; does not accumulate, produces no false alarms).
//  4. Daily metrics (sleep, PVT, BSI-18, PANAS ...) do not change every tick; they have no noise and
//     only move to a new value when a scenario changes their target.
//  5. Recovery: a value changes fast (0.25) while moving AWAY from its personal baseline, slowly while RETURNING
//     (live 0.025, daily 0.01, during mandatory crew rest 0.12). After a crisis a trace remains for a while and the health score
//     recovers gradually. Environmental metrics (env.*) are physical, so they return fast.
//  6. Total dose accumulates: doseCumulative_mSv += doseRate_uSv_h × (mission min / 60) / 1000.
import { CREW } from '../crew';
import { METRICS, type MetricKey } from '../metrics';
import type { AutoAction, CrewId, CrewMember, ScenarioId, ShipState, Simulation, Telemetry } from '../types';
import { CREW_TRAITS, initialCumulativeDose, NORMALS, PARAMS, SIM } from './parameters';
import { gaussian, mulberry32 } from './random';
import { appliesTo, effectDelta, effectFraction, SCENARIOS } from './scenario';

type Values = Record<MetricKey, number>;

interface CrewState {
  member: CrewMember;
  baseline: Values; // personal baseline (fixed)
  x: Values; // noise-free "true" state, eases towards the target
  doseCumulative_mSv: number;
  sheltered: boolean; // RADIATION_SHELTER applied
  resting: boolean; // MANDATORY_REST applied
}

const DAILY = new Set<MetricKey>(METRICS.filter((m) => m.cadence === 'daily').map((m) => m.key));
const KEYS = METRICS.map((m) => m.key);
// Metrics that return to baseline when crew rest is applied (plan: heart rate, breathing, lactate, core temperature)
const REST_KEYS: MetricKey[] = ['cardio.hr_bpm', 'resp.rr_bpm', 'resp.minuteVent_L_min', 'biochem.sweatLactate_mM', 'resp.coreTemp_C'];
const VENT_TARGET_mmHg = 2.0; // target ppCO₂ once ventilation is increased (plan, step 7)
const VENT_TICKS = 40; // over how many readings it falls to this target

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** How fast the value approaches the target this tick: fast while worsening, slow while recovering. */
function rateFor(c: CrewState, key: MetricKey, target: number, daily: boolean): number {
  if (key.startsWith('env.')) return SIM.approachRate; // physical environment: fast
  const base = c.baseline[key];
  const recovering = Math.abs(target - base) < Math.abs(c.x[key] - base);
  if (!recovering) return SIM.approachRate;
  if (c.resting && REST_KEYS.includes(key)) return PARAMS.recoveryRateRest.value;
  return daily ? PARAMS.recoveryRateDaily.value : PARAMS.recoveryRateLive.value;
}

/** An astronaut's personal baseline: location baseline + personal offset + sensitivity shift. */
export function makeBaseline(member: CrewMember, rand: () => number): Values {
  const eva = member.location === 'GEZEGEN';
  const offsets = CREW_TRAITS[member.id].offsets;
  const out = {} as Values;
  for (const key of KEYS) {
    const n = NORMALS[key];
    const r = gaussian(rand); // one number is drawn per metric (also for shifted metrics, so the order stays fixed)
    // No random offset for a metric defined by a personal sensitivity: the trait is always visible in the demo
    const v = (eva ? n.eva : n.rest) + (key in offsets ? offsets[key]! : r * n.personSd);
    out[key] = clamp(v, n.min, n.max);
  }
  return out;
}

export function createSimulation(seed = 2026): Simulation {
  let rand = mulberry32(seed);
  let tick = 0; // total ticks
  let scenario: ScenarioId = 'NORMAL';
  let scenarioStart = 0; // tick at which the scenario started
  let ventilationStart: Record<'KOKPIT' | 'GEZEGEN', number | null> = { KOKPIT: null, GEZEGEN: null };
  let crew: CrewState[] = [];

  function build() {
    rand = mulberry32(seed);
    tick = 0;
    scenario = 'NORMAL';
    scenarioStart = 0;
    ventilationStart = { KOKPIT: null, GEZEGEN: null };
    // Fixed order: CREW order × METRICS order → the same seed always produces the same baselines
    crew = CREW.map((member) => {
      const baseline = makeBaseline(member, rand);
      return { member, baseline, x: { ...baseline }, doseCumulative_mSv: initialCumulativeDose(member.location), sheltered: false, resting: false };
    });
  }
  build();

  /** How far cabin CO₂ has risen from nominal to the failure peak: 0 → 1. */
  function co2Excess(c: CrewState): number {
    const base = c.baseline['env.ppCO2_mmHg'];
    const span = PARAMS.cabinCO2FailurePeak.value - base;
    return clamp((c.x['env.ppCO2_mmHg'] - base) / span, 0, 1);
  }

  /** Target for this tick: baseline + scenario effects + autonomous actions. */
  function targetFor(c: CrewState, key: MetricKey, elapsed: number): number {
    const base = c.baseline[key];
    if (c.resting && REST_KEYS.includes(key)) return base;
    const def = SCENARIOS[scenario];
    const traits = CREW_TRAITS[c.member.id];
    let target = base;
    let doseEffectActive = false;
    if (def) {
      for (const e of def.effects) {
        if (e.metric !== key || !appliesTo(e, c.member.id, c.member.location)) continue;
        let f = effectFraction(e, elapsed);
        if (e.followsCO2) f *= co2Excess(c);
        if (f <= 0) continue;
        target += effectDelta(e, base, traits) * f;
        if (key === 'env.doseRate_uSv_h') doseEffectActive = true;
      }
    }
    if (key === 'env.doseRate_uSv_h') {
      if (c.sheltered && !doseEffectActive) c.sheltered = false; // event over, crew left the shelter
      if (c.sheltered) target *= PARAMS.shelterDoseFactor.value;
    }
    if (key === 'env.ppCO2_mmHg') {
      const vs = ventilationStart[c.member.location];
      if (vs !== null && target > VENT_TARGET_mmHg) {
        const f = Math.min(1, (tick - vs) / VENT_TICKS);
        target = target + (VENT_TARGET_mmHg - target) * f;
      }
    }
    const n = NORMALS[key];
    return clamp(target, n.min, n.max);
  }

  function activeEvents(elapsed: number): string[] {
    const def = SCENARIOS[scenario];
    if (!def) return [];
    return def.events.filter((e) => e.atTick <= elapsed && (e.untilTick === undefined || elapsed < e.untilTick)).map((e) => e.text);
  }

  return {
    tick() {
      const t = Date.now();
      const elapsed = tick - scenarioStart;
      const telemetry: Telemetry[] = crew.map((c) => {
        const out = {} as Values;
        for (const key of KEYS) {
          const n = NORMALS[key];
          if (key === 'env.doseCumulative_mSv') continue;
          const target = targetFor(c, key, elapsed);
          const rate = rateFor(c, key, target, DAILY.has(key));
          if (DAILY.has(key)) {
            // Daily metric: no noise, eases to the new target
            c.x[key] += rate * (target - c.x[key]);
            out[key] = c.x[key];
          } else {
            c.x[key] += rate * (target - c.x[key]);
            out[key] = c.x[key] + gaussian(rand) * n.sd * SIM.noiseScale;
          }
          out[key] = clamp(out[key], n.min, n.max);
          if (n.integer) out[key] = Math.round(out[key]);
        }
        c.doseCumulative_mSv += (out['env.doseRate_uSv_h'] * (SIM.missionMinutesPerTick / 60)) / 1000;
        out['env.doseCumulative_mSv'] = c.doseCumulative_mSv;
        return toTelemetry(c.member.id, t, out);
      });
      const ship: ShipState = {
        t,
        missionDay: SIM.missionDay,
        scenario,
        commDelayOneWay_s: PARAMS.commDelayDemo.value,
        activeEvents: activeEvents(elapsed),
      };
      tick++;
      return { ship, telemetry };
    },

    setScenario(id) {
      scenario = id;
      scenarioStart = tick;
      const def = SCENARIOS[id];
      // The scenario's own seed: the same scenario plays with the same noise in every demo
      rand = mulberry32((seed ^ (def?.seed ?? 0)) >>> 0);
      ventilationStart = { KOKPIT: null, GEZEGEN: null };
      for (const c of crew) {
        c.sheltered = false;
        c.resting = false;
      }
    },

    onAutoAction(action: AutoAction) {
      const targets = crew.filter((c) => action.crewIds.includes(c.member.id));
      if (action.type === 'RADIATION_SHELTER') for (const c of targets) c.sheltered = true;
      if (action.type === 'MANDATORY_REST') for (const c of targets) c.resting = true;
      if (action.type === 'INCREASE_VENTILATION') {
        // Everyone sharing the same cabin is affected
        for (const c of targets) if (ventilationStart[c.member.location] === null) ventilationStart[c.member.location] = tick;
      }
    },

    reset() {
      build();
    },
  };
}

function toTelemetry(crewId: CrewId, t: number, v: Values): Telemetry {
  const ectopic = v['cardio.ecg_ectopic_per_min'];
  return {
    crewId,
    t,
    missionDay: SIM.missionDay,
    cardio: {
      hr_bpm: v['cardio.hr_bpm'],
      hrv_rmssd_ms: v['cardio.hrv_rmssd_ms'],
      ecg_rhythm: ectopic >= PARAMS.ecgIrregularThreshold.value ? 'irregular' : 'sinus',
      ecg_ectopic_per_min: ectopic,
      bp_sys_mmHg: v['cardio.bp_sys_mmHg'],
      bp_dia_mmHg: v['cardio.bp_dia_mmHg'],
      spo2_pct: v['cardio.spo2_pct'],
    },
    resp: {
      rr_bpm: v['resp.rr_bpm'],
      minuteVent_L_min: v['resp.minuteVent_L_min'],
      etco2_mmHg: v['resp.etco2_mmHg'],
      coreTemp_C: v['resp.coreTemp_C'],
      skinTemp_C: v['resp.skinTemp_C'],
      gsr_uS: v['resp.gsr_uS'],
    },
    biochem: {
      vocOxStressIndex: v['biochem.vocOxStressIndex'],
      sweatCortisol_ng_mL: v['biochem.sweatCortisol_ng_mL'],
      sweatLactate_mM: v['biochem.sweatLactate_mM'],
      sweatSodium_mM: v['biochem.sweatSodium_mM'],
    },
    cog: {
      pvtMeanRt_ms: v['cog.pvtMeanRt_ms'],
      pvtLapses: v['cog.pvtLapses'],
      bsi18_gsi: v['cog.bsi18_gsi'],
      panasPositive: v['cog.panasPositive'],
      panasNegative: v['cog.panasNegative'],
      speechStrainIndex: v['cog.speechStrainIndex'],
      pupilDiameter_mm: v['cog.pupilDiameter_mm'],
      pupilLatency_ms: v['cog.pupilLatency_ms'],
    },
    env: {
      doseRate_uSv_h: v['env.doseRate_uSv_h'],
      doseCumulative_mSv: v['env.doseCumulative_mSv'],
      ppCO2_mmHg: v['env.ppCO2_mmHg'],
      o2_pct: v['env.o2_pct'],
      pressure_kPa: v['env.pressure_kPa'],
      sleepLastNight_h: v['env.sleepLastNight_h'],
      remPct: v['env.remPct'],
      swsPct: v['env.swsPct'],
      circadianShift_h: v['env.circadianShift_h'],
      ambientTemp_C: v['env.ambientTemp_C'],
      humidity_pct: v['env.humidity_pct'],
      noise_dBA: v['env.noise_dBA'],
    },
  };
}
