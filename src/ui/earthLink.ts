// Parça 3 · Ana istasyon (Dünya) bağlantısı ve revir durumu: Elif'in uçuş cerrahıyla yazışması, ilaç stoku,
// cerrahın verdiği teşhis ve tedavi talimatları. Arayüzün kendi durumudur; ortak durumu (useAstra) sadece okur.
//
// Gecikme gerçekçi: mesaj Dünya'ya ship.commDelayOneWay_s sonra ulaşır, cerrah okuyup yazar, yanıt aynı gecikmeyle
// döner. Süreler görev saatiyle sayılır; simülasyon hızlandırılmış olduğu için (1 ölçüm = 10 dk görev süresi,
// SIM.missionMinutesPerTick) ekranda saniyeler içinde gerçekleşir.
import { create } from 'zustand';
import { CREW_BY_ID } from '../crew';
import { SIM } from '../sim/parameters';
import { useAstra } from '../store';
import type { CrewId, Incident, IncidentType } from '../types';
import { DOCTOR_REPLIES, DOCTOR_REVIEW_S, GROUND, MED_KIT, type MedId } from './medical';

export type Topic = IncidentType | 'NONE';

export interface CrewMessage {
  kind: 'crew';
  id: string;
  text: string;
  at: number; // gönderildiği an (ms)
  crewId?: CrewId; // mesajın konusu olan astronot
  topic: Topic;
  delayS: number; // tek yön gecikme, görev saniyesi
  arriveAt: number; // Dünya'ya ulaştığı an (ms)
  replyAt: number; // yanıtın gemiye ulaştığı an (ms)
}

export interface GroundMessage {
  kind: 'ground';
  id: string;
  text: string;
  at: number;
  crewId?: CrewId;
  topic?: Topic;
  diagnosis?: string;
  med?: MedId;
  replyTo?: string;
  applied?: boolean; // talimat uygulandı mı (ilaç stoktan düşer)
}

export type EarthMessage = CrewMessage | GroundMessage;

const MISSION_S_PER_TICK = SIM.missionMinutesPerTick * 60;

/** Görev saniyesi -> gerçek milisaniye (simülasyonun o anki hızıyla). */
export function missionToRealMs(missionS: number): number {
  return (missionS / MISSION_S_PER_TICK) * useAstra.getState().tickMs;
}

/** Gerçek milisaniye -> görev saniyesi. */
export function realToMissionS(ms: number): number {
  return (ms / useAstra.getState().tickMs) * MISSION_S_PER_TICK;
}

const RANK = { critical: 2, caution: 1 } as const;

/** Bir astronotun en ağır (eşitse en yeni) açık olayı. */
export function worstIncidentOf(incidents: Incident[], crewId: CrewId): Incident | undefined {
  return incidents
    .filter((i) => i.status !== 'resolved' && i.crewIds.includes(crewId))
    .sort((a, b) => RANK[b.level] - RANK[a.level] || b.openedAt - a.openedAt)[0];
}

const fullStock = () => Object.fromEntries(MED_KIT.map((m) => [m.id, m.stock])) as Record<MedId, number>;
const welcome = (): GroundMessage => ({
  kind: 'ground',
  id: 'hosgeldin',
  text: `İletişim penceresi açık. ${GROUND.role} ${GROUND.name} nöbette; mesajlar Dünya'ya gecikmeyle ulaşır. (Yer ekibi yanıtları senaryo için üretilir.)`,
  at: Date.now(),
});

const timers = new Set<ReturnType<typeof setTimeout>>();
const later = (fn: () => void, ms: number) => {
  const id = setTimeout(() => {
    timers.delete(id);
    fn();
  }, ms);
  timers.add(id);
};

interface EarthState {
  messages: EarthMessage[];
  stock: Record<MedId, number>;
  send(text: string, crewId?: CrewId): void;
  applyOrder(messageId: string): void;
  reset(): void;
}

export const useEarth = create<EarthState>()((set, get) => ({
  messages: [welcome()],
  stock: fullStock(),

  send(text, crewId) {
    const body = text.trim().slice(0, 600);
    if (!body) return;
    const { ship, incidents } = useAstra.getState();
    const delayS = ship?.commDelayOneWay_s ?? 750;
    const topic: Topic = (crewId && worstIncidentOf(incidents, crewId)?.type) || 'NONE';
    const now = Date.now();
    const oneWay = missionToRealMs(delayS);
    const msg: CrewMessage = {
      kind: 'crew',
      id: crypto.randomUUID(),
      text: body,
      at: now,
      crewId,
      topic,
      delayS,
      arriveAt: now + oneWay,
      replyAt: now + 2 * oneWay + missionToRealMs(DOCTOR_REVIEW_S),
    };
    set((s) => ({ messages: [...s.messages, msg].slice(-60) }));

    later(() => {
      const r = DOCTOR_REPLIES[topic];
      const who = crewId ? CREW_BY_ID[crewId].name.replace(/^Dr\.\s*/, '').split(' ')[0] : undefined;
      const reply: GroundMessage = {
        kind: 'ground',
        id: crypto.randomUUID(),
        text: who && topic !== 'NONE' ? `${who} için: ${r.order}` : r.order,
        at: Date.now(),
        crewId,
        topic,
        diagnosis: topic === 'NONE' ? undefined : r.diagnosis,
        med: r.med,
        replyTo: msg.id,
      };
      set((s) => ({ messages: [...s.messages, reply].slice(-60) }));
    }, msg.replyAt - now);
  },

  applyOrder(messageId) {
    const m = get().messages.find((x) => x.id === messageId);
    if (!m || m.kind !== 'ground' || m.applied) return;
    set((s) => ({
      messages: s.messages.map((x) => (x.id === messageId ? { ...x, applied: true } : x)),
      stock: m.med ? { ...s.stock, [m.med]: Math.max(0, s.stock[m.med] - 1) } : s.stock,
    }));
  },

  reset() {
    for (const id of timers) clearTimeout(id);
    timers.clear();
    set({ messages: [welcome()], stock: fullStock() });
  },
}));

// Simülasyon sıfırlanınca (ship = null) yazışma ve stok da başa döner.
useAstra.subscribe((s, prev) => {
  if (prev.ship && !s.ship) useEarth.getState().reset();
});
