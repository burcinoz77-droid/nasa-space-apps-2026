// Parça 3 · Ekran biçimlendirme yardımcıları. Kodda nokta (36.8), ekranda Türkçe (36,8 °C, %87).
import { CREW_BY_ID } from '../crew';
import { METRIC_BY_KEY, type MetricKey } from '../metrics';
import type { CrewId, CrewStatus, Domain, Level } from '../types';
import { fmt, scoreLevel, worstLevel } from './theme';

/** Değer + birim, Türkçe: "36,8 °C", "%97", "4/72", "12 dk". */
export function fmtUnit(value: number | undefined, unit: string, decimals = 0): string {
  const v = fmt(value, decimals);
  if (unit === '%') return `${v}%`;
  if (unit.startsWith('/')) return `${v}${unit}`;
  return `${v} ${unit}`;
}

/** Ölçüm kataloğundaki birim ve ondalıkla: fmtMetric('resp.coreTemp_C', 36.84) -> "36,8 °C". */
export function fmtMetric(key: MetricKey, value: number | undefined): string {
  const m = METRIC_BY_KEY[key];
  return fmtUnit(value, m.unit, m.decimals);
}

/** 750 -> "12 dk 30 sn" */
export function fmtDelay(seconds: number | undefined): string {
  if (seconds === undefined) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s ? `${m} min ${s} s` : `${m} min`;
}

/** z-skoru: 2.37 -> "+2,4σ" */
export function fmtZ(z: number): string {
  const sign = z > 0 ? '+' : z < 0 ? '−' : '';
  return `${sign}${fmt(Math.abs(z), 1)}σ`;
}

/** "Dr. Elif Yılmaz" -> "Elif" */
export function firstName(id: CrewId): string {
  return CREW_BY_ID[id].name.replace(/^Dr\.\s*/, '').split(' ')[0];
}

/** "Dr. Elif Yılmaz" -> "EY" (avatar) */
export function initials(id: CrewId): string {
  const parts = CREW_BY_ID[id].name.replace(/^Dr\.\s*/, '').split(' ');
  return parts
    .map((p) => p.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export const LOCATION_TEXT = { KOKPIT: 'Orbit', GEZEGEN: 'Surface' } as const;
export const LOCATION_LONG = { KOKPIT: 'Mars orbit · IVA', GEZEGEN: 'Mars surface · EVA' } as const;

const domainOf = (key: MetricKey) => key.split('.')[0] as Domain;

/**
 * Bir alanın ekrandaki seviyesi: Katman 1'in en çok sapan ölçümlerindeki seviye ile alan skorunun
 * rengi (theme.scoreLevel) arasından kötü olanı. Vücut haritası ve sekme başlıkları bunu kullanır.
 */
export function domainLevel(status: CrewStatus | undefined, domain: Domain): Level | undefined {
  if (!status) return undefined;
  const fromSignals = status.topSignals.filter((s) => domainOf(s.key) === domain).map((s) => s.level);
  return worstLevel(scoreLevel(status.domainScores[domain]), ...fromSignals);
}

/** Tek bir ölçümün seviyesi (sadece Katman 1'in en çok sapan 3 ölçümünde biliniyor). */
export function signalLevel(status: CrewStatus | undefined, key: MetricKey): Level | undefined {
  return status?.topSignals.find((s) => s.key === key)?.level;
}

/** Ekip ortalaması: sağlık skoru olan kişilerin ortalaması. */
export function averageScore(statuses: Partial<Record<CrewId, CrewStatus>>, ids: CrewId[]): number | undefined {
  const scores = ids.map((id) => statuses[id]?.healthScore).filter((v): v is number => v !== undefined && v > 0);
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : undefined;
}
