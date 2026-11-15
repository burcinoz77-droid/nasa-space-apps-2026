// Metric catalog: name, unit, group and "bad direction" of every numeric metric.
// Part 1 (science) updates it; Part 2 reads it for the z-score, Part 3 for labels,
// Part 4 for the AI context.
import type { Biochem, Cardio, Cognitive, Environment, Respiratory, Telemetry } from './types';

type NumKeys<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T] & string;

export type MetricKey =
  | `cardio.${NumKeys<Cardio>}`
  | `resp.${NumKeys<Respiratory>}`
  | `biochem.${NumKeys<Biochem>}`
  | `cog.${NumKeys<Cognitive>}`
  | `env.${NumKeys<Environment>}`;

export interface MetricInfo {
  key: MetricKey;
  label: string; // name shown on screen
  unit: string; // unit shown on screen
  group: 1 | 2 | 3 | 4 | 5; // data group
  badWhen: 'high' | 'low' | 'both'; // which direction of deviation is risky
  cadence: 'live' | 'daily'; // live sensor, or measured once a day
  decimals: number; // decimal places on screen
}

export const METRICS: MetricInfo[] = [
  // Data group 1 · Cardiovascular
  { key: 'cardio.hr_bpm', label: 'Heart rate', unit: 'bpm', group: 1, badWhen: 'both', cadence: 'live', decimals: 0 },
  { key: 'cardio.hrv_rmssd_ms', label: 'Heart rate variability (HRV)', unit: 'ms', group: 1, badWhen: 'low', cadence: 'live', decimals: 0 },
  { key: 'cardio.ecg_ectopic_per_min', label: 'ECG ectopic beats', unit: '/min', group: 1, badWhen: 'high', cadence: 'live', decimals: 1 },
  { key: 'cardio.bp_sys_mmHg', label: 'Systolic blood pressure', unit: 'mmHg', group: 1, badWhen: 'both', cadence: 'live', decimals: 0 },
  { key: 'cardio.bp_dia_mmHg', label: 'Diastolic blood pressure', unit: 'mmHg', group: 1, badWhen: 'both', cadence: 'live', decimals: 0 },
  { key: 'cardio.spo2_pct', label: 'Oxygen saturation (SpO₂)', unit: '%', group: 1, badWhen: 'low', cadence: 'live', decimals: 0 },
  // Data group 2 · Respiratory and metabolic
  { key: 'resp.rr_bpm', label: 'Respiratory rate', unit: 'breaths/min', group: 2, badWhen: 'both', cadence: 'live', decimals: 0 },
  { key: 'resp.minuteVent_L_min', label: 'Minute ventilation', unit: 'L/min', group: 2, badWhen: 'both', cadence: 'live', decimals: 1 },
  { key: 'resp.etco2_mmHg', label: 'End-tidal CO₂ (EtCO₂)', unit: 'mmHg', group: 2, badWhen: 'both', cadence: 'live', decimals: 0 },
  { key: 'resp.coreTemp_C', label: 'Core temperature', unit: '°C', group: 2, badWhen: 'high', cadence: 'live', decimals: 1 },
  { key: 'resp.skinTemp_C', label: 'Skin temperature', unit: '°C', group: 2, badWhen: 'both', cadence: 'live', decimals: 1 },
  { key: 'resp.gsr_uS', label: 'Galvanic skin response (GSR)', unit: 'µS', group: 2, badWhen: 'high', cadence: 'live', decimals: 1 },
  // Data group 3 · Biochemical
  { key: 'biochem.vocOxStressIndex', label: 'Breath VOC oxidative stress', unit: '/100', group: 3, badWhen: 'high', cadence: 'daily', decimals: 0 },
  { key: 'biochem.sweatCortisol_ng_mL', label: 'Sweat cortisol', unit: 'ng/mL', group: 3, badWhen: 'high', cadence: 'live', decimals: 0 },
  { key: 'biochem.sweatLactate_mM', label: 'Sweat lactate', unit: 'mM', group: 3, badWhen: 'high', cadence: 'live', decimals: 1 },
  { key: 'biochem.sweatSodium_mM', label: 'Sweat sodium', unit: 'mM', group: 3, badWhen: 'both', cadence: 'live', decimals: 0 },
  // Data group 4 · Psychological and cognitive
  { key: 'cog.pvtMeanRt_ms', label: 'PVT reaction time', unit: 'ms', group: 4, badWhen: 'high', cadence: 'daily', decimals: 0 },
  { key: 'cog.pvtLapses', label: 'PVT lapses', unit: 'lapses', group: 4, badWhen: 'high', cadence: 'daily', decimals: 0 },
  { key: 'cog.bsi18_gsi', label: 'BSI-18 global severity', unit: '/72', group: 4, badWhen: 'high', cadence: 'daily', decimals: 0 },
  { key: 'cog.panasPositive', label: 'PANAS positive affect', unit: '/50', group: 4, badWhen: 'low', cadence: 'daily', decimals: 0 },
  { key: 'cog.panasNegative', label: 'PANAS negative affect', unit: '/50', group: 4, badWhen: 'high', cadence: 'daily', decimals: 0 },
  { key: 'cog.speechStrainIndex', label: 'Speech strain index', unit: '/100', group: 4, badWhen: 'high', cadence: 'daily', decimals: 0 },
  { key: 'cog.pupilDiameter_mm', label: 'Pupil diameter', unit: 'mm', group: 4, badWhen: 'both', cadence: 'daily', decimals: 1 },
  { key: 'cog.pupilLatency_ms', label: 'Pupil response latency', unit: 'ms', group: 4, badWhen: 'high', cadence: 'daily', decimals: 0 },
  // Data group 5 · Environmental
  { key: 'env.doseRate_uSv_h', label: 'Radiation dose rate', unit: 'µSv/h', group: 5, badWhen: 'high', cadence: 'live', decimals: 1 },
  { key: 'env.doseCumulative_mSv', label: 'Cumulative radiation dose', unit: 'mSv', group: 5, badWhen: 'high', cadence: 'live', decimals: 0 },
  { key: 'env.ppCO2_mmHg', label: 'CO₂ partial pressure', unit: 'mmHg', group: 5, badWhen: 'high', cadence: 'live', decimals: 1 },
  { key: 'env.o2_pct', label: 'Oxygen fraction', unit: '%', group: 5, badWhen: 'low', cadence: 'live', decimals: 1 },
  { key: 'env.pressure_kPa', label: 'Pressure', unit: 'kPa', group: 5, badWhen: 'low', cadence: 'live', decimals: 1 },
  { key: 'env.sleepLastNight_h', label: 'Sleep last night', unit: 'h', group: 5, badWhen: 'low', cadence: 'daily', decimals: 1 },
  { key: 'env.remPct', label: 'REM sleep', unit: '%', group: 5, badWhen: 'low', cadence: 'daily', decimals: 0 },
  { key: 'env.swsPct', label: 'Deep sleep', unit: '%', group: 5, badWhen: 'low', cadence: 'daily', decimals: 0 },
  { key: 'env.circadianShift_h', label: 'Circadian shift', unit: 'h', group: 5, badWhen: 'high', cadence: 'daily', decimals: 1 },
  { key: 'env.ambientTemp_C', label: 'Ambient temperature', unit: '°C', group: 5, badWhen: 'both', cadence: 'live', decimals: 1 },
  { key: 'env.humidity_pct', label: 'Ambient humidity', unit: '%', group: 5, badWhen: 'both', cadence: 'live', decimals: 0 },
  { key: 'env.noise_dBA', label: 'Ambient noise', unit: 'dBA', group: 5, badWhen: 'high', cadence: 'live', decimals: 0 },
];

export const GROUP_NAMES: Record<MetricInfo['group'], string> = {
  1: 'Cardiovascular',
  2: 'Respiratory and metabolic',
  3: 'Biochemical',
  4: 'Psychological and cognitive',
  5: 'Environment',
};

export const METRIC_BY_KEY = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<MetricKey, MetricInfo>;

/** Reads the value of a key like 'cardio.hr_bpm' from Telemetry. */
export function readMetric(t: Telemetry, key: MetricKey): number {
  const [group, field] = key.split('.') as [keyof Telemetry, string];
  return (t[group] as unknown as Record<string, number>)[field];
}
