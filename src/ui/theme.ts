// Renk sistemi (Sahibi: Parça 3). Renk = anlam. Başka dosyada renk kodu yazmayın, buradan alın.
// NASA-STD-3001 Cilt 2, Ek F (ekip ekranı standardı): renk süs için değil anlam içindir; uyarı kırmızı, dikkat sarı,
// bilgi mavi. Kırmızı yalnızca KRİTİK içindir (alarm yorgunluğu olmasın). Yazı/zemin kontrastı en az 6:1.
import type { Level } from '../types';

// Tema: NASA tarzı görev konsolu. Yan menü ve üst bant NASA amblem mavisi (#0B3D91), paneller koyu lacivert,
// yazı beyaz. Mavi tonları NASA Horizon Design System'in "NASA Blue" ailesinden türetildi.
export const COLORS = {
  bg: '#071B3F', // koyu lacivert zemin
  panel: '#0C2858', // konsol panelleri
  chrome: '#0B3D91', // NASA amblem mavisi: yan menü ve üst bant
  select: '#1A5BC4', // seçili sekme / kişi dolgusu (beyaz yazıyla 6,3:1)
  border: '#1E4C94',
  text: '#FFFFFF',
  textMuted: '#B9CBEA', // panel üstünde 8,8:1
  calm: '#6FB3FF', // bilgi mavisi: vurgu, bağlantı, seçili öğe çizgisi (panel üstünde 6,5:1)
  normal: '#4BDB8A', // yeşil: normal (HDS "Active Green")
  caution: '#FFD23F', // sarı: dikkat
  critical: '#FF8A80', // kırmızı yazı: kritik (panel üstünde 6:1)
  alarm: '#C8281D', // kırmızı dolgu: kritik ters video (beyaz yazıyla 5,6:1)
  ai: '#BBA6FF', // mor: ASTRA'nın (yapay zekâ) sesi; Katman 1 uyarılarından ayrılsın
  offline: '#9DB0CC', // gri-mavi: veri yok / bağlantı yok
} as const;

export const LEVEL_COLOR: Record<Level, string> = {
  normal: COLORS.normal,
  caution: COLORS.caution,
  critical: COLORS.critical,
};

// Renk körlüğü için renk tek başına anlam taşımaz: her seviyenin bir de yazısı ve simgesi var.
export const LEVEL_LABEL: Record<Level, string> = { normal: 'NOMINAL', caution: 'CAUTION', critical: 'WARNING' };
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

/** 36.8 -> "36.8", 1344 -> "1,344" ; İngilizce sayı biçimi (sadece ekranda). */
export function fmt(value: number | undefined, decimals = 0): string {
  if (value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
