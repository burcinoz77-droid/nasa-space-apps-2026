// Parça 1 · Ayarlar = demo kontrol paneli: senaryo tetikleyicileri, örnekleme hızı, sıfırlama.
// Renkler theme.ts'ten: fırtına ve yük amber, kritik senaryolar kırmızı çerçeve, stabilize yeşil.
import { controls } from '../../loop';
import { SCENARIOS } from '../../sim/scenario';
import { PARAMS, SIM, type Param } from '../../sim/parameters';
import { useAstra } from '../../store';
import type { ScenarioId, Telemetry } from '../../types';
import { CINEMATIC_EVENT, SHOWS } from '../cinematic/shows';
import { alpha, COLORS, fmt } from '../theme';

const EMPTY: Telemetry[] = [];

interface ScenarioButton {
  id: ScenarioId;
  label: string;
  who: string; // kimi etkiler
  what: string; // ne olur
  color: string;
}

const BUTTONS: ScenarioButton[] = [
  { id: 'SOLAR_STORM', label: 'Güneş fırtınası başlat', who: 'Tüm mürettebat (Kokpit en çok)', what: 'Doz hızı ×25, sonra ×60. DONKI Mayıs 2024 olay sırası.', color: COLORS.caution },
  { id: 'MARS_DAY_180', label: 'Mars 180. gün yükü', who: 'Elif tam, diğerleri yarı şiddette', what: 'Uyku 5 saate iner, PVT uzar, ruh hali düşer.', color: COLORS.caution },
  { id: 'CO2_SCRUBBER_FAIL', label: 'CO₂ temizleyici arızası', who: 'Kokpit ekibi, Kerem iki kat', what: 'Kabin ppCO₂ 1,9 → 5,3 mmHg. Solunum ve nabız artar.', color: COLORS.critical },
  { id: 'EVA_OVEREXERTION', label: 'EVA aşırı efor', who: 'Mert (Gezegen ekibi)', what: 'Nabız 155, çekirdek sıcaklık 39,2 °C, laktat 22 mM.', color: COLORS.critical },
  { id: 'NORMAL', label: 'Tüm mürettebatı stabilize et', who: 'Herkes', what: 'Senaryo etkileri kalkar, değerler kişisel normale döner.', color: COLORS.normal },
];

const SPEEDS = [800, 1200, 2500];
const PARAM_LIST: Param[] = Object.values(PARAMS);

function SourceCell({ p }: { p: Param }) {
  const badge = p.assumption ? (
    <span className="ml-2 rounded px-1.5 py-0.5 text-xs" style={{ color: COLORS.offline, border: `1px solid ${COLORS.offline}` }}>Varsayım</span>
  ) : null;
  if (!p.url) return <span style={{ color: COLORS.textMuted }}>{p.source}{badge}</span>;
  return (
    <span>
      <a href={p.url} target="_blank" rel="noreferrer" className="underline decoration-dotted" style={{ color: COLORS.calm }}>{p.source}</a>
      {badge}
    </span>
  );
}

export function Ayarlar() {
  const tickMs = useAstra((s) => s.tickMs);
  const ship = useAstra((s) => s.ship);
  const samples = useAstra((s) => s.history.elif ?? EMPTY).length;
  const baselineReady = samples >= SIM.baselineWindow;
  const activeName = ship ? (SCENARIOS[ship.scenario]?.name ?? ship.scenario) : '—';

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-2xl border border-space-border bg-space-panel p-4 lg:col-span-2">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold">Kriz senaryoları</h2>
          <span className="text-sm" style={{ color: COLORS.textMuted }}>
            Aktif: <span style={{ color: COLORS.text }}>{activeName}</span>
          </span>
        </div>
        {!baselineReady && (
          <p className="mb-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: COLORS.calm, color: COLORS.calm }}>
            Kişisel baseline kuruluyor ({samples}/{SIM.baselineWindow} ölçüm). Senaryoyu bundan sonra başlatın; yoksa Katman 1 anomaliyi normal sanar.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {BUTTONS.map((b) => {
            const active = ship?.scenario === b.id;
            return (
              <button
                key={b.id}
                onClick={() => controls.setScenario(b.id)}
                className="rounded-xl border-2 p-3 text-left transition hover:bg-white/5"
                style={{ borderColor: active ? b.color : `${b.color}55`, background: active ? `${b.color}1A` : undefined }}
              >
                <div className="font-semibold" style={{ color: b.color }}>
                  {active ? '● ' : ''}
                  {b.label}
                </div>
                <div className="mt-1 text-sm" style={{ color: COLORS.text }}>{b.what}</div>
                <div className="mt-1 text-xs" style={{ color: COLORS.textMuted }}>{b.who}</div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex flex-col gap-4">
        <section className="rounded-2xl border border-space-border bg-space-panel p-4">
          <h2 className="mb-3 font-semibold">Telemetri örnekleme hızı</h2>
          <div className="flex gap-2">
            {SPEEDS.map((ms) => (
              <button key={ms} onClick={() => controls.setSpeed(ms)} className={`rounded-lg px-3 py-2 font-mono ${tickMs === ms ? 'bg-calm/20 text-calm' : 'bg-white/5'}`}>
                {fmt(ms / 1000, 1)} sn
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs" style={{ color: COLORS.textMuted }}>
            1 ölçüm = {SIM.missionMinutesPerTick} dk görev süresi (demo hızlandırması).
          </p>
        </section>

        <section className="rounded-2xl border border-space-border bg-space-panel p-4">
          <h2 className="mb-2 font-semibold">Aktif olaylar</h2>
          {ship && ship.activeEvents.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {ship.activeEvents.map((e) => (
                <li key={e}>▲ {e}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm" style={{ color: COLORS.textMuted }}>Olay yok.</p>
          )}
          {ship && SCENARIOS[ship.scenario]?.note && (
            <p className="mt-3 text-xs" style={{ color: COLORS.textMuted }}>{SCENARIOS[ship.scenario]?.note}</p>
          )}
        </section>

        <section className="rounded-2xl border border-space-border bg-space-panel p-4">
          <button onClick={() => controls.reset()} className="w-full rounded-lg bg-white/5 px-3 py-2 hover:bg-white/10">
            Simülasyonu sıfırla
          </button>
          <p className="mt-2 text-xs" style={{ color: COLORS.textMuted }}>
            Aynı seed: demo her seferinde aynı veriyi baştan üretir.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {(Object.keys(SHOWS) as ScenarioId[]).map((id) => (
              <button
                key={id}
                onClick={() => window.dispatchEvent(new CustomEvent(CINEMATIC_EVENT, { detail: id }))}
                className="w-full rounded-lg px-3 py-2 hover:bg-white/10"
                style={{ background: alpha(COLORS.caution, 0.12), color: COLORS.caution }}
              >
                ▶ Sinematik: {SCENARIOS[id]?.name ?? id}
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-space-border bg-space-panel p-4 lg:col-span-3">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold">Veri kaynakları</h2>
          <span className="text-xs" style={{ color: COLORS.textMuted }}>
            {PARAM_LIST.length} parametre · {PARAM_LIST.filter((p) => p.assumption).length} varsayım · tüm astronot verisi simülasyondur
          </span>
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-space-panel text-left" style={{ color: COLORS.textMuted }}>
              <tr>
                <th className="py-1 pr-3 font-normal">Parametre</th>
                <th className="py-1 pr-3 font-normal">Değer</th>
                <th className="py-1 font-normal">Kaynak</th>
              </tr>
            </thead>
            <tbody>
              {PARAM_LIST.map((p) => (
                <tr key={p.label} className="border-t border-space-border">
                  <td className="py-1.5 pr-3">{p.label}</td>
                  <td className="py-1.5 pr-3 font-mono whitespace-nowrap">
                    {fmt(p.value, Number.isInteger(p.value) ? 0 : 2)} <span style={{ color: COLORS.textMuted }}>{p.unit}</span>
                  </td>
                  <td className="py-1.5"><SourceCell p={p} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs" style={{ color: COLORS.textMuted }}>
          Güneş fırtınası olay zamanları NASA DONKI Mayıs 2024 kayıtlarından alındı (data/donki_sep_2024-05.json). DONKI doz değeri vermez; doz çarpanları varsayımdır.
        </p>
      </section>
    </div>
  );
}
