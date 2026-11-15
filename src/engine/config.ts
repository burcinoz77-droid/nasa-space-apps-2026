// Part 2 · Layer 1 settings. Thresholds, SD floors and rule constants live here.
// Every sourced threshold has its link next to it; those marked "assumption" are tuning values and are presented to the jury as such.
// The numbers come from the plan's "2 · Layer 1 Anomaly" and "Data and sources" tabs.
import type { MetricKey } from '../metrics';
import type { Domain, Level } from '../types';

/** Personal baseline: the first 30 readings (≈ 36 s) for each astronaut × metric, then frozen. */
export const BASELINE_WINDOW = 30;

/**
 * Demo safety: if a scenario is started before 30 readings are in, the baseline is frozen early with the
 * readings so far so it is not contaminated by the anomaly; but at least this many readings must be collected.
 */
export const BASELINE_MIN_WINDOW = 10;

/** The level only changes if this many consecutive readings stay in the same direction (a single spike raises no alarm). */
export const STREAK_REQUIRED = 3;

/** If all of an incident's signals are nominal for this many readings, the incident is "resolved". */
export const RESOLVE_AFTER = 10;

/** Directional z-score thresholds: riskZ ≥ 2 caution, ≥ 3 warning. */
export const Z_CAUTION = 2;
export const Z_CRITICAL = 3;

/** Domain score = 100 − 12 × Σ max(0, riskZ − 1), clamped to 0–100. */
export const SCORE_WEIGHT = 12;

/** Metrics that never enter the z-score (tracked only by an absolute threshold). */
export const Z_EXCLUDED = new Set<MetricKey>(['env.doseCumulative_mSv']);

// ---------------------------------------------------------------------------
// SD floors: sd = max(baseline sd, floor). Daily readings (sleep, PVT, BSI-18 ...)
// are normally constant, so sd = 0 and z goes to infinity; the floor prevents this.
// All are tuning values (assumption). For metrics not in the table, floor = 3% of the mean.
// ---------------------------------------------------------------------------
export const SD_FLOOR: Partial<Record<MetricKey, number>> = {
  'cardio.hr_bpm': 3,
  'cardio.hrv_rmssd_ms': 5,
  'cardio.bp_sys_mmHg': 4,
  'cardio.bp_dia_mmHg': 4,
  'cardio.spo2_pct': 0.8,
  'resp.rr_bpm': 1.5,
  'resp.etco2_mmHg': 1.5,
  'resp.coreTemp_C': 0.15,
  'resp.gsr_uS': 0.8,
  'biochem.sweatCortisol_ng_mL': 6,
  'biochem.sweatLactate_mM': 1.5,
  'biochem.sweatSodium_mM': 6,
  'cog.pvtMeanRt_ms': 20,
  'cog.pvtLapses': 1,
  'cog.bsi18_gsi': 2,
  'cog.panasPositive': 3,
  'cog.panasNegative': 3,
  'cog.speechStrainIndex': 6,
  'cog.pupilDiameter_mm': 0.3,
  'cog.pupilLatency_ms': 15,
  'env.doseRate_uSv_h': 5,
  'env.ppCO2_mmHg': 0.15,
  'env.sleepLastNight_h': 0.4,
  'env.remPct': 2,
  'env.swsPct': 2,
  // Floors added to the table by Part 2 (assumption). For metrics whose mean is close to zero or very small,
  // "3%" is meaningless and noise produced false alarms:
  'cardio.ecg_ectopic_per_min': 0.5, // mean ~0.2/min; 3% of it would be 0.006
  'resp.minuteVent_L_min': 1, // ~6.5 L/min at rest; 3% is 0.2 L/min, below the sensor noise
  'env.circadianShift_h': 0.5, // mean ~0.5 h; 3% is 0.015 h → a 1-hour shift would be z = 66
};
export const SD_FLOOR_DEFAULT_PCT = 0.03;

// ---------------------------------------------------------------------------
// Absolute thresholds. For metrics with a firm NASA or clinical limit, the level
// takes precedence over the z-score: the level of these metrics is set ONLY by these thresholds.
// The z-score is still computed and enters the health score.
// ---------------------------------------------------------------------------
export interface AbsoluteLimit {
  dir: 'above' | 'below'; // which side of the threshold is risky
  caution: number;
  critical: number;
  inclusive: boolean; // true: ≥ / ≤ ; false: > / <
  source: string;
  url?: string;
  assumption?: boolean;
}

export const ABSOLUTE_LIMITS: Partial<Record<MetricKey, AbsoluteLimit>> = {
  // ppCO₂ > 2.3 mmHg caution, > 3.0 mmHg warning
  'env.ppCO2_mmHg': {
    dir: 'above',
    caution: 2.3,
    critical: 3.0,
    inclusive: false,
    source: 'OCHMO-TB-004 CO₂; NASA-STD-3001 Vol. 2, 6004',
    url: 'https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/',
  },
  // SpO₂ < 94% caution, < 90% warning — NASA has no universal number; clinical threshold, labeled as an assumption
  'cardio.spo2_pct': {
    dir: 'below',
    caution: 94,
    critical: 90,
    inclusive: false,
    source: 'Clinical threshold (assumption); risk context: NASA HRP hypoxia risk',
    url: 'https://www.nasa.gov/reference/risk-of-hypoxia/',
    assumption: true,
  },
  // Core temperature ≥ 38.5 °C caution, ≥ 39.0 °C warning — Stahn 2017: can exceed 40 °C during exercise in space; threshold is an assumption
  'resp.coreTemp_C': {
    dir: 'above',
    caution: 38.5,
    critical: 39.0,
    inclusive: true,
    source: 'Stahn et al. 2017, Sci Rep (threshold assumed)',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5701078',
    assumption: true,
  },
  // Total dose ≥ 480 mSv (80% of the career limit) caution, ≥ 600 mSv warning
  'env.doseCumulative_mSv': {
    dir: 'above',
    caution: 480,
    critical: 600,
    inclusive: true,
    source: 'NASA-STD-3001 career limit 600 mSv (OCHMO radiation brief)',
    url: 'https://www.nasa.gov/sites/default/files/atoms/files/radiation_protection_technical_brief_ochmo.pdf',
  },
};

// ---------------------------------------------------------------------------
// Constants for the incident rules (used by rules.ts)
// ---------------------------------------------------------------------------

/** FATIGUE: at least 3 of these 5 signals at caution at the same time (scope document example; Jones 2022). */
export const FATIGUE_SIGNALS: MetricKey[] = [
  'env.sleepLastNight_h',
  'cog.pvtMeanRt_ms',
  'cog.panasPositive',
  'cog.bsi18_gsi',
  'cardio.hrv_rmssd_ms',
];
export const FATIGUE_MIN_SIGNALS = 3;

/** STRESS: all three must be at riskZ ≥ 2 (caution). */
export const STRESS_SIGNALS: MetricKey[] = ['resp.gsr_uS', 'biochem.sweatCortisol_ng_mL', 'cog.panasNegative'];

/** CARDIO: ECG rhythm "irregular" or irregular beats at riskZ ≥ 3 (3 readings). */
export const CARDIO_ECTOPIC_KEY: MetricKey = 'cardio.ecg_ectopic_per_min';

/**
 * MULTI: at least 2 domains at warning in the same person. The environmental domain (group 5) does not count: dose rate and CO₂
 * already raise their own incidents (RADIATION, CO2); only body domains count, so that not everyone gets
 * MULTI when the environment is at warning. (Tuning decision, Part 2.)
 */
export const MULTI_DOMAINS: Domain[] = ['cardio', 'resp', 'biochem', 'cog'];
export const MULTI_MIN_CRITICAL_DOMAINS = 2;

export const LEVEL_RANK: Record<Level, number> = { normal: 0, caution: 1, critical: 2 };
