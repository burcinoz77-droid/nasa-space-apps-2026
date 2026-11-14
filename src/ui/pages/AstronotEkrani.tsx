// Parça 3 · Astronot Ekranı (v0): seçili astronotun 5 veri grubundaki tüm ölçümleri.
// Hedef: ikinci ekran görüntüsü — vücut haritası (2B SVG yeterli), sağlık kartı, stres faktörü kartları, grafikler.
import { useState } from 'react';
import { CREW } from '../../crew';
import { GROUP_NAMES, METRICS, readMetric } from '../../metrics';
import { useAstra } from '../../store';
import type { CrewId } from '../../types';
import { LevelBadge } from '../components/LevelBadge';
import { fmt } from '../theme';

export function AstronotEkrani() {
  const [crewId, setCrewId] = useState<CrewId>('elif');
  const t = useAstra((s) => s.telemetry[crewId]);
  const st = useAstra((s) => s.statuses[crewId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CREW.map((m) => (
          <button key={m.id} onClick={() => setCrewId(m.id)} className={`rounded-full px-3 py-1 text-sm ${m.id === crewId ? 'bg-calm/20 text-calm ring-1 ring-calm' : 'bg-white/5'}`}>
            {m.name}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-3xl font-bold">%{fmt(st?.healthScore)}</span>
        <LevelBadge level={st?.level} />
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {([1, 2, 3, 4, 5] as const).map((g) => (
          <div key={g} className="rounded-2xl border border-space-border bg-space-panel p-4">
            <h3 className="mb-2 font-semibold">{g} · {GROUP_NAMES[g]}</h3>
            {METRICS.filter((m) => m.group === g).map((m) => (
              <div key={m.key} className="flex justify-between text-sm">
                <span className="text-slate-400">{m.label}</span>
                <span className="font-mono">{t ? fmt(readMetric(t, m.key), m.decimals) : '—'} {m.unit}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
