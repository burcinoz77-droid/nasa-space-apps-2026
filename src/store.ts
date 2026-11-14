// Ortak durum (Zustand). Ekranlar buradan OKUR. Yazan tek yer loop.ts ve
// Katman 2'nin explanations/chat alanları. Katman 2 telemetri ve olaylara YAZAMAZ.
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

export const HISTORY_LENGTH = 120; // grafikler için astronot başına son 120 ölçüm

export interface AstraState {
  ship: ShipState | null;
  telemetry: Partial<Record<CrewId, Telemetry>>;
  history: Partial<Record<CrewId, Telemetry[]>>;
  statuses: Partial<Record<CrewId, CrewStatus>>;
  incidents: Incident[];
  ledger: LedgerEntry[]; // en yeni başta
  tickMs: number; // 800 | 1200 | 2500 (Ayarlar sayfası)
  // Katman 2 alanları (sadece src/ai/ yazar)
  explanations: Record<string, AstraAnswer>; // incidentId -> ASTRA açıklaması
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
