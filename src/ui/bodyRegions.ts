// Part 3 · Body map regions: used by the 3D astronaut model, the 2D fallback drawing and the Astronaut View tabs.
//   Head        = cognitive and eyes (data group 4)
//   Chest       = heart and breathing (data group 1 and the respiratory part of 2)
//   Lower body  = metabolism, sweat and body temperature (data group 3 and the temperature/GSR part of 2) — the first region to deviate during EVA exertion
//   Environment = radiation, CO₂, pressure, sleep (data group 5); the ground ring under the model
import { METRICS, type MetricKey } from '../metrics';
import type { CrewStatus, Level } from '../types';
import { scoreLevel, worstLevel } from './theme';

export type RegionId = 'head' | 'chest' | 'lower' | 'env';
export type TabId = 'genel' | 'saglik' | 'performans' | 'cevre';

const BREATH_KEYS: MetricKey[] = ['resp.rr_bpm', 'resp.minuteVent_L_min', 'resp.etco2_mmHg'];
const HEAT_KEYS: MetricKey[] = ['resp.coreTemp_C', 'resp.skinTemp_C', 'resp.gsr_uS'];

export interface RegionDef {
  id: RegionId;
  name: string;
  detail: string;
  groups: string;
  tab: TabId;
  metrics: MetricKey[];
}

const keysOf = (prefix: string) => METRICS.filter((m) => m.key.startsWith(prefix)).map((m) => m.key);

export const REGIONS: RegionDef[] = [
  { id: 'head', name: 'Head', detail: 'cognitive state and eyes', groups: 'group 4', tab: 'performans', metrics: keysOf('cog.') },
  { id: 'chest', name: 'Chest', detail: 'heart and breathing', groups: 'groups 1–2', tab: 'saglik', metrics: [...keysOf('cardio.'), ...BREATH_KEYS] },
  { id: 'lower', name: 'Lower body', detail: 'metabolism, sweat and heat', groups: 'groups 2–3', tab: 'saglik', metrics: [...keysOf('biochem.'), ...HEAT_KEYS] },
  { id: 'env', name: 'Environment', detail: 'radiation, CO₂, sleep', groups: 'group 5', tab: 'cevre', metrics: keysOf('env.') },
];

export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<RegionId, RegionDef>;

const signalLevels = (status: CrewStatus, keys: MetricKey[]) => status.topSignals.filter((s) => keys.includes(s.key)).map((s) => s.level);

/**
 * The region's score and level. Score = the lowest of the Layer 1 domain scores the region is based on; level = the worse of
 * that score's color (theme.scoreLevel) and the level of the most deviating metrics in the region. Score and level always agree on screen.
 */
export function regionState(status: CrewStatus | undefined, id: RegionId): { level: Level | undefined; score: number | undefined } {
  if (!status) return { level: undefined, score: undefined };
  const d = status.domainScores;
  const score = { head: d.cog, chest: Math.min(d.cardio, d.resp), lower: d.biochem, env: d.env }[id];
  return { score, level: worstLevel(scoreLevel(score), ...signalLevels(status, REGION_BY_ID[id].metrics)) };
}

/** The worst region (the detail panel opens with it if no region is selected). */
export function worstRegion(status: CrewStatus | undefined): RegionId {
  const rank: Record<Level, number> = { normal: 0, caution: 1, critical: 2 };
  let best: RegionId = 'chest';
  let bestRank = -1;
  for (const r of REGIONS) {
    const s = regionState(status, r.id);
    const k = s.level ? rank[s.level] * 1000 - (s.score ?? 100) : -1;
    if (k > bestRank) {
      bestRank = k;
      best = r.id;
    }
  }
  return best;
}
