// Part 4 · ASTRA's data memory. ONLY reads the shared state (useAstra) and keeps internally:
//  1) Personal baseline: mean and deviation of the first 30 readings for each astronaut × each metric (then frozen).
//     Layer 1 uses the same method; ASTRA keeps its own copy because it needs all 36 metrics.
//  2) Long history: one record every 5 readings, at most 72 records (about 60 hours of mission time).
// It remembers further back than the 120-reading short history on the screens (store.history).
// When "Reset simulation" empties the shared state, the memory is reset too.
import { CREW } from '../crew';
import { METRICS, readMetric, type MetricKey } from '../metrics';
import { SIM } from '../sim/parameters';
import { useAstra } from '../store';
import type { CrewId } from '../types';

export const BASELINE_TICKS = 30;
export const SAMPLE_EVERY = 5;
export const MAX_SAMPLES = 72;

/** One reading = how many minutes of mission time (demo time compression). */
export const MISSION_MIN_PER_TICK = (SIM as { missionMinutesPerTick?: number }).missionMinutesPerTick ?? 10;

interface Stat {
  n: number;
  mean: number;
  m2: number;
}
export interface MemorySample {
  tick: number;
  missionDay?: number;
  values: Partial<Record<CrewId, Record<string, number>>>;
}

let tick = 0;
let baseline: Partial<Record<CrewId, Record<string, Stat>>> = {};
let samples: MemorySample[] = [];

function reset() {
  tick = 0;
  baseline = {};
  samples = [];
}

function record(s: ReturnType<typeof useAstra.getState>) {
  tick++;
  const snapshot: MemorySample = { tick, missionDay: s.ship?.missionDay, values: {} };
  for (const c of CREW) {
    const t = s.telemetry[c.id];
    if (!t) continue;
    const values: Record<string, number> = {};
    const stats = (baseline[c.id] ??= {});
    for (const m of METRICS) {
      const v = readMetric(t, m.key);
      values[m.key] = v;
      if (tick <= BASELINE_TICKS) {
        // Welford: mean and deviation in a single pass
        const st = (stats[m.key] ??= { n: 0, mean: 0, m2: 0 });
        st.n++;
        const d = v - st.mean;
        st.mean += d / st.n;
        st.m2 += d * (v - st.mean);
      }
    }
    snapshot.values[c.id] = values;
  }
  if (tick % SAMPLE_EVERY === 0 || tick === 1) {
    samples.push(snapshot);
    if (samples.length > MAX_SAMPLES) samples.shift();
  }
}

let started = false;
/** Starts the memory (once). Called automatically when the src/ai modules load. */
export function startMemory() {
  if (started) return;
  started = true;
  useAstra.subscribe((s, prev) => {
    if (Object.keys(s.telemetry).length === 0) {
      if (tick) reset();
      return;
    }
    if (s.telemetry !== prev.telemetry) record(s);
  });
}
startMemory();

/** Is the personal baseline ready (are the first 30 readings in)? */
export function baselineReady(): boolean {
  return tick >= BASELINE_TICKS;
}

/** Personal baseline of a metric: mean and deviation. undefined if not ready. */
export function personalNormal(id: CrewId, key: MetricKey): { mean: number; sd: number } | undefined {
  const st = baseline[id]?.[key];
  if (!st || st.n < 5) return undefined;
  return { mean: st.mean, sd: st.n > 1 ? Math.sqrt(st.m2 / (st.n - 1)) : 0 };
}

/** Values of a metric from the long history (oldest to newest). */
export function longHistory(id: CrewId, key: MetricKey): number[] {
  return samples.map((x) => x.values[id]?.[key]).filter((v): v is number => typeof v === 'number');
}

/** Mission time covered by the long history (hours). */
export function longHistorySpanHours(): number {
  if (samples.length < 2) return 0;
  return ((samples[samples.length - 1].tick - samples[0].tick) * MISSION_MIN_PER_TICK) / 60;
}

/** For tests. */
export function resetMemory() {
  reset();
}
