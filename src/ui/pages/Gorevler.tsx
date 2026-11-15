// Parça 4 · Görevler (Parça 3'ten devralındı). ARES-1 Mars görevi, 180. gün:
// Gezegen ekibi habitat güneş panellerinin bakımını EVA ile yapar, Kokpit ekibi yörüngeden izler.
// Tarih yerine görev günü yazılır; NASA logolu fotoğraf yerine logosuz temsilî çizim kullanılır.
// Ekip durumu ve yüzey koşulları canlı veriden (Katman 1 ve simülasyon) okunur; bu sayfa karar vermez.
import { useState } from 'react';
import { delayText, shortName, valueText } from '../../ai/labels';
import { CREW } from '../../crew';
import { readMetric, type MetricKey } from '../../metrics';
import { PARAMS } from '../../sim/parameters';
import { useAstra } from '../../store';
import type { CrewId } from '../../types';
import { LevelBadge } from '../components/LevelBadge';
import { COLORS, fmt } from '../theme';

const EVA_TEAM = CREW.filter((c) => c.location === 'GEZEGEN');
const SUPPORT_TEAM = CREW.filter((c) => c.location === 'KOKPIT');

const EQUIPMENT = [
  { id: 'suit', name: 'xEMU suit pressure check', detail: `${fmt(PARAMS.suitPressure.value, 1)} kPa, 100% O₂` },
  { id: 'prebreathe', name: 'Oxygen prebreathe complete', detail: 'Before depressurization' },
  { id: 'cooling', name: 'Liquid cooling garment', detail: 'For core temperature' },
  { id: 'comms', name: 'Radio and helmet camera', detail: 'Voice and video with the orbit crew' },
  { id: 'tools', name: 'Panel cleaning brush and torque wrench', detail: 'Dust and loose connections' },
  { id: 'cable', name: 'Spare power cable', detail: 'For the faulty array' },
  { id: 'tether', name: 'Safety tether and carabiner', detail: 'Attached to the airlock' },
] as const;

const STEPS = ['Suit check', 'Airlock', 'Panel cleaning', 'Connection test', 'Return to habitat'];

// Sayfa değişince kontrol listesi sıfırlanmasın diye modül düzeyinde tutulur.
const savedReady = new Set<string>(['suit', 'comms']);

function avgMetric(telemetry: ReturnType<typeof useAstra.getState>['telemetry'], ids: CrewId[], key: MetricKey): number | undefined {
  const values = ids.map((id) => telemetry[id]).filter(Boolean).map((t) => readMetric(t!, key));
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
}

export function Gorevler() {
  const ship = useAstra((s) => s.ship);
  const statuses = useAstra((s) => s.statuses);
  const telemetry = useAstra((s) => s.telemetry);
  const [ready, setReady] = useState<Set<string>>(() => new Set(savedReady));

  const toggle = (id: string) =>
    setReady((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      savedReady.clear();
      next.forEach((x) => savedReady.add(x));
      return next;
    });

  // Biosensor patch: Gezegen ekibinin üçünden de canlı telemetri geliyorsa otomatik hazır.
  const sensorsLive = EVA_TEAM.every((c) => telemetry[c.id]);
  const total = EQUIPMENT.length + 1;
  const done = EQUIPMENT.filter((e) => ready.has(e.id)).length + (sensorsLive ? 1 : 0);
  const pct = Math.round((done / total) * 100);
  const day = ship?.missionDay ?? 180;
  const evaIds = EVA_TEAM.map((c) => c.id);

  return (
    <div className="space-y-4 pb-20">
      {/* Görev kartı */}
      <section className="flex flex-col gap-5 rounded-2xl border border-space-border bg-space-panel p-5 md:flex-row">
        <HabitatIllustration />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-calm/15 px-3 py-1 font-semibold text-calm">EVA · surface crew</span>
            <span className="rounded-full bg-white/5 px-3 py-1 text-slate-300">ARES-1 · Mars surface</span>
          </div>
          <h2 className="text-2xl font-bold">Habitat solar panel maintenance</h2>
          <p className="text-slate-300">
            The surface crew cleans dust off the panel arrays and replaces loose power connections. The orbit crew monitors telemetry from orbit.
          </p>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-400">EVA window</dt>
              <dd className="font-mono text-base">
                MD {day}, 10:00 – MD {day + 1}, 14:00
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Assigned</dt>
              <dd className="text-base">
                {EVA_TEAM.map((c) => shortName(c.id)).join(', ')} · support: {SUPPORT_TEAM.map((c) => shortName(c.id)).join(', ')}
              </dd>
            </div>
          </dl>
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-slate-300">Readiness</span>
              <span className="font-mono" style={{ color: pct === 100 ? COLORS.normal : COLORS.calm }}>
                {pct}% · {done}/{total}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? COLORS.normal : COLORS.calm }} />
            </div>
          </div>
          <ol className="flex flex-wrap gap-2 text-sm">
            {STEPS.map((step, i) => (
              <li key={step} className="rounded-lg border border-space-border px-3 py-1 text-slate-300">
                <span className="font-mono text-calm">{i + 1}</span> {step}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Equipment checklist */}
        <section className="rounded-2xl border border-space-border bg-space-panel p-5">
          <h3 className="mb-3 font-semibold">Equipment checklist</h3>
          <ul className="space-y-2">
            {EQUIPMENT.map((e) => {
              const ok = ready.has(e.id);
              return (
                <li key={e.id}>
                  <button
                    onClick={() => toggle(e.id)}
                    aria-pressed={ok}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-space-border px-3 py-2 text-left hover:bg-white/5"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm">{e.name}</span>
                      <span className="block text-sm text-slate-400">{e.detail}</span>
                    </span>
                    <ReadyChip ok={ok} />
                  </button>
                </li>
              );
            })}
            <li className="flex items-center justify-between gap-3 rounded-lg border border-space-border px-3 py-2">
              <span>
                <span className="block text-sm">Biosensor patch</span>
                <span className="block text-sm text-slate-400">Automatic from live telemetry</span>
              </span>
              <ReadyChip ok={sensorsLive} />
            </li>
          </ul>
        </section>

        {/* Ekip durumu (Katman 1'den) */}
        <section className="rounded-2xl border border-space-border bg-space-panel p-5">
          <h3 className="mb-1 font-semibold">EVA crew · live status</h3>
          <p className="mb-3 text-sm text-slate-400">Layer 1 sets the level; the crew makes the EVA decision.</p>
          <ul className="space-y-2">
            {EVA_TEAM.map((c) => {
              const st = statuses[c.id];
              const t = telemetry[c.id];
              return (
                <li key={c.id} className="rounded-lg border border-space-border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">
                      {shortName(c.id)} <span className="font-mono text-sm text-slate-400">{c.unit}</span>
                    </span>
                    <LevelBadge level={st?.level} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 text-sm text-slate-300">
                    <span>Health {fmt(st?.healthScore)}%</span>
                    {t && <span>Heart rate {valueText('cardio.hr_bpm', t.cardio.hr_bpm)}</span>}
                    {t && <span>Core temp {valueText('resp.coreTemp_C', t.resp.coreTemp_C)}</span>}
                  </div>
                  {st?.restRequired && (
                    <div className="mt-1 text-sm font-semibold" style={{ color: COLORS.caution }}>
                      ▲ Mandatory crew rest ordered
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Yüzey koşulları ve Dünya bağlantısı */}
        <div className="flex flex-col gap-4 md:col-span-2 xl:col-span-1">
          <section className="rounded-2xl border border-space-border bg-space-panel p-5">
            <h3 className="mb-3 font-semibold">Surface conditions · live</h3>
            <dl className="space-y-2 text-sm">
              <Row label="Radiation dose rate (crew mean)" value={fmtMetric('env.doseRate_uSv_h', avgMetric(telemetry, evaIds, 'env.doseRate_uSv_h'))} />
              <Row label="Suit pressure" value={fmtMetric('env.pressure_kPa', avgMetric(telemetry, evaIds, 'env.pressure_kPa'))} />
              <Row label="In-suit CO₂" value={fmtMetric('env.ppCO2_mmHg', avgMetric(telemetry, evaIds, 'env.ppCO2_mmHg'))} />
            </dl>
            <p className="mt-3 text-sm text-slate-400">Surface dose reference: {PARAMS.doseRateMarsSurface.source}</p>
          </section>
          <section className="rounded-2xl border border-space-border bg-space-panel p-5">
            <h3 className="font-semibold">Ground link</h3>
            <p className="mt-1 font-mono text-lg text-calm">OWLT {ship ? delayText(ship.commDelayOneWay_s) : '—'}</p>
            <p className="mt-1 text-sm text-slate-400">
              One-way. Round trip about {ship ? fmt((ship.commDelayOneWay_s * 2) / 60) : '—'} min · NASA Mars Relay Network
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function fmtMetric(key: MetricKey, v: number | undefined): string {
  return v === undefined ? '—' : valueText(key, v);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className="whitespace-nowrap font-mono">{value}</dd>
    </div>
  );
}

function ReadyChip({ ok }: { ok: boolean }) {
  return (
    <span
      className="shrink-0 rounded-full px-2.5 py-0.5 text-sm font-semibold"
      style={{ color: ok ? COLORS.normal : COLORS.textMuted, backgroundColor: ok ? `${COLORS.normal}1A` : 'transparent', border: `1px solid ${ok ? COLORS.normal : COLORS.border}` }}
    >
      {ok ? '● Ready' : '○ Pending'}
    </span>
  );
}

/** Logosuz temsilî çizim: Mars yüzeyinde habitat ve güneş paneli dizileri (alacakaranlık). */
function HabitatIllustration() {
  return (
    <figure className="shrink-0 md:w-72">
      <svg viewBox="0 0 288 200" className="w-full rounded-xl" role="img" aria-label="Illustration: habitat and solar panels on the Mars surface">
        <defs>
          <linearGradient id="gorev-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={COLORS.bg} />
            <stop offset="1" stopColor={COLORS.panel} />
          </linearGradient>
          <radialGradient id="gorev-sun" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={COLORS.calm} stopOpacity="0.9" />
            <stop offset="1" stopColor={COLORS.calm} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="288" height="200" fill="url(#gorev-sky)" />
        <circle cx="222" cy="64" r="34" fill="url(#gorev-sun)" />
        <circle cx="222" cy="64" r="6" fill={COLORS.text} opacity="0.85" />
        {[18, 52, 96, 140, 260, 30, 180].map((x, i) => (
          <circle key={x} cx={x} cy={14 + ((i * 23) % 50)} r="0.9" fill={COLORS.text} opacity="0.6" />
        ))}
        <path d="M0 128 Q48 104 96 120 T190 112 T288 120 V200 H0 Z" fill={COLORS.border} />
        <path d="M0 150 Q70 136 140 146 T288 142 V200 H0 Z" fill={COLORS.panel} />
        {/* habitat */}
        <path d="M40 150 a34 26 0 0 1 68 0 Z" fill={COLORS.border} stroke={COLORS.textMuted} strokeWidth="1.5" />
        <rect x="64" y="138" width="20" height="12" rx="2" fill={COLORS.bg} stroke={COLORS.textMuted} strokeWidth="1" />
        <circle cx="74" cy="132" r="3" fill={COLORS.calm} opacity="0.8" />
        {/* güneş paneli dizileri */}
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${136 + i * 46} ${150 - i * 3})`}>
            <line x1="18" y1="0" x2="18" y2="14" stroke={COLORS.textMuted} strokeWidth="1.5" />
            <path d="M0 0 L36 -8 L40 6 L4 14 Z" fill={COLORS.calm} fillOpacity="0.35" stroke={COLORS.calm} strokeWidth="1" />
            <path d="M12 -3 L16 11 M24 -5 L28 9" stroke={COLORS.calm} strokeOpacity="0.6" strokeWidth="0.8" />
          </g>
        ))}
        {/* astronot */}
        <g transform="translate(176 160)" fill={COLORS.text}>
          <circle cx="0" cy="-12" r="3.5" />
          <rect x="-3.5" y="-8" width="7" height="10" rx="2" />
          <rect x="-3" y="2" width="2.5" height="6" />
          <rect x="0.5" y="2" width="2.5" height="6" />
        </g>
      </svg>
      <figcaption className="mt-1 text-sm text-slate-400">Illustration · Mars surface habitat</figcaption>
    </figure>
  );
}
