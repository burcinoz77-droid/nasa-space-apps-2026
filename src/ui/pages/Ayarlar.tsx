// Parça 1 · Ayarlar = demo kontrol paneli: senaryo tetikleyicileri, örnekleme hızı, sıfırlama.
import { controls, SCENARIO_NAMES } from '../../loop';
import { useAstra } from '../../store';
import type { ScenarioId } from '../../types';

export function Ayarlar() {
  const tickMs = useAstra((s) => s.tickMs);
  const scenario = useAstra((s) => s.ship?.scenario);
  return (
    <div className="grid grid-cols-2 gap-4">
      <section className="rounded-2xl border border-space-border bg-space-panel p-4">
        <h2 className="mb-3 font-semibold">Telemetri örnekleme hızı</h2>
        <div className="flex gap-2">
          {[800, 1200, 2500].map((ms) => (
            <button key={ms} onClick={() => controls.setSpeed(ms)} className={`rounded-lg px-3 py-2 font-mono ${tickMs === ms ? 'bg-calm/20 text-calm' : 'bg-white/5'}`}>
              {(ms / 1000).toLocaleString('tr-TR')} sn
            </button>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-space-border bg-space-panel p-4">
        <h2 className="mb-3 font-semibold">Kriz senaryoları</h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SCENARIO_NAMES) as ScenarioId[]).map((id) => (
            <button key={id} onClick={() => controls.setScenario(id)} className={`rounded-lg px-3 py-2 ${scenario === id ? 'bg-calm/20 text-calm' : 'bg-white/5'}`}>
              {SCENARIO_NAMES[id]}
            </button>
          ))}
          <button onClick={() => controls.reset()} className="rounded-lg bg-white/5 px-3 py-2">Simülasyonu sıfırla</button>
        </div>
      </section>
    </div>
  );
}
