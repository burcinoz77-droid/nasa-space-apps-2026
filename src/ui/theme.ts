// Renk sistemi (Sahibi: Parça 3). Renk = anlam. Başka dosyada renk kodu yazmayın, buradan alın.
// Kırmızı yalnızca KRİTİK içindir; dekorasyon için kullanılmaz (alarm yorgunluğu olmasın).
// Uyarı renkleri havacılıktaki kuralla aynı: uyarı kırmızı, ikaz amber (14 CFR 25.1322).
import type { Level } from '../types';

// Tema: canlı okyanus mavisi. Zemin siyah değil koyu mavi; paneller bir ton açık; vurgu parlak gök mavisi.
// Projeksiyonda soluk görünmesin diye zemin eskisinden belirgin şekilde açık (kontrast yine WCAG AA üstü).
export const COLORS = {
  bg: '#0C2547', // koyu okyanus mavisi zemin
  panel: '#14396B', // paneller: zeminden bir ton açık mavi
  border: '#2C5A92',
  text: '#F3F8FF',
  textMuted: '#A8C2E6',
  calm: '#4FC3FF', // parlak gök mavisi: ana vurgu, seçili öğe, bilgi
  normal: '#3EE0A1', // yeşil: güvenli
  caution: '#FFC53D', // amber: dikkat, izlenmeli
  critical: '#FF6B6B', // kırmızı: acil, hemen eylem
  ai: '#B9A2FF', // mor: ASTRA'nın (yapay zekâ) sesi; Katman 1 uyarılarından ayrılsın
  offline: '#9DB0CC', // gri-mavi: veri yok / bağlantı yok
} as const;

export const LEVEL_COLOR: Record<Level, string> = {
  normal: COLORS.normal,
  caution: COLORS.caution,
  critical: COLORS.critical,
};

// Renk körlüğü için renk tek başına anlam taşımaz: her seviyenin bir de yazısı ve simgesi var.
export const LEVEL_LABEL: Record<Level, string> = { normal: 'NORMAL', caution: 'DİKKAT', critical: 'KRİTİK' };
export const LEVEL_ICON: Record<Level, string> = { normal: '●', caution: '▲', critical: '■' };

const LEVEL_RANK: Record<Level, number> = { normal: 0, caution: 1, critical: 2 };

/** İki seviyeden kötü olanı. */
export function worstLevel(...levels: (Level | undefined)[]): Level {
  let out: Level = 'normal';
  for (const l of levels) if (l && LEVEL_RANK[l] > LEVEL_RANK[out]) out = l;
  return out;
}

/**
 * Alan skorunu (0–100) ekranda renge çevirir. Katman 1 alan skoru = 100 − 12 × Σ max(0, riskZ − 1).
 * Eşikler simülasyonda ölçüldü: Normal günde 5 dakika boyunca hiçbir alan 88'in altına inmedi,
 * bu yüzden 85 altı DİKKAT, 60 altı KRİTİK (yanlış alarm yok). Asıl uyarıyı yine Katman 1 açar.
 */
export const SCORE_CAUTION_BELOW = 85;
export const SCORE_CRITICAL_BELOW = 60;
export function scoreLevel(score: number | undefined): Level | undefined {
  if (score === undefined || Number.isNaN(score)) return undefined;
  if (score < SCORE_CRITICAL_BELOW) return 'critical';
  if (score < SCORE_CAUTION_BELOW) return 'caution';
  return 'normal';
}

/** Saydam renk: hex + alfa (0–1). Arka plan ve parıltı için. */
export function alpha(hex: string, a: number): string {
  const v = Math.round(Math.min(1, Math.max(0, a)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${v}`;
}

/** 36.8 -> "36,8" ; Türkçe sayı biçimi (sadece ekranda). */
export function fmt(value: number | undefined, decimals = 0): string {
  if (value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
