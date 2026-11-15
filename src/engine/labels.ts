// Parça 2 · Olay ve otonom adım adları (Türkçe). Raporlar sayfası ve olay bandı buradan okuyabilir.
import { CREW_BY_ID } from '../crew';
import { METRIC_BY_KEY, type MetricKey } from '../metrics';
import type { AutoActionType, CrewId, CrewLocation, Domain, IncidentType } from '../types';

export const INCIDENT_LABELS: Record<IncidentType, string> = {
  RADIATION: 'Radiation',
  CO2: 'CO₂',
  CARDIO: 'Heart rhythm',
  HYPOXIA: 'Oxygen saturation',
  THERMAL: 'Heat load',
  FATIGUE: 'Fatigue',
  STRESS: 'Stress',
  MULTI: 'Multi-system',
};

export const ACTION_LABELS: Record<AutoActionType, string> = {
  RADIATION_SHELTER: 'Move to radiation shelter',
  INCREASE_VENTILATION: 'Ventilation increased',
  MANDATORY_REST: 'Mandatory rest',
};

export const DOMAIN_LABELS: Record<Domain, string> = {
  cardio: 'cardiovascular',
  resp: 'respiratory-metabolic',
  biochem: 'biochemical',
  cog: 'cognitive',
  env: 'environment',
};

/** ["a","b","c"] -> "a, b ve c" */
export function joinTr(list: string[]): string {
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

export const LOCATION_LABELS: Record<CrewLocation, string> = { KOKPIT: 'Cockpit', GEZEGEN: 'Surface' };

/** "elif" -> "Elif" (kayıt metinlerinde kısa ad). */
export function shortName(id: CrewId): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export function names(ids: CrewId[]): string {
  return joinTr(ids.map(shortName));
}

export function locationOf(id: CrewId): CrewLocation {
  return CREW_BY_ID[id].location;
}

/** Kayıt metni için Türkçe sayı: 36.8 -> "36,8" (ondalık sayısı ölçüm kataloğundan). */
export function num(value: number, decimals = 0): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** "3,1 mmHg" gibi değer + birim. */
export function metricText(key: MetricKey, value: number): string {
  const m = METRIC_BY_KEY[key];
  if (m.unit === '%') return `${num(value, m.decimals)}%`;
  if (m.unit.startsWith('/')) return `${num(value, m.decimals)}${m.unit}`;
  return `${num(value, m.decimals)} ${m.unit}`;
}
