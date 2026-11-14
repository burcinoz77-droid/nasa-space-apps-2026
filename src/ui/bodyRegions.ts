// Parça 3 · Vücut haritasının bölgeleri ve seviyeleri (BodyMap ve Astronot Ekranı sekmeleri kullanır).
import type { MetricKey } from '../metrics';
import type { CrewStatus, Level } from '../types';
import { domainLevel } from './format';
import { worstLevel } from './theme';

export type RegionId = 'head' | 'chest' | 'skin' | 'env';
export type TabId = 'genel' | 'saglik' | 'performans' | 'cevre';

const TEMP_KEYS: MetricKey[] = ['resp.coreTemp_C', 'resp.skinTemp_C', 'resp.gsr_uS'];

export const REGIONS: { id: RegionId; name: string; detail: string; groups: string; tab: TabId }[] = [
  { id: 'head', name: 'Baş', detail: 'bilişsel ve göz', groups: 'grup 4', tab: 'performans' },
  { id: 'chest', name: 'Göğüs', detail: 'kalp ve solunum', groups: 'grup 1–2', tab: 'saglik' },
  { id: 'skin', name: 'Deri', detail: 'biyokimya ve sıcaklık', groups: 'grup 2–3', tab: 'saglik' },
  { id: 'env', name: 'Çevre halkası', detail: 'radyasyon, CO₂, uyku', groups: 'grup 5', tab: 'cevre' },
];

export function regionState(status: CrewStatus | undefined, id: RegionId): { level: Level | undefined; score: number | undefined } {
  if (!status) return { level: undefined, score: undefined };
  const d = status.domainScores;
  switch (id) {
    case 'head':
      return { level: domainLevel(status, 'cog'), score: d.cog };
    case 'chest':
      return { level: worstLevel(domainLevel(status, 'cardio'), domainLevel(status, 'resp')), score: Math.min(d.cardio, d.resp) };
    case 'skin': {
      const temp = status.topSignals.filter((s) => TEMP_KEYS.includes(s.key)).map((s) => s.level);
      return { level: worstLevel(domainLevel(status, 'biochem'), ...temp), score: d.biochem };
    }
    case 'env':
      return { level: domainLevel(status, 'env'), score: d.env };
  }
}
