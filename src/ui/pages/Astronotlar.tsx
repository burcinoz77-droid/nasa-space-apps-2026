// Parça 3 · Astronotlar (v0). Hedef: üçüncü ekran görüntüsü — ekip başlıkları + 6 kart + küçük nabız grafiği (Recharts).
import { CREW } from '../../crew';
import { useAstra } from '../../store';
import { LevelBadge } from '../components/LevelBadge';
import { fmt } from '../theme';

export function Astronotlar() {
  const statuses = useAstra((s) => s.statuses);
  const telemetry = useAstra((s) => s.telemetry);
  return (
    <div className="grid grid-cols-3 gap-4">
      {CREW.map((m) => (
        <div key={m.id} className="rounded-2xl border border-space-border bg-space-panel p-4">
          <div className="flex justify-between font-mono text-xs text-slate-400">
            <span>{m.location === 'KOKPIT' ? 'Kokpit' : 'Gezegen yüzeyi'}</span>
            <span>{m.unit}</span>
          </div>
          <div className="mt-2 text-lg font-semibold">{m.name}</div>
          <div className="text-sm text-calm">{m.role}</div>
          <div className="text-xs text-slate-400">{m.sensitivity}</div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xl font-bold">%{fmt(statuses[m.id]?.healthScore)}</span>
            <LevelBadge level={statuses[m.id]?.level} />
          </div>
          <div className="mt-1 font-mono text-xs text-slate-400">Nabız {fmt(telemetry[m.id]?.cardio.hr_bpm)} bpm</div>
        </div>
      ))}
    </div>
  );
}
