// Part 4 · Short data summary sent to the model (keep it under about 3,000 tokens).
// Rule: 8 key metrics for a person with Nominal status; all metrics for a person who is not Nominal,
// is named in the question or is affected by the incident. The model cannot write a number it does not know,
// so constants that may appear in an answer (career dose limit, CO₂ limits, delay)
// are included here too. Values are rounded the same way as on screen.
import { CREW } from '../crew';
import { METRICS, METRIC_BY_KEY, readMetric, type MetricKey } from '../metrics';
import { PARAMS } from '../sim/parameters';
import type { AstraState } from '../store';
import type { CrewId, Incident, MetricScore } from '../types';
import { possibleConditions } from './conditions';
import { boneLossEstimate } from './knowledge';
import { ACTION_TR, crewInText, delayText, INCIDENT_TR, LEVEL_TR, SCENARIO_TR, shortName } from './labels';
import { testSummary } from './testdata';
import { LICENSED_NOTE_LONG } from '../psych/instruments';

/** The 8 key metrics sent for a person with Nominal status. */
export const KEY_METRICS: MetricKey[] = [
  'cardio.hr_bpm',
  'cardio.spo2_pct',
  'resp.rr_bpm',
  'resp.coreTemp_C',
  'env.doseRate_uSv_h',
  'env.doseCumulative_mSv',
  'env.ppCO2_mmHg',
  'env.sleepLastNight_h',
];

/** Safe upper limit for the model: JSON length / 4 ≈ tokens. */
export const MAX_CONTEXT_TOKENS = 3000;

const round = (v: number, d: number) => Number(v.toFixed(d));

/** Reads a value from PARAMS; if the key is missing on this branch, falls back to the plan's (sourced) value. */
function param(key: string, fallback: number): number {
  return (PARAMS as Record<string, { value: number } | undefined>)[key]?.value ?? fallback;
}

export interface ContextOptions {
  /** Chat question: all metrics of the people named are added. */
  question?: string;
  /** Incident explanation: all metrics of the people in the incident and the incident details are added. */
  incident?: Incident;
  /**
   * Short summary: 8 key metrics for everyone (+ the most deviating signals of people with issues).
   * Used in chat; the model pulls the details itself with tools (api/astra.ts).
   */
  compact?: boolean;
}

function metricLabel(key: MetricKey): string {
  const m = METRIC_BY_KEY[key];
  return m ? `${m.label} (${m.unit})` : key;
}

export function signalSummary(sig: MetricScore) {
  const m = METRIC_BY_KEY[sig.key];
  const d = m?.decimals ?? 1;
  return {
    olcum: m?.label ?? sig.key,
    deger: round(sig.value, d),
    birim: m?.unit ?? '',
    kisiselNormal: round(sig.mean, d),
    z: round(sig.z, 1),
    seviye: LEVEL_TR[sig.level],
  };
}

export function incidentSummary(i: Incident) {
  return {
    olayId: i.id,
    tur: INCIDENT_TR[i.type] ?? i.type,
    baslik: i.title,
    seviye: LEVEL_TR[i.level],
    durum: i.status === 'acknowledged' ? 'acknowledged by crew' : i.status === 'resolved' ? 'resolved' : 'open',
    kisiler: i.crewIds.map(shortName),
    sinyaller: i.signals.slice(0, 4).map(signalSummary),
    otonomAdimlar: i.autoActions.map((a) => ACTION_TR[a] ?? a),
  };
}

function crewSummary(s: AstraState, id: CrewId, detailed: boolean, keysOnly: boolean) {
  const m = CREW.find((c) => c.id === id)!;
  const t = s.telemetry[id];
  const st = s.statuses[id];
  const keys = detailed && !keysOnly ? METRICS.map((x) => x.key) : KEY_METRICS;
  const olcumler: Record<string, number | string> = {};
  if (t) {
    for (const key of keys) olcumler[metricLabel(key)] = round(readMetric(t, key), METRIC_BY_KEY[key].decimals);
    if (detailed) olcumler['ECG rhythm'] = t.cardio.ecg_rhythm === 'sinus' ? 'sinus (normal)' : 'irregular';
  }
  const careerLimit = param('careerDoseLimit', 600);
  return {
    ad: shortName(id),
    tamAd: m.name,
    rol: m.role,
    konum: m.location === 'KOKPIT' ? 'Orbit (IVA, inside the spacecraft)' : 'Mars surface (EVA suit)',
    kisiselHassasiyet: m.sensitivity,
    durum: st ? LEVEL_TR[st.level] : 'no data',
    saglikSkoru_pct: st ? Math.round(st.healthScore) : undefined,
    bilisselSkor_pct: st ? Math.round(st.domainScores.cog) : undefined,
    zorunluDinlenme: st?.restRequired ?? false,
    kariyerDozLimitininYuzdesi_pct: t ? Math.round((t.env.doseCumulative_mSv / careerLimit) * 100) : undefined,
    olcumler,
    ...(detailed && st?.topSignals.length ? { enCokSapanlar: st.topSignals.slice(0, 3).map(signalSummary) } : {}),
  };
}

export function buildContext(s: AstraState, opts: ContextOptions = {}): Record<string, unknown> {
  const named = new Set<CrewId>([...crewInText(opts.question ?? ''), ...(opts.incident?.crewIds ?? [])]);
  const isDetailed = (id: CrewId) => named.has(id) || (s.statuses[id]?.level ?? 'normal') !== 'normal';

  const delay = s.ship?.commDelayOneWay_s;
  const delayMin = param('commDelayMin', 180) / 60;
  const delayMax = param('commDelayMax', 1344) / 60;
  const openIncidents = s.incidents.filter((i) => i.status !== 'resolved').slice(0, 5);

  const make = (keysOnly: boolean) => ({
    gorev: 'ARES-1 Mars mission',
    gorevGunu: s.ship?.missionDay,
    senaryo: s.ship ? SCENARIO_TR[s.ship.scenario] : undefined,
    aktifOlaylarGemi: s.ship?.activeEvents.length ? s.ship.activeEvents : undefined,
    dunyaGecikmesi:
      delay !== undefined
        ? {
            tekYon: delayText(delay),
            tekYon_dk: round(delay / 60, 1),
            gidisDonus_dk: round((delay * 2) / 60, 1),
            // NASA Mars Relay Network: one-way 3-22.4 min, round trip 6-44 min
            olasiAralik: `one way ${round(delayMin, 0)}-${round(delayMax, 1)} min, round trip ${Math.round(delayMin * 2)}-${Math.floor(delayMax * 2)} min`,
          }
        : undefined,
    sabitler: {
      kariyerDozLimiti_mSv: param('careerDoseLimit', 600), // NASA-STD-3001
      co2DikkatSiniri_mmHg: param('co2CautionLimit', 2.3), // OCHMO-TB-004
      co2KritikSiniri_mmHg: param('co2CriticalLimit', 3.0), // OCHMO-TB-004
      issCo2Medyani_mmHg: param('cabinCO2Median', 1.9), // OSDR EDA
      ortamPerformansAraligi: '20–25 °C, humidity 30–60%', // OCHMO-TB-002
      gurultuSiniri_dBA: { calisma16sa: param('noiseWorkLimit', 72), uyku8sa: param('noiseSleepLimit', 62) }, // ISS
      // Bone is not measured in the system; general estimate from the NASA HRP average
      lisansNotu: LICENSED_NOTE_LONG, // PANAS and BSI-18 are simulated
      tahminiKemikKaybi: `${boneLossEstimate(s.ship?.missionDay ?? 180)} (NASA: 1–1.5% per month; an estimate, not a measurement)`,
    },
    murettebat: CREW.map((m) => crewSummary(s, m.id, isDetailed(m.id), keysOnly)),
    // Psychological tests (Samn-Perelli, NASA-TLX, PVT-B): short summary; details in the get_test_results tool
    psikolojikTestler: testSummary(s),
    acikOlaylar: openIncidents.map(incidentSummary),
    ...(opts.incident
      ? {
          olayId: opts.incident.id,
          aciklanacakOlay: incidentSummary(opts.incident),
          // Data-based possible conditions for the people in the incident (not definitive)
          olasiDurumlar: Object.fromEntries(opts.incident.crewIds.map((id) => [shortName(id), possibleConditions(s, id).slice(0, 2).map((c) => ({ durum: c.durum, olasilik: c.olasilik }))])),
        }
      : {}),
  });

  if (opts.compact) return make(true);
  // Try the full version first; if too long, reduce the detailed people to 8 metrics as well.
  const full = make(false);
  if (estimateTokens(full) <= MAX_CONTEXT_TOKENS) return full;
  return make(true);
}

/** Rough token estimate (plan: JSON.stringify(ctx).length / 4). */
export function estimateTokens(ctx: unknown): number {
  return Math.ceil(JSON.stringify(ctx).length / 4);
}
