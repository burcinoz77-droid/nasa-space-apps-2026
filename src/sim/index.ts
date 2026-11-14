// Parça 1 · Simülasyon motoru (dijital ikiz)
// ŞU AN: v0 — her astronot için sabit baseline + küçük gürültü. Ekranlar boş kalmasın diye var.
// PARÇA 1'İN İŞİ: kişisel baseline'ları parameters.ts'ten kurmak, senaryo etkilerini
// (scenarios/*.json) zamanla uygulamak, günlük ölçümleri günde bir güncellemek.
import { CREW } from '../crew';
import type { CrewMember, ScenarioId, ShipState, Simulation, Telemetry } from '../types';
import { gaussian, mulberry32 } from './random';

const MISSION_DAY = 180;

/** Bir astronotun dinlenme hâlindeki tipik değerleri (v0). */
function baselineFor(member: CrewMember): Omit<Telemetry, 'crewId' | 't' | 'missionDay'> {
  const eva = member.location === 'GEZEGEN';
  return {
    cardio: { hr_bpm: eva ? 92 : 68, hrv_rmssd_ms: 42, ecg_rhythm: 'sinus', ecg_ectopic_per_min: 0.2, bp_sys_mmHg: 112, bp_dia_mmHg: 70, spo2_pct: 98 },
    resp: { rr_bpm: eva ? 20 : 14, minuteVent_L_min: eva ? 22 : 6.5, etco2_mmHg: 38, coreTemp_C: eva ? 37.8 : 37.3, skinTemp_C: 33.5, gsr_uS: 4 },
    biochem: { vocOxStressIndex: 20, sweatCortisol_ng_mL: 40, sweatLactate_mM: eva ? 14 : 10, sweatSodium_mM: 45 },
    cog: { pvtMeanRt_ms: 260, pvtLapses: 1, bsi18_gsi: 6, panasPositive: 33, panasNegative: 17, speechStrainIndex: 25, pupilDiameter_mm: 4.5, pupilLatency_ms: 230 },
    env: {
      doseRate_uSv_h: eva ? 26.7 : 76.7, // 0.64 ve 1.84 mSv/gün (Curiosity RAD)
      doseCumulative_mSv: eva ? 319 : 331,
      ppCO2_mmHg: eva ? 2.0 : 1.9,
      o2_pct: eva ? 100 : 21,
      pressure_kPa: eva ? 29.6 : 101.3,
      sleepLastNight_h: 6.1,
      remPct: 22,
      swsPct: 18,
      circadianShift_h: 0.5,
    },
  };
}

export function createSimulation(seed = 2026): Simulation {
  let rand = mulberry32(seed);
  let scenario: ScenarioId = 'NORMAL';
  const n = (sd: number) => gaussian(rand) * sd;

  return {
    tick() {
      const t = Date.now();
      const telemetry: Telemetry[] = CREW.map((m) => {
        const b = baselineFor(m);
        return {
          crewId: m.id,
          t,
          missionDay: MISSION_DAY,
          cardio: { ...b.cardio, hr_bpm: b.cardio.hr_bpm + n(2), hrv_rmssd_ms: b.cardio.hrv_rmssd_ms + n(3), bp_sys_mmHg: b.cardio.bp_sys_mmHg + n(2), bp_dia_mmHg: b.cardio.bp_dia_mmHg + n(1.5), spo2_pct: Math.min(100, b.cardio.spo2_pct + n(0.4)) },
          resp: { ...b.resp, rr_bpm: b.resp.rr_bpm + n(0.8), etco2_mmHg: b.resp.etco2_mmHg + n(0.8), coreTemp_C: b.resp.coreTemp_C + n(0.05), gsr_uS: Math.max(0.5, b.resp.gsr_uS + n(0.3)) },
          biochem: { ...b.biochem, sweatCortisol_ng_mL: b.biochem.sweatCortisol_ng_mL + n(2) },
          cog: { ...b.cog },
          env: { ...b.env, doseRate_uSv_h: b.env.doseRate_uSv_h + n(2), ppCO2_mmHg: b.env.ppCO2_mmHg + n(0.05) },
        };
      });
      const ship: ShipState = { t, missionDay: MISSION_DAY, scenario, commDelayOneWay_s: 750, activeEvents: [] };
      return { ship, telemetry };
    },
    setScenario(id) {
      scenario = id; // TODO Parça 1: senaryonun etkilerini uygula
    },
    onAutoAction(_action) {
      // TODO Parça 1: RADIATION_SHELTER -> o kişilerin doz hızı düşer; INCREASE_VENTILATION -> ppCO2 iner;
      // MANDATORY_REST -> nabız, laktat, çekirdek sıcaklık dinlenme değerine döner.
    },
    reset() {
      rand = mulberry32(seed);
      scenario = 'NORMAL';
    },
  };
}
