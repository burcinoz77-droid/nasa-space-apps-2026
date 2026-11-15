// Parça 4 · Test puanlama. Puanları KOD hesaplar (dil modeli hesaplamaz).
import { PVT, SP_LEVELS, TLX_ITEMS, type TlxKey } from './instruments';

export type TlxRatings = Record<TlxKey, number>;

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Raw TLX: altı alt ölçeğin ağırlıksız ortalaması, 0–100 (Hart 2006). */
export function rawTlx(r: TlxRatings): number {
  const values = TLX_ITEMS.map((i) => r[i.key]);
  return round1(values.reduce((a, b) => a + b, 0) / values.length);
}

/** En yüksek puanlı alt ölçek: iş yükünün en çok nereden geldiği. */
export function tlxHighest(r: TlxRatings): { key: TlxKey; ad: string; puan: number } {
  const top = TLX_ITEMS.reduce((best, i) => (r[i.key] > r[best.key] ? i : best), TLX_ITEMS[0]);
  return { key: top.key, ad: top.ad, puan: r[top.key] };
}

export function spLabel(puan: number): string {
  return SP_LEVELS.find((l) => l.puan === puan)?.tr ?? '';
}

export interface PvtScore {
  meanRt_ms: number; // geçerli tepkilerin ortalaması (dikkat kayıpları dahil, erken basmalar hariç)
  medianRt_ms: number;
  lapses: number; // tepki >= 355 ms (yanıtsız kalan 30 sn de dahil)
  falseStarts: number; // uyarandan önce ya da 100 ms'den kısa tepki
  responses: number; // geçerli tepki sayısı
  speed: number; // ortalama tepki hızı, 1/sn (Basner: uykusuzluğa en duyarlı PVT çıktısı)
}

/** rts: uyarana verilen tepki süreleri (ms). falseStarts: uyarandan önce basma sayısı. */
export function scorePvt(rts: number[], falseStartsBefore: number): PvtScore {
  const tooFast = rts.filter((rt) => rt < PVT.falseStartMs).length;
  const valid = rts.filter((rt) => rt >= PVT.falseStartMs);
  const n = valid.length;
  const sorted = [...valid].sort((a, b) => a - b);
  const mean = n ? valid.reduce((a, b) => a + b, 0) / n : 0;
  const median = n ? (n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2) : 0;
  const speed = n ? valid.reduce((a, rt) => a + 1000 / rt, 0) / n : 0;
  return {
    meanRt_ms: Math.round(mean),
    medianRt_ms: Math.round(median),
    lapses: valid.filter((rt) => rt >= PVT.lapseMs).length,
    falseStarts: falseStartsBefore + tooFast,
    responses: n,
    speed: Math.round(speed * 100) / 100,
  };
}
