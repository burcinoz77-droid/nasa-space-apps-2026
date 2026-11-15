// Parça 3 · Vücut haritasının bölgeleri: 3B astronot modeli, 2B yedek çizim ve Astronot Ekranı sekmeleri kullanır.
//   Baş        = bilişsel ve göz (veri grubu 4)
//   Göğüs      = kalp ve solunum (veri grubu 1 ve 2'nin solunum kısmı)
//   Alt gövde  = metabolizma, ter ve vücut ısısı (veri grubu 3 ve 2'nin ısı/GSR kısmı) — EVA eforunda ilk sapan bölge
//   Çevre      = radyasyon, CO₂, basınç, uyku (veri grubu 5); modelin altındaki zemin halkası
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
  { id: 'head', name: 'Baş', detail: 'bilişsel durum ve göz', groups: 'grup 4', tab: 'performans', metrics: keysOf('cog.') },
  { id: 'chest', name: 'Göğüs', detail: 'kalp ve solunum', groups: 'grup 1–2', tab: 'saglik', metrics: [...keysOf('cardio.'), ...BREATH_KEYS] },
  { id: 'lower', name: 'Alt gövde', detail: 'metabolizma, ter ve ısı', groups: 'grup 2–3', tab: 'saglik', metrics: [...keysOf('biochem.'), ...HEAT_KEYS] },
  { id: 'env', name: 'Çevre', detail: 'radyasyon, CO₂, uyku', groups: 'grup 5', tab: 'cevre', metrics: keysOf('env.') },
];

export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<RegionId, RegionDef>;

const signalLevels = (status: CrewStatus, keys: MetricKey[]) => status.topSignals.filter((s) => keys.includes(s.key)).map((s) => s.level);

/**
 * Bölgenin skoru ve seviyesi. Skor, bölgenin dayandığı Katman 1 alan skorlarının en düşüğü; seviye, bu skorun rengi
 * (theme.scoreLevel) ile bölgedeki en çok sapan ölçümlerin seviyesinden kötü olanı. Ekranda skor ve seviye hep tutarlı.
 */
export function regionState(status: CrewStatus | undefined, id: RegionId): { level: Level | undefined; score: number | undefined } {
  if (!status) return { level: undefined, score: undefined };
  const d = status.domainScores;
  const score = { head: d.cog, chest: Math.min(d.cardio, d.resp), lower: d.biochem, env: d.env }[id];
  return { score, level: worstLevel(scoreLevel(score), ...signalLevels(status, REGION_BY_ID[id].metrics)) };
}

/** En kötü bölge (seçili bölge yoksa ayrıntı paneli bununla açılır). */
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
