// Parça 1 · Senaryo biçimi ve yükleyici.
// Her senaryo src/sim/scenarios/ içinde bir JSON dosyasıdır; yeni senaryo eklemek = yeni JSON.
// Tick sayıları senaryonun başladığı andan itibaren sayılır (1 tick = 1 ölçüm = SIM.missionMinutesPerTick dk görev süresi).
import type { MetricKey } from '../metrics';
import type { CrewId, CrewLocation, ScenarioId } from '../types';
import type { CrewTraits } from './parameters';

export type TraitKey = Exclude<keyof CrewTraits, 'offsets'>;

/** Bir ölçümün hedefini zamanla değiştiren etki. to / add / mul'dan tam olarak biri yazılır. */
export interface ScenarioEffect {
  metric: MetricKey;
  crew: 'ALL' | CrewLocation | CrewId[];
  to?: number; // hedefi bu mutlak değere taşı
  add?: number; // hedefe bunu ekle
  mul?: number; // hedefi kişisel baseline × mul yap
  startTick?: number; // varsayılan 0
  rampTicks?: number; // tam etkiye kaç ölçümde ulaşır (varsayılan 1)
  endTick?: number; // bu ölçümden sonra etki kalkar; değer baseline'a yumuşakça döner
  trait?: TraitKey; // etkinin büyüklüğü kişisel hassasiyetle çarpılır (örn. Kerem co2Response = 2)
}

export interface ScenarioEvent {
  atTick: number;
  untilTick?: number; // yoksa senaryo bitene kadar ekranda kalır
  type: string; // 'SPE_ONSET' gibi kod
  text: string; // ekranda görünen Türkçe bilgi (ship.activeEvents'e yazılır)
}

export interface ScenarioDef {
  id: ScenarioId;
  name: string;
  seed: number; // senaryo başlayınca gürültü bu seed'le yeniden kurulur: demo her seferinde aynı
  source?: string;
  note?: string;
  events: ScenarioEvent[];
  effects: ScenarioEffect[];
}

const files = import.meta.glob<{ default: ScenarioDef }>('./scenarios/*.json', { eager: true });

export const SCENARIOS: Partial<Record<ScenarioId, ScenarioDef>> = Object.fromEntries(
  Object.values(files).map((m) => [m.default.id, m.default]),
);

/** Etki bu astronotu kapsıyor mu? */
export function appliesTo(effect: ScenarioEffect, crewId: CrewId, location: CrewLocation): boolean {
  if (effect.crew === 'ALL') return true;
  if (Array.isArray(effect.crew)) return effect.crew.includes(crewId);
  return effect.crew === location;
}

/** Etkinin bu andaki gücü: 0 (yok) → 1 (tam). */
export function effectFraction(effect: ScenarioEffect, elapsed: number): number {
  const start = effect.startTick ?? 0;
  if (elapsed < start) return 0;
  if (effect.endTick !== undefined && elapsed >= effect.endTick) return 0;
  const ramp = Math.max(1, effect.rampTicks ?? 1);
  return Math.min(1, (elapsed - start + 1) / ramp);
}

/** Etkinin baseline'a eklediği fark (tam güçte, hassasiyetle çarpılmış). */
export function effectDelta(effect: ScenarioEffect, base: number, traits: CrewTraits): number {
  const k = effect.trait ? traits[effect.trait] : 1;
  if (effect.to !== undefined) return (effect.to - base) * k;
  if (effect.add !== undefined) return effect.add * k;
  if (effect.mul !== undefined) return base * (effect.mul - 1) * k;
  return 0;
}
