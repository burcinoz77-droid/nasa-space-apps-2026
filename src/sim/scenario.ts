// Part 1 · Scenario format and loader.
// Each scenario is a JSON file in src/sim/scenarios/; adding a scenario = adding a JSON file.
// Tick counts start when the scenario starts (1 tick = 1 reading = SIM.missionMinutesPerTick min of mission time).
import type { MetricKey } from '../metrics';
import type { CrewId, CrewLocation, ScenarioId } from '../types';
import type { CrewTraits } from './parameters';

export type TraitKey = Exclude<keyof CrewTraits, 'offsets'>;

/** An effect that changes a metric's target over time. Exactly one of to / add / mul is given. */
export interface ScenarioEffect {
  metric: MetricKey;
  crew: 'ALL' | CrewLocation | CrewId[];
  to?: number; // move the target to this absolute value
  add?: number; // add this to the target
  mul?: number; // set the target to personal baseline × mul
  startTick?: number; // default 0
  rampTicks?: number; // over how many readings it reaches full effect (default 1)
  endTick?: number; // the effect is removed after this reading; the value eases back to baseline
  trait?: TraitKey; // the size of the effect is multiplied by the personal sensitivity (e.g. Kerem co2Response = 2)
  followsCO2?: boolean; // the effect is proportional to how far cabin CO₂ has risen (symptoms ease when ventilation increases)
}

export interface ScenarioEvent {
  atTick: number;
  untilTick?: number; // otherwise stays on screen until the scenario ends
  type: string; // code like 'SPE_ONSET'
  text: string; // information text shown on screen (written to ship.activeEvents)
  utc?: string; // time of the real event (DONKI)
  url?: string; // DONKI record of the real event
}

export interface ScenarioDef {
  id: ScenarioId;
  name: string;
  seed: number; // when the scenario starts, the noise is re-seeded with this seed: the demo is the same every time
  source?: string;
  note?: string;
  events: ScenarioEvent[];
  effects: ScenarioEffect[];
}

const files = import.meta.glob<{ default: ScenarioDef }>('./scenarios/*.json', { eager: true });

export const SCENARIOS: Partial<Record<ScenarioId, ScenarioDef>> = Object.fromEntries(
  Object.values(files).map((m) => [m.default.id, m.default]),
);

/** Does the effect apply to this astronaut? */
export function appliesTo(effect: ScenarioEffect, crewId: CrewId, location: CrewLocation): boolean {
  if (effect.crew === 'ALL') return true;
  if (Array.isArray(effect.crew)) return effect.crew.includes(crewId);
  return effect.crew === location;
}

/** Strength of the effect at this moment: 0 (none) → 1 (full). */
export function effectFraction(effect: ScenarioEffect, elapsed: number): number {
  const start = effect.startTick ?? 0;
  if (elapsed < start) return 0;
  if (effect.endTick !== undefined && elapsed >= effect.endTick) return 0;
  const ramp = Math.max(1, effect.rampTicks ?? 1);
  return Math.min(1, (elapsed - start + 1) / ramp);
}

/** Difference the effect adds to the baseline (at full strength, multiplied by sensitivity). */
export function effectDelta(effect: ScenarioEffect, base: number, traits: CrewTraits): number {
  const k = effect.trait ? traits[effect.trait] : 1;
  if (effect.to !== undefined) return (effect.to - base) * k;
  if (effect.add !== undefined) return effect.add * k;
  if (effect.mul !== undefined) return base * (effect.mul - 1) * k;
  return 0;
}
