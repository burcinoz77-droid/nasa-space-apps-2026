// ============================================================================
// SHARED DATA CONTRACT — the single meeting point of the four parts
// ----------------------------------------------------------------------------
// RULE: ADDING fields is allowed. DELETING a field or changing its NAME or UNIT
// is not allowed; if needed, post in the team group first and get everyone's approval.
// The unit is always at the end of the field name: hr_bpm, doseRate_uSv_h ...
// ============================================================================

// ---------- Crew ----------
export type CrewId = 'elif' | 'kerem' | 'zeynep' | 'emir' | 'deniz' | 'mert';
export type CrewLocation = 'KOKPIT' | 'GEZEGEN'; // KOKPIT = spacecraft in orbit (IVA), GEZEGEN = Mars surface (EVA)

export interface CrewMember {
  id: CrewId;
  name: string; // "Dr. Elif Yılmaz"
  role: string; // "Commander", "Flight Engineer", "Mission Specialist · Geologist"
  location: CrewLocation;
  unit: string; // "IVA-01" (inside the spacecraft) | "xEMU-01" (spacesuit)
  sensitivity: string; // personal risk note shown on the card
}

// ---------- Data group 1 · Cardiovascular ----------
export interface Cardio {
  hr_bpm: number; // heart rate
  hrv_rmssd_ms: number; // heart rate variability (RMSSD)
  ecg_rhythm: 'sinus' | 'irregular'; // ECG rhythm
  ecg_ectopic_per_min: number; // premature/irregular beats per minute
  bp_sys_mmHg: number; // systolic blood pressure
  bp_dia_mmHg: number; // diastolic blood pressure
  spo2_pct: number; // blood oxygen saturation
}

// ---------- Data group 2 · Respiratory and metabolic ----------
export interface Respiratory {
  rr_bpm: number; // respiratory rate (breaths/min)
  minuteVent_L_min: number; // minute ventilation
  etco2_mmHg: number; // end-tidal CO2
  coreTemp_C: number; // core body temperature
  skinTemp_C: number; // skin temperature
  gsr_uS: number; // galvanic skin response (microsiemens)
}

// ---------- Data group 3 · Biochemical ----------
export interface Biochem {
  vocOxStressIndex: number; // breath volatile organic compound (VOC) oxidative stress index, 0-100 (assumed scale)
  sweatCortisol_ng_mL: number; // sweat cortisol
  sweatLactate_mM: number; // sweat lactate
  sweatSodium_mM: number; // sweat sodium (electrolyte)
}

// ---------- Data group 4 · Psychological and cognitive ----------
export interface Cognitive {
  pvtMeanRt_ms: number; // PVT-B mean reaction time
  pvtLapses: number; // PVT-B lapse count (reaction >= 355 ms)
  bsi18_gsi: number; // BSI-18 global severity score, 0-72
  panasPositive: number; // PANAS positive affect, 10-50
  panasNegative: number; // PANAS negative affect, 10-50
  speechStrainIndex: number; // speech analysis strain index, 0-100 (assumed scale)
  pupilDiameter_mm: number; // pupil diameter
  pupilLatency_ms: number; // pupillary light reflex latency
}

// ---------- Data group 5 · Environmental and external factors ----------
export interface Environment {
  doseRate_uSv_h: number; // current radiation dose rate
  doseCumulative_mSv: number; // cumulative mission dose
  ppCO2_mmHg: number; // CO2 partial pressure in the cabin or suit
  o2_pct: number; // O2 percentage in the cabin or suit
  pressure_kPa: number; // cabin or suit pressure
  sleepLastNight_h: number; // sleep duration last night
  remPct: number; // REM sleep percentage
  swsPct: number; // deep (slow-wave) sleep percentage
  circadianShift_h: number; // circadian rhythm shift (hours)
  ambientTemp_C: number; // ambient temperature in the cabin or suit
  humidity_pct: number; // relative humidity in the cabin or suit
  noise_dBA: number; // noise the astronaut is exposed to (personal noise dosimeter)
}

// All readings of one astronaut at one moment (Part 1 produces, everyone reads)
export interface Telemetry {
  crewId: CrewId;
  t: number; // reading time, ms (same scale as Date.now())
  missionDay: number;
  cardio: Cardio;
  resp: Respiratory;
  biochem: Biochem;
  cog: Cognitive;
  env: Environment;
}

// ---------- Vehicle and scenario (Part 1 produces) ----------
export type ScenarioId =
  | 'NORMAL'
  | 'SOLAR_STORM'
  | 'MARS_DAY_180'
  | 'CO2_SCRUBBER_FAIL'
  | 'EVA_OVEREXERTION';

export interface ShipState {
  t: number;
  missionDay: number;
  scenario: ScenarioId;
  commDelayOneWay_s: number; // Earth-Mars one-way light time (180-1340 s)
  activeEvents: string[]; // e.g. ['SPE_ONSET'] — shown on screen as information
}

export interface Simulation {
  tick(): { ship: ShipState; telemetry: Telemetry[] };
  setScenario(id: ScenarioId): void;
  /** Called when Layer 1 applies an autonomous action: the shelter lowers dose, ventilation lowers CO2, rest lowers fatigue. */
  onAutoAction(action: AutoAction): void;
  reset(): void;
}

// ---------- Layer 1 output (Part 2 produces) ----------
export type Level = 'normal' | 'caution' | 'critical';
export type Domain = 'cardio' | 'resp' | 'biochem' | 'cog' | 'env';
export type MetricKey = import('./metrics').MetricKey;

export interface MetricScore {
  key: MetricKey;
  value: number;
  mean: number; // personal baseline mean
  sd: number; // personal baseline standard deviation
  z: number; // (value - mean) / sd
  streak: number; // for how many consecutive readings it has exceeded the threshold
  level: Level;
}

export interface CrewStatus {
  crewId: CrewId;
  level: Level;
  healthScore: number; // 0-100, the "87%" on screen
  domainScores: Record<Domain, number>; // 0-100
  topSignals: MetricScore[]; // the 3 most deviating metrics
  restRequired: boolean; // placed on mandatory crew rest?
}

export type IncidentType =
  | 'RADIATION'
  | 'CO2'
  | 'CARDIO'
  | 'HYPOXIA'
  | 'THERMAL'
  | 'FATIGUE'
  | 'STRESS'
  | 'MULTI';

export type AutoActionType = 'RADIATION_SHELTER' | 'INCREASE_VENTILATION' | 'MANDATORY_REST';

/** Pre-approved safe action (only these three types). Each is also written to the incident log. */
export interface AutoAction {
  type: AutoActionType;
  crewIds: CrewId[];
  at: number;
  reason: string; // "Dose rate at Warning for 3 readings"
  incidentId: string;
}

export interface Incident {
  id: string;
  type: IncidentType;
  level: Exclude<Level, 'normal'>;
  crewIds: CrewId[];
  openedAt: number;
  title: string; // "Elif: sleep + reaction time + mood falling together"
  signals: MetricScore[];
  autoActions: AutoActionType[];
  status: 'open' | 'acknowledged' | 'resolved';
}

export interface LedgerEntry {
  id: string;
  at: number;
  kind: 'INCIDENT_OPENED' | 'INCIDENT_RESOLVED' | 'AUTO_ACTION' | 'ACK' | 'SCENARIO' | 'SYSTEM';
  text: string; // English, shown on screen as is
  incidentId?: string;
  crewIds?: CrewId[];
}

export interface DetectorOutput {
  statuses: Record<CrewId, CrewStatus>;
  incidents: Incident[]; // all incidents (open + closed), newest first
  newLedger: LedgerEntry[]; // log entries created in this step
  newActions: AutoAction[]; // autonomous actions started in this step (loop.ts passes them to the simulation)
}

export interface Detector {
  process(ship: ShipState, telemetry: Telemetry[]): DetectorOutput;
  acknowledge(incidentId: string): LedgerEntry | null; // human acknowledgement
  reset(): void;
}

// ---------- Layer 2 (Part 4) ----------
export type AstraMode = 'chat' | 'incident';

export interface AstraRequest {
  mode: AstraMode;
  question: string;
  context: Record<string, unknown>; // prepared by src/ai/context.ts
}

export interface AstraAnswer {
  text: string;
  source: 'claude' | 'gemini' | 'fallback' | 'cache';
  verified: boolean; // are all numbers in the answer present in the data (src/ai/verify.ts)
  latencyMs: number;
  tools?: string[]; // tools ASTRA called for the answer, shown on screen (added by Part 4)
  fallbackReason?: 'connection' | 'safety'; // reason for the offline answer: no connection, or the safety filter (added by Part 4)
  sources?: { ad: string; url: string }[]; // sources the answer is based on, shown as links (added by Part 4)
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'astra';
  text: string;
  at: number;
  answer?: AstraAnswer;
}
