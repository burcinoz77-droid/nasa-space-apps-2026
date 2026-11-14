// Parça 3 · Kokpit (v0). Hedef: ilk ekran görüntüsündeki özet kartlar + mürettebat listesi + görev ilerlemesi.
import { CREW } from '../../crew';
import { useAstra } from '../../store';
import { LevelBadge } from '../components/LevelBadge';
import { fmt } from '../theme';

export function Kokpit() {
  const statuses = useAstra((s) => s.statuses);
  const incidents = useAstra((s) => s.incidents);
  const scores = CREW.map((m) => statuses[m.id]?.healthScore ?? 0);
  const avg = scores.reduce((a, b) => a + b, 0) / CREW.length;
  const open = incidents.filter((i) => i.status !== 'resolved').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card title="Aktif astronot" value={`${CREW.length}/6`} />
        <Card title="Ortalama sağlık" value={`%${fmt(avg)}`} />
        <Card title="Açık olay" value={String(open)} />
      </div>
      <div className="rounded-2xl border border-space-border bg-space-panel p-4">
        <h2 className="mb-3 font-semibold">Astronot durumları</h2>
        {CREW.map((m) => (
          <div key={m.id} className="flex items-center justify-between border-t border-space-border py-2">
            <span>{m.name} <span className="text-xs text-slate-400">· {m.location === 'KOKPIT' ? 'Kokpit' : 'Gezegen'}</span></span>
            <span className="flex items-center gap-4">
              <LevelBadge level={statuses[m.id]?.level} />
              <span className="font-mono">%{fmt(statuses[m.id]?.healthScore)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-space-border bg-space-panel p-4">
      <div className="text-sm text-slate-400">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
