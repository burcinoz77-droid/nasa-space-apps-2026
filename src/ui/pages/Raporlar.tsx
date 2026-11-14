// Parça 2 · Raporlar = olay kaydı (incident ledger). Her olay ve her otonom adım burada görünür.
import { useAstra } from '../../store';

export function Raporlar() {
  const ledger = useAstra((s) => s.ledger);
  return (
    <div className="space-y-2">
      {ledger.length === 0 && <div className="text-slate-400">Henüz kayıt yok.</div>}
      {ledger.map((e) => (
        <div key={e.id} className="rounded-xl border border-space-border bg-space-panel p-3">
          <span className="font-mono text-calm">{new Date(e.at).toLocaleTimeString('tr-TR')}</span>{' '}
          <span className="font-mono text-xs text-slate-400">{e.kind}</span> <span>{e.text}</span>
        </div>
      ))}
    </div>
  );
}
