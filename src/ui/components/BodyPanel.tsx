// Part 3 · Body panel of the Astronaut View: 3D astronaut (otherwise the 2D fallback drawing), region selector and the details
// of the selected region. When the cursor hovers over a region a risk box appears (level, score, most deviating metric in the region);
// clicking opens all metrics of that region below.
import { lazy, Suspense, useMemo, useState } from 'react';
import { METRIC_BY_KEY, readMetric } from '../../metrics';
import { useAstra } from '../../store';
import type { CrewId, CrewStatus, Level, MetricScore, Telemetry } from '../../types';
import { REGION_BY_ID, REGIONS, regionState, worstRegion, type RegionId, type TabId } from '../bodyRegions';
import { fmtMetric, fmtZ } from '../format';
import { alpha, COLORS, fmt, LEVEL_COLOR, LEVEL_ICON, LEVEL_LABEL } from '../theme';
import type { HoverInfo } from './Astronaut3D';
import { BodyMap } from './BodyMap';
import { LevelBadge } from './LevelBadge';
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

/** The most deviating metric in the region (from Layer 1's 3 most deviating metrics). */
function topSignalIn(status: CrewStatus | undefined, region: RegionId): MetricScore | undefined {
  const keys = REGION_BY_ID[region].metrics;
  return status?.topSignals.find((s) => keys.includes(s.key));
}

export function BodyPanel({
  crewId,
  status,
  t,
  onOpenTab,
}: {
  crewId: CrewId;
  status: CrewStatus | undefined;
  t: Telemetry | undefined;
  onOpenTab: (tab: TabId) => void;
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
      <div className="astra-scope relative h-[340px] overflow-hidden rounded-lg border border-space-border" onMouseLeave={() => setHover(null)}>
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
          {use3D ? 'Drag to rotate, click a region' : 'Click a region'}
        </div>
      </div>

      {/* Region selector: works with the keyboard and without 3D too */}
      <div className="grid grid-cols-4 gap-1.5" role="tablist" aria-label="Body region">
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
              className="min-w-0 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5"
              style={{ boxShadow: `inset 0 0 0 1px ${on ? c : alpha(COLORS.text, 0.08)}`, backgroundColor: on ? alpha(c, 0.1) : undefined }}
            >
              <span className="block truncate text-sm font-semibold text-slate-100">{r.name}</span>
              <span className="block font-mono text-sm whitespace-nowrap" style={{ color: c }}>
                {s.level ? LEVEL_ICON[s.level] : '—'} {fmt(s.score)}%
              </span>
            </button>
          );
        })}
      </div>

      <RegionDetail crewId={crewId} region={selected} status={status} t={t} onOpenTab={onOpenTab} />
    </div>
  );
}

/** Risk box shown while the cursor is over the region. */
function RiskTip({ hover, status, t }: { hover: HoverInfo; status: CrewStatus | undefined; t: Telemetry | undefined }) {
  const r = REGION_BY_ID[hover.region];
  const s = regionState(status, hover.region);
  const c = s.level ? LEVEL_COLOR[s.level] : COLORS.offline;
  const sig = topSignalIn(status, hover.region);
  // The box opens to the right of the cursor; to the left if it does not fit. It does not overflow the edges.
  const W = 232;
  const left = hover.x + 16 + W <= hover.w - 8 ? hover.x + 16 : Math.max(8, hover.x - 16 - W);
  const top = Math.max(8, Math.min(hover.y - 24, hover.h - 150));
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-lg border px-3 py-2 shadow-xl"
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
          {fmt(s.score)}%
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
          <span className="text-slate-400"> (baseline {fmtMetric(sig.key, sig.mean)})</span>
        </div>
      )}
      <div className="mt-1 text-sm text-slate-500">Click for details</div>
    </div>
  );
}

/** All metrics of the selected region. */
function RegionDetail({
  crewId,
  region,
  status,
  t,
  onOpenTab,
}: {
  crewId: CrewId;
  region: RegionId;
  status: CrewStatus | undefined;
  t: Telemetry | undefined;
  onOpenTab: (tab: TabId) => void;
}) {
  const r = REGION_BY_ID[region];
  const s = regionState(status, region);
  const hist = useAstra((st) => st.history[crewId] ?? EMPTY);
  return (
    <div className="rounded-lg border border-space-border bg-white/[0.02]">
      <div className="flex items-center justify-between gap-2 border-b border-space-border px-3 py-2">
        <div className="min-w-0">
          <div className="font-semibold text-slate-100">
            {r.name} <span className="font-normal text-slate-400">· {r.detail}</span>
          </div>
          <div className="text-sm text-slate-400">Data {r.groups}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="font-mono text-lg leading-tight font-semibold" style={{ color: s.level ? LEVEL_COLOR[s.level] : COLORS.offline }}>
            {fmt(s.score)}%
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
          return (
            <li key={k} className="flex min-w-0 items-center gap-2 border-b border-space-border/60 py-1.5 last:border-b-0">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-slate-300" title={m.label}>
                  {m.label}
                </span>
                {sig && (
                  <span className="block text-sm text-slate-500">
                    normal {fmtMetric(k, sig.mean)} · {fmtZ(sig.z)}
                  </span>
                )}
              </span>
              <span className="hidden min-[1400px]:block">
                <TrendLine values={hist.map((x) => readMetric(x, k))} color={off ? LEVEL_COLOR[l] : COLORS.calm} width={56} height={20} />
              </span>
              <span className="shrink-0 text-right font-mono whitespace-nowrap" style={{ color: off ? LEVEL_COLOR[l] : COLORS.text }}>
                {off && <span className="mr-1 text-sm">{LEVEL_ICON[l]}</span>}
                {t ? fmtMetric(k, readMetric(t, k)) : '—'}
              </span>
              <SourceBadge metric={k} crewId={crewId} />
            </li>
          );
        })}
      </ul>
      <div className="border-t border-space-border px-3 py-1.5">
        <button type="button" onClick={() => onOpenTab(r.tab)} className="rounded-md px-1.5 py-0.5 text-sm text-calm hover:bg-calm/10">
          Open with charts in the tab below
        </button>
      </div>
    </div>
  );
}
