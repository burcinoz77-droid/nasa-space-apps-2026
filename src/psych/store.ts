// Part 4 · Shared state of test results. The astronaut (the user on screen) takes the tests; ASTRA only reads.
// Mission time comes from the simulation's reading count: 1 reading = 10 min of mission time (loop.ts calls advance on every reading).
// Results are reset together with the simulation (on page reload or with "Reset").
import { create } from 'zustand';
import { SIM } from '../sim/parameters';
import type { CrewId, Telemetry } from '../types';
import type { TestKind, TlxKey } from './instruments';
import type { PvtScore } from './scoring';

interface ResultBase {
  id: string;
  crewId: CrewId;
  tick: number; // mission time (reading count)
  at: number; // wall-clock time (Date.now)
}
export interface SpResult extends ResultBase {
  kind: 'SP';
  puan: number; // 1–7
}
export interface TlxResult extends ResultBase {
  kind: 'TLX';
  ratings: Record<TlxKey, number>;
  raw: number; // Raw TLX, 0–100
}
export interface PvtResult extends ResultBase, PvtScore {
  kind: 'PVT';
  demo: boolean; // 30 s trial: not a valid PVT-B, does not go to Layer 1
  durationS: number;
}
export type TestResult = SpResult | TlxResult | PvtResult;
export type NewResult = Omit<SpResult, keyof ResultBase> | Omit<TlxResult, keyof ResultBase> | Omit<PvtResult, keyof ResultBase>;

export const MIN_PER_TICK = SIM.missionMinutesPerTick;
export const DAY_TICKS = Math.round((24 * 60) / MIN_PER_TICK);
/** A measured PVT result replaces the simulated value for this long (assumption: 1 mission day, PVT is a daily metric). */
export const PVT_HOLD_TICKS = DAY_TICKS;

interface TestsState {
  tick: number;
  results: TestResult[]; // newest last
  add(r: NewResult, crewId: CrewId): TestResult;
  advance(): void;
  clear(): void;
}

let seq = 0;

export const useTests = create<TestsState>()((set, get) => ({
  tick: 0,
  results: [],
  add: (r, crewId) => {
    const full = { ...r, id: `test-${Date.now()}-${++seq}`, crewId, tick: get().tick, at: Date.now() } as TestResult;
    set((s) => ({ results: [...s.results, full].slice(-300) }));
    return full;
  },
  advance: () => set((s) => ({ tick: s.tick + 1 })),
  clear: () => set({ tick: 0, results: [] }),
}));

/** One person's results in one test, newest first. Trial (demo) PVTs excluded. */
export function resultsOf<K extends TestKind>(crewId: CrewId, kind: K, all: TestResult[] = useTests.getState().results): Extract<TestResult, { kind: K }>[] {
  return all.filter((r): r is Extract<TestResult, { kind: K }> => r.crewId === crewId && r.kind === kind && !(r.kind === 'PVT' && r.demo)).reverse();
}

/** The measured PVT result currently sent to Layer 1 (if any). */
export function activePvt(crewId: CrewId, s = useTests.getState()): PvtResult | undefined {
  const last = resultsOf(crewId, 'PVT', s.results)[0];
  return last && s.tick - last.tick < PVT_HOLD_TICKS ? last : undefined;
}

/**
 * loop.ts calls this on every reading: the PVT-B result the astronaut took is written to telemetry in place of the simulated PVT value.
 * This way Layer 1 (Part 2) compares the real test result with the personal baseline and raises an alert if needed.
 */
export function applyTestResults(telemetry: Telemetry[]): void {
  const s = useTests.getState();
  s.advance();
  for (const t of telemetry) {
    const pvt = activePvt(t.crewId);
    if (!pvt) continue;
    t.cog.pvtMeanRt_ms = pvt.meanRt_ms;
    t.cog.pvtLapses = pvt.lapses;
  }
}

/** Mission-time text like "3 h 20 min ago". */
export function missionAgo(tick: number, now = useTests.getState().tick): string {
  const min = Math.max(0, now - tick) * MIN_PER_TICK;
  if (min < 10) return 'just now';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h >= 48) return `${Math.floor(h / 24)} mission days ago`;
  return `${h ? `${h} h ` : ''}${m ? `${m} min ` : ''}ago`.replace('  ', ' ');
}

/** Age in mission time (for ASTRA's data). */
export function hoursAgo(tick: number, now = useTests.getState().tick): number {
  return Math.round(((now - tick) * MIN_PER_TICK) / 6) / 10;
}
