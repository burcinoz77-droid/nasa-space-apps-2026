// Part 4 · Test scoring. CODE computes the scores (the language model does not).
import { PVT, SP_LEVELS, TLX_ITEMS, type TlxKey } from './instruments';

export type TlxRatings = Record<TlxKey, number>;

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Raw TLX: unweighted mean of the six subscales, 0–100 (Hart 2006). */
export function rawTlx(r: TlxRatings): number {
  const values = TLX_ITEMS.map((i) => r[i.key]);
  return round1(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Highest-scoring subscale: where most of the workload comes from. */
export function tlxHighest(r: TlxRatings): { key: TlxKey; ad: string; puan: number } {
  const top = TLX_ITEMS.reduce((best, i) => (r[i.key] > r[best.key] ? i : best), TLX_ITEMS[0]);
  return { key: top.key, ad: top.ad, puan: r[top.key] };
}

export function spLabel(puan: number): string {
  return SP_LEVELS.find((l) => l.puan === puan)?.tr ?? '';
}

export interface PvtScore {
  meanRt_ms: number; // mean of valid reactions (lapses included, false starts excluded)
  medianRt_ms: number;
  lapses: number; // reaction >= 355 ms (including an unanswered 30 s)
  falseStarts: number; // before the stimulus or a reaction shorter than 100 ms
  responses: number; // number of valid reactions
  speed: number; // mean response speed, 1/s (Basner: the PVT outcome most sensitive to sleep loss)
}

/** rts: reaction times to the stimulus (ms). falseStarts: number of presses before the stimulus. */
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
