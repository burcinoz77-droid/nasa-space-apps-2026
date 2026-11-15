// Parça 3 · Konsolun seçili astronot sütunu: 3B astronot (yoksa 2B yedek çizim), bölge seçici ve seçili bölgenin
// sağlık verileri. İmleç bir bölgenin üstüne gelince risk kutusu çıkar (seviye, skor, bölgedeki en çok sapan ölçüm);
// tıklayınca aşağıda o bölgenin bütün ölçümleri açılır. slot: bölge seçiciyle ölçümler arasına (örn. "Önemli durum").
import { lazy, type ReactNode, Suspense, useMemo, useState } from 'react';
import { METRIC_BY_KEY, readMetric } from '../../metrics';
import { useAstra } from '../../store';
import type { CrewId, CrewStatus, Level, MetricScore, Telemetry } from '../../types';
import { REGION_BY_ID, REGIONS, regionState, worstRegion, type RegionId } from '../bodyRegions';
import { fmtMetric, fmtZ } from '../format';
import { alpha, COLORS, fmt, LEVEL_COLOR, LEVEL_ICON, LEVEL_LABEL } from '../theme';
import type { HoverInfo } from './Astronaut3D';
import { BodyMap } from './BodyMap';
import { LevelBadge } from './LevelBadge';
import { RangeNote } from './RangeNote';
import { SourceBadge } from './SourceBadge';
import { TrendLine } from './Sparkline';

const Astronaut3D = lazy(() => import('./Astronaut3D'));
const EMPTY: Telemetry[] = [];

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

/** Bölgedeki en çok sapan ölçüm (Katman 1'in en çok sapan 3 ölçümünden). */
function topSignalIn(status: CrewStatus | undefined, region: RegionId): MetricScore | undefined {
  const keys = REGION_BY_ID[region].metrics;
  return status?.topSignals.find((s) => keys.includes(s.key));
}

export function BodyPanel({
  crewId,
  status,
  t,
  slot,
  height = 340,
}: {
  crewId: CrewId;
  status: CrewStatus | undefined;
  t: Telemetry | undefined;
  slot?: ReactNode;
  height?: number;
}) {
  const [webgl] = useState(hasWebGL);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [picked, setPicked] = useState<RegionId | null>(null);
  const levels = useMemo(
    () => Object.fromEntries(REGIONS.map((r) => [r.id, regionState(status, r.id).level])) as Record<RegionId, Level | undefined>,
    [status],
  );
  const selected = picked ?? worstRegion(status);
  const use3D = webgl && !failed;

  return (
    <div className="flex flex-col gap-3">
      <div className="astra-scope relative overflow-hidden rounded-md border border-space-border" style={{ height }} onMouseLeave={() => setHover(null)}>
        {use3D ? (
          <Suspense fallback={<BodyMap status={status} selected={selected} onSelect={setPicked} />}>
            <Astronaut3D levels={levels} selected={selected} onHover={setHover} onSelect={setPicked} onError={() => setFailed(true)} />
          </Suspense>
        ) : (
          <div className="absolute inset-0 p-3">
            <BodyMap status={status} selected={selected} onSelect={setPicked} />
          </div>
        )}
        {hover && <RiskTip hover={hover} status={status} t={t} />}
        <div className="pointer-events-none absolute bottom-2 left-3 text-sm text-slate-400">
          {use3D ? 'Sürükleyerek döndürün, bölgeye tıklayın' : 'Bölgeye tıklayın'}
        </div>
      </div>

      {/* Bölge seçici: klavyeyle ve 3B olmadan da çalışır */}
      <div className="grid grid-cols-4 gap-1.5" role="tablist" aria-label="Vücut bölgesi">
        {REGIONS.map((r) => {
          const s = regionState(status, r.id);
          const c = s.level ? LEVEL_COLOR[s.level] : COLORS.offline;
          const on = selected === r.id;
          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setPicked(r.id)}
              className="min-w-0 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/5"
              style={{ boxShadow: `inset 0 0 0 1px ${on ? c : alpha(COLORS.text, 0.08)}`, backgroundColor: on ? alpha(c, 0.1) : undefined }}
            >
              <span className="block truncate text-sm font-semibold text-slate-100">{r.name}</span>
              <span className="block font-mono text-sm whitespace-nowrap" style={{ color: c }}>
                {s.level ? LEVEL_ICON[s.level] : '—'} %{fmt(s.score)}
              </span>
            </button>
          );
        })}
      </div>

      {slot}

      <RegionDetail crewId={crewId} region={selected} status={status} t={t} />
    </div>
  );
}

/** İmleç bölgenin üstündeyken çıkan risk kutusu. */
function RiskTip({ hover, status, t }: { hover: HoverInfo; status: CrewStatus | undefined; t: Telemetry | undefined }) {
  const r = REGION_BY_ID[hover.region];
  const s = regionState(status, hover.region);
  const c = s.level ? LEVEL_COLOR[s.level] : COLORS.offline;
  const sig = topSignalIn(status, hover.region);
  // Kutu imlecin sağına açılır; sığmazsa soluna. Kenarlardan taşmaz.
  const W = 232;
  const left = hover.x + 16 + W <= hover.w - 8 ? hover.x + 16 : Math.max(8, hover.x - 16 - W);
  const top = Math.max(8, Math.min(hover.y - 24, hover.h - 150));
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-md border px-3 py-2 shadow-xl"
      style={{
        left,
        top,
        width: W,
        borderColor: alpha(c, 0.7),
        backgroundColor: alpha(COLORS.bg, 0.94),
      }}
      role="tooltip"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-slate-100">{r.name}</span>
        <span className="font-mono font-semibold" style={{ color: c }}>
          %{fmt(s.score)}
        </span>
      </div>
      <div className="font-mono text-sm font-semibold" style={{ color: c }}>
        {s.level ? `${LEVEL_ICON[s.level]} ${LEVEL_LABEL[s.level]} risk` : 'veri yok'}
      </div>
      <div className="text-sm text-slate-400">{r.detail}</div>
      {sig && t && (
        <div className="mt-1 border-t border-space-border pt-1 text-sm">
          <span className="text-slate-300">{METRIC_BY_KEY[sig.key].label}: </span>
          <span className="font-mono" style={{ color: sig.level !== 'normal' ? LEVEL_COLOR[sig.level] : COLORS.text }}>
            {fmtMetric(sig.key, readMetric(t, sig.key))}
          </span>
          <span className="text-slate-400"> (normal {fmtMetric(sig.key, sig.mean)})</span>
        </div>
      )}
      <div className="mt-1 text-sm text-slate-500">Ayrıntı için tıklayın</div>
    </div>
  );
}

/** Seçili bölgenin bütün ölçümleri. Sayfadaki tek ölçüm listesi budur (ayrı sekme yok). */
function RegionDetail({ crewId, region, status, t }: { crewId: CrewId; region: RegionId; status: CrewStatus | undefined; t: Telemetry | undefined }) {
  const r = REGION_BY_ID[region];
  const s = regionState(status, region);
  const hist = useAstra((st) => st.history[crewId] ?? EMPTY);
  return (
    <div className="@container rounded-md border border-space-border bg-white/[0.03]">
      <div className="flex items-center justify-between gap-2 border-b border-space-border px-3 py-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-100">
            Sağlık verileri · {r.name} <span className="font-sans font-normal text-slate-400">· {r.detail}</span>
          </h3>
          <div className="text-sm text-slate-400">
            {r.metrics.length} ölçüm, veri {r.groups}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="font-mono text-lg leading-tight font-semibold" style={{ color: s.level ? LEVEL_COLOR[s.level] : COLORS.offline }}>
            %{fmt(s.score)}
          </span>
          <LevelBadge level={s.level} />
        </div>
      </div>
      <ul className="px-3 py-1">
        {r.metrics.map((k) => {
          const m = METRIC_BY_KEY[k];
          const sig = status?.topSignals.find((x) => x.key === k);
          const l = sig?.level;
          const off = l && l !== 'normal';
          const v = t ? readMetric(t, k) : undefined;
          return (
            <li key={k} className="flex min-w-0 items-center gap-2 border-b border-space-border/60 py-1.5 last:border-b-0">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-slate-200" title={m.label}>
                  {m.label}
                </span>
                <span className="block truncate text-sm text-slate-400">
                  {sig ? `kişisel ${fmtMetric(k, sig.mean)} · ${fmtZ(sig.z)}` : ''}
                  <RangeNote crewId={crewId} k={k} value={v} />
                </span>
              </span>
              <span className="hidden @[440px]:block">
                <TrendLine values={hist.map((x) => readMetric(x, k))} color={off ? LEVEL_COLOR[l] : COLORS.calm} width={56} height={20} minSpan={0} />
              </span>
              <span className="shrink-0 text-right font-mono whitespace-nowrap" style={{ color: off ? LEVEL_COLOR[l] : COLORS.text }}>
                {off && <span className="mr-1 text-sm">{LEVEL_ICON[l]}</span>}
                {t ? fmtMetric(k, v) : '—'}
              </span>
              <SourceBadge metric={k} crewId={crewId} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
