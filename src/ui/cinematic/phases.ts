// Parça 1 · Sinematik sahne makinesi ve ortak sabitler.
import { useEffect, useRef, useState } from 'react';

/** Sinematiği tekrar oynatmak için: window.dispatchEvent(new CustomEvent(CINEMATIC_EVENT, { detail: scenarioId })) */
export const CINEMATIC_EVENT = 'astra:cinematic';

/**
 * Sahne makinesi. Her sahnenin [en az, en çok] süresi (ms) var: en az süre dolunca veri koşulu
 * (ready) sağlanmışsa ya da en çok süre dolmuşsa sıradaki sahneye geçilir. Sonra 'outro' ve kapanış.
 * Böylece sinematik canlı veriyle ilerler ama veri gecikse de takılmaz.
 */
export function usePhases<P extends string>(order: readonly P[], limits: Record<P, [number, number]>, ready: (p: P) => boolean, onClose: () => void): P | 'outro' {
  const [index, setIndex] = useState(0);
  const start = useRef(0);
  const readyRef = useRef(ready);
  useEffect(() => {
    readyRef.current = ready;
  });
  useEffect(() => {
    start.current = performance.now();
  }, [index]);
  const done = index >= order.length;
  useEffect(() => {
    if (done) {
      const id = setTimeout(onClose, 1200);
      return () => clearTimeout(id);
    }
    const id = setInterval(() => {
      const p = order[index];
      const t = performance.now() - start.current;
      const [min, max] = limits[p];
      if (t >= min && (readyRef.current(p) || t >= max)) setIndex((i) => i + 1);
    }, 150);
    return () => clearInterval(id);
  }, [index, done, order, limits, onClose]);
  return done ? 'outro' : order[index];
}

export function fmtMinSec(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m} dk ${r} sn`;
}
