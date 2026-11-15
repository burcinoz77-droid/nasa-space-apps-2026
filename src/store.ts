// Shared state (Zustand). Screens READ from here. The only writers are loop.ts and
// Layer 2's explanations/chat fields. Layer 2 CANNOT write to telemetry or incidents.
import { create } from 'zustand';
import type {
  AstraAnswer,
  ChatMessage,
  CrewId,
  CrewStatus,
  DetectorOutput,
  Incident,
  LedgerEntry,
  ShipState,
  Telemetry,
} from './types';

export const HISTORY_LENGTH = 120; // last 120 readings per astronaut for the charts

export interface AstraState {
  ship: ShipState | null;
  telemetry: Partial<Record<CrewId, Telemetry>>;
  history: Partial<Record<CrewId, Telemetry[]>>;
  statuses: Partial<Record<CrewId, CrewStatus>>;
  incidents: Incident[];
  ledger: LedgerEntry[]; // newest first
  tickMs: number; // 800 | 1200 | 2500 (Settings page)
  // Layer 2 fields (only src/ai/ writes)
  explanations: Record<string, AstraAnswer>; // incidentId -> ASTRA explanation
  chat: ChatMessage[];

  applyTick(ship: ShipState, telemetry: Telemetry[], out: DetectorOutput): void;
  addLedger(entries: LedgerEntry[]): void;
  setTickMs(ms: number): void;
  setExplanation(incidentId: string, answer: AstraAnswer): void;
  addChat(message: ChatMessage): void;
  clearAll(): void;
}

export const useAstra = create<AstraState>()((set) => ({
  ship: null,
  telemetry: {},
  history: {},
  statuses: {},
  incidents: [],
  ledger: [],
  tickMs: 1200,
  explanations: {},
  chat: [],

  applyTick: (ship, telemetry, out) =>
    set((s) => {
      const latest = { ...s.telemetry };
      const history = { ...s.history };
      for (const t of telemetry) {
        latest[t.crewId] = t;
        history[t.crewId] = [...(history[t.crewId] ?? []), t].slice(-HISTORY_LENGTH);
      }
      return {
        ship,
        telemetry: latest,
        history,
        statuses: out.statuses,
        incidents: out.incidents,
        ledger: out.newLedger.length ? [...[...out.newLedger].reverse(), ...s.ledger].slice(0, 500) : s.ledger,
      };
    }),
  addLedger: (entries) => set((s) => ({ ledger: [...[...entries].reverse(), ...s.ledger].slice(0, 500) })),
  setTickMs: (ms) => set({ tickMs: ms }),
  setExplanation: (incidentId, answer) => set((s) => ({ explanations: { ...s.explanations, [incidentId]: answer } })),
  addChat: (message) => set((s) => ({ chat: [...s.chat, message].slice(-50) })),
  clearAll: () => set({ ship: null, telemetry: {}, history: {}, statuses: {}, incidents: [], ledger: [], explanations: {}, chat: [] }),
}));
