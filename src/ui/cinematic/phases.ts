// Part 1 · Cinematic scene machine and shared constants.
import { useEffect, useRef, useState } from 'react';

/** To replay a cinematic: window.dispatchEvent(new CustomEvent(CINEMATIC_EVENT, { detail: scenarioId })) */
export const CINEMATIC_EVENT = 'astra:cinematic';

/**
 * Scene machine. Each scene has a [min, max] duration (ms): once the minimum has passed, it moves to the next scene
 * if the data condition (ready) is met, or when the maximum has passed. Then 'outro' and close.
 * This way the cinematic advances with live data but does not get stuck if the data is late.
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
  return `${m} min ${r} s`;
}

/** Starts the jury demo tour: window.dispatchEvent(new Event(DEMO_EVENT)) */
export const DEMO_EVENT = 'astra:demo';
/** Dispatched when a cinematic closes (the demo tour listens to move to the next one). */
export const CINEMATIC_END_EVENT = 'astra:cinematic-end';
/** Page change request: detail = page id (like 'kokpit'). App.tsx listens. */
export const NAVIGATE_EVENT = 'astra:navigate';
/** Opens the helmet visor: detail = astronaut id. */
export const VISOR_EVENT = 'astra:visor';

/** Current state of the cinematics and the demo tour (the visor's auto-open waits based on these). */
export const runtime = { cinematicPlaying: false, tourActive: false };
