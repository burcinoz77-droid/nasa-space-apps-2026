// Renk sistemi (Sahibi: Parça 3). Renk = anlam. Başka dosyada renk kodu yazmayın, buradan alın.
// Kırmızı yalnızca KRİTİK içindir; dekorasyon için kullanılmaz (alarm yorgunluğu olmasın).
import type { Level } from '../types';

export const COLORS = {
  bg: '#070B1A', // derin lacivert: karanlık kabinde göz yormaz
  panel: '#0E1530',
  border: '#1E2A4A',
  text: '#E6EDF7',
  textMuted: '#8EA0C0',
  calm: '#38BDF8', // mavi: sakin, bilgi, ana vurgu
  normal: '#34D399', // yeşil: güvenli
  caution: '#FBBF24', // amber: dikkat, izlenmeli
  critical: '#F87171', // kırmızı: acil, hemen eylem
  ai: '#A78BFA', // mor: ASTRA'nın (yapay zekâ) sesi; Katman 1 uyarılarından ayrılsın
  offline: '#94A3B8', // gri: veri yok / bağlantı yok
} as const;

export const LEVEL_COLOR: Record<Level, string> = {
  normal: COLORS.normal,
  caution: COLORS.caution,
  critical: COLORS.critical,
};

// Renk körlüğü için renk tek başına anlam taşımaz: her seviyenin bir de yazısı ve simgesi var.
export const LEVEL_LABEL: Record<Level, string> = { normal: 'NORMAL', caution: 'DİKKAT', critical: 'KRİTİK' };
export const LEVEL_ICON: Record<Level, string> = { normal: '●', caution: '▲', critical: '■' };

/** 36.8 -> "36,8" ; Türkçe sayı biçimi (sadece ekranda). */
export function fmt(value: number | undefined, decimals = 0): string {
  if (value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
