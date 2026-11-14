// Parça 4 · Katman 2'nin ortak Türkçe etiketleri ve küçük yardımcıları.
// Hem modele giden veri özeti (context.ts) hem yedek mod (fallback.ts) hem de
// ASTRA bileşenleri bunları kullanır; böylece ekranda ve cevaplarda aynı kelimeler geçer.
import { CREW_BY_ID } from '../crew';
import { METRIC_BY_KEY, type MetricKey } from '../metrics';
import { fmt } from '../ui/theme';
import type { AstraAnswer, AutoActionType, CrewId, IncidentType, Level, ScenarioId } from '../types';

export const SOURCE_LABEL: Record<AstraAnswer['source'], string> = {
  gemini: 'Gemini',
  claude: 'Claude',
  fallback: 'Yedek mod · çevrimdışı',
  cache: 'Önbellekten',
};

export const LEVEL_TR: Record<Level, string> = { normal: 'normal', caution: 'dikkat', critical: 'kritik' };

export const SCENARIO_TR: Record<ScenarioId, string> = {
  NORMAL: 'Normal gün',
  SOLAR_STORM: 'Güneş fırtınası',
  MARS_DAY_180: 'Mars 180. gün yükü',
  CO2_SCRUBBER_FAIL: 'CO₂ temizleyici arızası',
  EVA_OVEREXERTION: 'EVA aşırı efor',
};

export const INCIDENT_TR: Record<IncidentType, string> = {
  RADIATION: 'Radyasyon',
  CO2: 'Kabin CO₂',
  CARDIO: 'Kalp ritmi',
  HYPOXIA: 'Oksijen doygunluğu',
  THERMAL: 'Vücut sıcaklığı',
  FATIGUE: 'Yorgunluk',
  STRESS: 'Stres',
  MULTI: 'Çoklu sapma',
};

/** Otonom adımın "yapıldı" hâli (olay açıklamalarında). */
export const ACTION_DONE_TR: Record<AutoActionType, string> = {
  RADIATION_SHELTER: 'Radyasyon sığınağına geçiş otomatik başlatıldı',
  INCREASE_VENTILATION: 'Havalandırma otomatik artırıldı',
  MANDATORY_REST: 'Zorunlu dinlenme otomatik verildi',
};

/** Otonom adımın kısa adı (veri özetinde). */
export const ACTION_TR: Record<AutoActionType, string> = {
  RADIATION_SHELTER: 'radyasyon sığınağına geçiş',
  INCREASE_VENTILATION: 'havalandırmayı artırma',
  MANDATORY_REST: 'zorunlu dinlenme',
};

/** 'kerem' -> 'Kerem'. Mürettebata ilk adıyla hitap edilir (Muhammed Emir -> Emir). */
export function shortName(id: CrewId): string {
  return id.charAt(0).toLocaleUpperCase('tr-TR') + id.slice(1);
}

export function fullName(id: CrewId): string {
  return CREW_BY_ID[id]?.name ?? shortName(id);
}

/** Sorudaki astronot adlarını bulur: "Kerem'in nabzı" -> ['kerem']. */
export function crewInText(text: string): CrewId[] {
  const q = text.toLocaleLowerCase('tr-TR');
  return (Object.keys(CREW_BY_ID) as CrewId[]).filter((id) => new RegExp(`(^|[^a-zçğıöşü])${id}`).test(q));
}

/** Bir ölçümü birimiyle ekrandaki biçimde yazar: 36,8 °C · %98 · 25/100 · 3 adet. */
export function valueText(key: MetricKey, value: number): string {
  const m = METRIC_BY_KEY[key];
  if (!m) return fmt(value, 1);
  const v = fmt(value, m.decimals);
  if (m.unit === '%') return `%${v}`;
  if (m.unit.startsWith('/')) return `${v}${m.unit}`;
  return `${v} ${m.unit}`;
}

/** Saniyeyi "12 dk 30 sn" biçimine çevirir. */
export function delayText(seconds: number): string {
  const total = Math.round(seconds);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return sec ? `${min} dk ${sec} sn` : `${min} dk`;
}
