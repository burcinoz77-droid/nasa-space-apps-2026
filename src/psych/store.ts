// Parça 4 · Test sonuçlarının ortak durumu. Testleri astronot (ekrandaki kullanıcı) yapar; ASTRA sadece okur.
// Görev saati, simülasyonun ölçüm sayısından gelir: 1 ölçüm = 10 dk görev süresi (loop.ts her ölçümde advance çağırır).
// Sonuçlar simülasyonla birlikte sıfırlanır (sayfa yenilenince ya da "Sıfırla" ile).
import { create } from 'zustand';
import { SIM } from '../sim/parameters';
import type { CrewId, Telemetry } from '../types';
import type { TestKind, TlxKey } from './instruments';
import type { PvtScore } from './scoring';

interface ResultBase {
  id: string;
  crewId: CrewId;
  tick: number; // görev saati (ölçüm sayısı)
  at: number; // gerçek saat (Date.now)
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
  demo: boolean; // 30 sn deneme: geçerli PVT-B değildir, Katman 1'e gitmez
  durationS: number;
}
export type TestResult = SpResult | TlxResult | PvtResult;
export type NewResult = Omit<SpResult, keyof ResultBase> | Omit<TlxResult, keyof ResultBase> | Omit<PvtResult, keyof ResultBase>;

export const MIN_PER_TICK = SIM.missionMinutesPerTick;
export const DAY_TICKS = Math.round((24 * 60) / MIN_PER_TICK);
/** Ölçülen PVT sonucu bu kadar süre simüle değerin yerine geçer (varsayım: 1 görev günü, PVT günlük ölçümdür). */
export const PVT_HOLD_TICKS = DAY_TICKS;

interface TestsState {
  tick: number;
  results: TestResult[]; // en yeni sonda
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

/** Bir kişinin bir testteki sonuçları, en yeni başta. Deneme (demo) PVT'ler hariç. */
export function resultsOf<K extends TestKind>(crewId: CrewId, kind: K, all: TestResult[] = useTests.getState().results): Extract<TestResult, { kind: K }>[] {
  return all.filter((r): r is Extract<TestResult, { kind: K }> => r.crewId === crewId && r.kind === kind && !(r.kind === 'PVT' && r.demo)).reverse();
}

/** Şu an Katman 1'e giden ölçülmüş PVT sonucu (varsa). */
export function activePvt(crewId: CrewId, s = useTests.getState()): PvtResult | undefined {
  const last = resultsOf(crewId, 'PVT', s.results)[0];
  return last && s.tick - last.tick < PVT_HOLD_TICKS ? last : undefined;
}

/**
 * loop.ts her ölçümde çağırır: astronotun yaptığı PVT-B sonucu, simüle PVT değerinin yerine telemetriye yazılır.
 * Böylece Katman 1 (Parça 2) gerçek test sonucunu kişisel normaliyle karşılaştırır ve gerekirse uyarı açar.
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

/** "3 sa 20 dk önce" gibi görev süresi metni. */
export function missionAgo(tick: number, now = useTests.getState().tick): string {
  const min = Math.max(0, now - tick) * MIN_PER_TICK;
  if (min < 10) return 'az önce';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h >= 48) return `${Math.floor(h / 24)} görev günü önce`;
  return `${h ? `${h} sa ` : ''}${m ? `${m} dk ` : ''}önce`.replace('  ', ' ');
}

/** Görev saati cinsinden yaş (ASTRA verisi için). */
export function hoursAgo(tick: number, now = useTests.getState().tick): number {
  return Math.round(((now - tick) * MIN_PER_TICK) / 6) / 10;
}
