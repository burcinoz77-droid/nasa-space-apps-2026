// Part 4 · Layer 2's shared labels and small helpers.
// Used by the data summary sent to the model (context.ts), offline mode (fallback.ts) and the
// ASTRA components, so the same words appear on screen and in answers.
import { CREW_BY_ID } from '../crew';
import { METRIC_BY_KEY, type MetricKey } from '../metrics';
import { fmt } from '../ui/theme';
import type { AstraAnswer, AutoActionType, CrewId, IncidentType, Level, ScenarioId } from '../types';

export const SOURCE_LABEL: Record<AstraAnswer['source'], string> = {
  gemini: 'Gemini',
  claude: 'Claude',
  fallback: 'Offline mode',
  cache: 'From cache',
};

export const LEVEL_TR: Record<Level, string> = { normal: 'nominal', caution: 'caution', critical: 'warning' };

export const SCENARIO_TR: Record<ScenarioId, string> = {
  NORMAL: 'Nominal day',
  SOLAR_STORM: 'Solar particle event',
  MARS_DAY_180: 'Mars Day 180 load',
  CO2_SCRUBBER_FAIL: 'CO₂ scrubber failure',
  EVA_OVEREXERTION: 'EVA overexertion',
};

export const INCIDENT_TR: Record<IncidentType, string> = {
  RADIATION: 'Radiation',
  CO2: 'Cabin CO₂',
  CARDIO: 'Heart rhythm',
  HYPOXIA: 'Oxygen saturation',
  THERMAL: 'Body temperature',
  FATIGUE: 'Fatigue',
  STRESS: 'Stress',
  MULTI: 'Multi-system deviation',
};

/** "Done" form of an autonomous action (in incident explanations). */
export const ACTION_DONE_TR: Record<AutoActionType, string> = {
  RADIATION_SHELTER: 'Storm shelter ingress started automatically',
  INCREASE_VENTILATION: 'Ventilation increased automatically',
  MANDATORY_REST: 'Mandatory crew rest applied automatically',
};

/** Short name of an autonomous action (in the data summary). */
export const ACTION_TR: Record<AutoActionType, string> = {
  RADIATION_SHELTER: 'moving to the storm shelter',
  INCREASE_VENTILATION: 'increasing ventilation',
  MANDATORY_REST: 'mandatory crew rest',
};

/** On-screen names of the tools (TOOLS in api/astra.ts). */
export const TOOL_TR: Record<string, string> = {
  get_crew_member: 'Astronaut details',
  get_metric_trend: 'Metric trend',
  assess_possible_conditions: 'Possible conditions',
  list_incidents: 'Incidents',
  get_event_log: 'Event log',
  lookup_reference: 'Reference lookup',
  get_test_results: 'Test results',
  get_psych_state: 'Psychological state',
  get_test_schedule: 'Test schedule',
  compare_crew_tests: 'Crew test comparison',
};

/** "Metric trend · Kerem, CO₂" */
export function toolLabel(tool: { ad: string; girdi?: Record<string, unknown> }): string {
  const args = Object.values(tool.girdi ?? {})
    .filter((v) => v !== undefined && v !== '')
    .map(String);
  return `${TOOL_TR[tool.ad] ?? tool.ad}${args.length ? ` · ${args.join(', ')}` : ''}`;
}

/** 'kerem' -> 'Kerem'. Crew members are addressed by first name (Emir Celik -> Emir). */
export function shortName(id: CrewId): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export function fullName(id: CrewId): string {
  return CREW_BY_ID[id]?.name ?? shortName(id);
}

/** Finds astronaut names in a question: "Kerem's heart rate" -> ['kerem']. */
export function crewInText(text: string): CrewId[] {
  const q = text.toLowerCase();
  return (Object.keys(CREW_BY_ID) as CrewId[]).filter((id) => new RegExp(`(^|[^a-zçğıöşü])${id}`).test(q));
}

/** Writes a metric with its unit in the on-screen format: 36.8 °C · 98% · 25/100 · 3 count. */
export function valueText(key: MetricKey, value: number): string {
  const m = METRIC_BY_KEY[key];
  if (!m) return fmt(value, 1);
  const v = fmt(value, m.decimals);
  if (m.unit === '%') return `${v}%`;
  if (m.unit.startsWith('/')) return `${v}${m.unit}`;
  return `${v} ${m.unit}`;
}

/** Converts seconds to the "12 min 30 s" format. */
export function delayText(seconds: number): string {
  const total = Math.round(seconds);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return sec ? `${min} min ${sec} s` : `${min} min`;
}
