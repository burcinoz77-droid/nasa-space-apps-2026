// Part 3 · Incident experience (the heart of the demo). Layer 1 always raises the alert; this component only displays it.
//  - Open WARNING incident: red banner at the top of the screen. The title, affected people, the autonomous action applied and "Acknowledge"
//    are sticky (visible even when the page scrolls). Right below are the signals (value + unit + personal baseline) and
//    Part 4's purple ASTRA explanation; these scroll with the page, so they do not cover the screen on a tablet.
//  - Acknowledged Warning incident: thin red strip (monitored until the signals return to baseline).
//  - Open CAUTION incident: single amber notification line, details on request.
//  - The scenario's vehicle event (ship.activeEvents, e.g. "CO₂ scrubber stopped"): blue advisory line. Visible as soon as
//    the scenario starts; Layer 1's incident is raised once the deviation from the personal baseline lasts 3 readings.
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ACTION_LABELS, INCIDENT_LABELS } from '../../engine';
import { controls } from '../../loop';
import { METRIC_BY_KEY } from '../../metrics';
import { useAstra } from '../../store';
import type { CrewId, Incident, MetricScore } from '../../types';
import { firstName, fmtMetric, fmtZ } from '../format';
import { alpha, COLORS, LEVEL_COLOR, LEVEL_ICON, LEVEL_LABEL } from '../theme';
import { AstraSlot } from './AstraSlot';
import { SourceBadge } from './SourceBadge';

const time = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function IncidentBanner({ onOpenCrew }: { onOpenCrew?: (id: CrewId) => void }) {
  const active = useAstra(useShallow((s) => s.incidents.filter((i) => i.status !== 'resolved')));
  const events = useAstra(useShallow((s) => (s.ship && s.ship.scenario !== 'NORMAL' ? s.ship.activeEvents : [])));
  const [pick, setPick] = useState<string | null>(null); // which incident is shown if there is more than one Warning incident
  const [expanded, setExpanded] = useState<string | null>(null); // caution notification whose details are open
  const [compact, setCompact] = useState<Set<string>>(() => new Set()); // Warning incidents whose details are hidden

  const { critOpen, critAck, cautionOpen } = useMemo(
    () => ({
      critOpen: active.filter((i) => i.level === 'critical' && i.status === 'open'),
      critAck: active.filter((i) => i.level === 'critical' && i.status === 'acknowledged'),
      cautionOpen: active.filter((i) => i.level === 'caution' && i.status === 'open'),
    }),
    [active],
  );

  if (!critOpen.length && !critAck.length && !cautionOpen.length && !events.length) return null;
  const main = critOpen.find((i) => i.id === pick) ?? critOpen[0];
  const mainCompact = main ? compact.has(main.id) : true;
  const openCaution = cautionOpen.find((i) => i.id === expanded);
  const toggleCompact = (id: string) =>
    setCompact((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Fragment: the container of the sticky part must be <main> directly, otherwise it does not stick when the page scrolls.
  return (
    <>
      <div className="sticky top-0 z-30 -mx-5 space-y-2 bg-space-bg/90 px-5 pt-1 pb-2 backdrop-blur" aria-live="assertive">
        {events.length > 0 && <EventLine events={events} />}
        {cautionOpen.slice(0, 3).map((i) => (
          <CautionNotice key={i.id} inc={i} open={expanded === i.id} onToggle={() => setExpanded((e) => (e === i.id ? null : i.id))} />
        ))}
        {cautionOpen.length > 3 && <div className="text-sm text-slate-400">+{cautionOpen.length - 3} more caution notice(s) · see Reports</div>}
        {critAck.slice(0, 2).map((i) => (
          <Strip key={i.id} inc={i} note="Acknowledged · monitored until signals return to baseline" />
        ))}
        {main && (
          <CriticalHeader
            inc={main}
            others={critOpen.filter((i) => i !== main)}
            onPick={setPick}
            onOpenCrew={onOpenCrew}
            compact={mainCompact}
            onToggle={() => toggleCompact(main.id)}
          />
        )}
      </div>

      {main && !mainCompact && <Details inc={main} />}
      {openCaution && <Details inc={openCaution} onOpenCrew={onOpenCrew} withPeople />}
      <div className="h-3" aria-hidden />
    </>
  );
}

function EventLine({ events }: { events: string[] }) {
  const last = events[events.length - 1];
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm"
      style={{ color: COLORS.calm, backgroundColor: alpha(COLORS.calm, 0.08) }}
      title={events.join('\n')}
    >
      <span aria-hidden>◆</span>
      <span className="font-semibold whitespace-nowrap">Vehicle event</span>
      <span className="min-w-0 flex-1 truncate text-slate-200">{last}</span>
      {events.length > 1 && <span className="whitespace-nowrap text-slate-400">+{events.length - 1}</span>}
    </div>
  );
}

function CrewChips({ ids, color, onOpenCrew }: { ids: CrewId[]; color: string; onOpenCrew?: (id: CrewId) => void }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onOpenCrew?.(id)}
          className="rounded-full px-2.5 py-0.5 text-sm font-semibold hover:brightness-125"
          style={{ color, backgroundColor: alpha(color, 0.14), boxShadow: `inset 0 0 0 1px ${alpha(color, 0.4)}` }}
          title="Open astronaut view"
        >
          {firstName(id)}
        </button>
      ))}
    </span>
  );
}

function AutoActions({ inc }: { inc: Incident }) {
  if (!inc.autoActions.length) return <span className="text-sm text-slate-300">No autonomous action · decision is the crew's</span>;
  return (
    <span className="flex flex-wrap gap-2">
      {inc.autoActions.map((a) => (
        <span key={a} className="rounded-lg px-2.5 py-0.5 text-sm font-semibold" style={{ color: COLORS.calm, backgroundColor: alpha(COLORS.calm, 0.12) }}>
          ✓ {ACTION_LABELS[a]} · automatic
        </span>
      ))}
    </span>
  );
}

function SignalChip({ s, crewId }: { s: MetricScore; crewId?: CrewId }) {
  const m = METRIC_BY_KEY[s.key];
  const c = LEVEL_COLOR[s.level];
  return (
    <div className="flex min-w-0 flex-col rounded-xl bg-black/25 px-3 py-2" style={{ boxShadow: `inset 0 0 0 1px ${alpha(c, 0.35)}` }}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm text-slate-300" title={m.label}>
          {m.label}
        </span>
        <SourceBadge metric={s.key} crewId={crewId} />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2 leading-tight">
        <span className="font-mono text-lg font-bold tabular-nums" style={{ color: c }}>
          {fmtMetric(s.key, s.value)}
        </span>
        <span className="text-sm text-slate-400">
          baseline {fmtMetric(s.key, s.mean)}
          {Number.isFinite(s.z) && s.key !== 'env.doseCumulative_mSv' ? ` · ${fmtZ(s.z)}` : ''}
        </span>
      </div>
    </div>
  );
}

/** Sticky top part of a Warning incident: what happened, to whom, what the system did, acknowledgement. */
function CriticalHeader({
  inc,
  others,
  onPick,
  onOpenCrew,
  compact,
  onToggle,
}: {
  inc: Incident;
  others: Incident[];
  onPick: (id: string) => void;
  onOpenCrew?: (id: CrewId) => void;
  compact: boolean;
  onToggle: () => void;
}) {
  const c = COLORS.critical;
  return (
    <section
      role="alert"
      className="astra-alert overflow-hidden rounded-2xl border-2"
      style={{ borderColor: c, background: `linear-gradient(180deg, ${alpha(c, 0.22)}, ${alpha(c, 0.1)}), ${COLORS.panel}` }}
    >
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 pt-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="rounded-md px-2 py-0.5 font-mono font-bold text-space-bg" style={{ backgroundColor: c }}>
              {LEVEL_ICON.critical} {LEVEL_LABEL.critical}
            </span>
            <span className="font-semibold" style={{ color: c }}>
              {INCIDENT_LABELS[inc.type]}
            </span>
            <span className="font-mono text-slate-300">{time(inc.openedAt)}</span>
            <span className="text-slate-400">Raised by Layer 1</span>
          </div>
          <h2 className="mt-1 text-xl leading-snug font-bold text-white">{inc.title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={onToggle} className="rounded-lg px-2.5 py-2 text-sm text-slate-200 hover:bg-white/10" aria-expanded={!compact}>
            {compact ? 'Details ▾' : 'Collapse ▴'}
          </button>
          <button
            type="button"
            onClick={() => controls.acknowledge(inc.id)}
            className="rounded-xl px-5 py-2.5 text-base font-bold text-space-bg hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            style={{ backgroundColor: c, boxShadow: `0 6px 20px ${alpha(c, 0.35)}` }}
          >
            Acknowledge
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-3 text-sm">
        <span className="flex items-center gap-2">
          <span className="text-slate-400">Affected</span>
          <CrewChips ids={inc.crewIds} color={c} onOpenCrew={onOpenCrew} />
        </span>
        <span className="flex items-center gap-2">
          <span className="text-slate-400">Action applied</span>
          <AutoActions inc={inc} />
        </span>
      </div>

      {others.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2 text-sm" style={{ borderColor: alpha(c, 0.4) }}>
          <span className="text-slate-300">+{others.length} more warning(s):</span>
          {others.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onPick(o.id)}
              className="max-w-[320px] truncate rounded-lg px-2 py-0.5 font-semibold hover:bg-white/5"
              style={{ color: c, boxShadow: `inset 0 0 0 1px ${alpha(c, 0.5)}` }}
            >
              {LEVEL_ICON.critical} {o.title}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** Incident details: signals and ASTRA explanation. Not sticky, scrolls with the page. */
function Details({ inc, onOpenCrew, withPeople = false }: { inc: Incident; onOpenCrew?: (id: CrewId) => void; withPeople?: boolean }) {
  const c = LEVEL_COLOR[inc.level];
  const single = inc.crewIds.length === 1 ? inc.crewIds[0] : undefined;
  return (
    <section
      className="mt-1 space-y-3 rounded-2xl border p-3"
      style={{ borderColor: alpha(c, 0.45), backgroundColor: alpha(c, 0.05) }}
      aria-label="Incident details"
    >
      {withPeople && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="font-mono font-bold" style={{ color: c }}>
            {LEVEL_ICON[inc.level]} {inc.title}
          </span>
          <span className="flex items-center gap-2">
            <span className="text-slate-400">Affected</span>
            <CrewChips ids={inc.crewIds} color={c} onOpenCrew={onOpenCrew} />
          </span>
          <span className="flex items-center gap-2">
            <span className="text-slate-400">Action applied</span>
            <AutoActions inc={inc} />
          </span>
        </div>
      )}
      {inc.signals.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2">
          {inc.signals.slice(0, 4).map((s) => (
            <SignalChip key={s.key} s={s} crewId={single} />
          ))}
        </div>
      )}
      <AstraSlot incidentId={inc.id} />
    </section>
  );
}

function Strip({ inc, note }: { inc: Incident; note: string }) {
  const c = LEVEL_COLOR[inc.level];
  return (
    <div className="flex items-center gap-3 rounded-xl border px-3 py-1.5 text-sm" style={{ borderColor: alpha(c, 0.6), backgroundColor: alpha(c, 0.08) }}>
      <span className="font-mono font-bold whitespace-nowrap" style={{ color: c }}>
        {LEVEL_ICON[inc.level]} {LEVEL_LABEL[inc.level]}
      </span>
      <span className="min-w-0 flex-1 truncate">{inc.title}</span>
      <span className="hidden whitespace-nowrap text-slate-400 min-[1180px]:inline">{note}</span>
      <span className="whitespace-nowrap" style={{ color: COLORS.calm }}>
        ✓ Acknowledged
      </span>
    </div>
  );
}

function CautionNotice({ inc, open, onToggle }: { inc: Incident; open: boolean; onToggle: () => void }) {
  const c = COLORS.caution;
  return (
    <div
      className="flex items-center gap-3 rounded-xl border px-3 py-1.5 text-sm"
      style={{ borderColor: alpha(c, 0.6), backgroundColor: alpha(c, 0.08) }}
      role="status"
    >
      <span className="font-mono font-bold whitespace-nowrap" style={{ color: c }}>
        {LEVEL_ICON.caution} {LEVEL_LABEL.caution}
      </span>
      <span className="min-w-0 flex-1 truncate">{inc.title}</span>
      {inc.autoActions.length > 0 && (
        <span className="hidden whitespace-nowrap min-[1180px]:inline" style={{ color: COLORS.calm }}>
          ✓ {ACTION_LABELS[inc.autoActions[0]]} · automatic
        </span>
      )}
      <button type="button" onClick={onToggle} className="whitespace-nowrap text-slate-300 hover:text-white" aria-expanded={open}>
        {open ? 'Hide' : 'Details'}
      </button>
      <button
        type="button"
        onClick={() => controls.acknowledge(inc.id)}
        className="rounded-lg px-3 py-0.5 font-semibold whitespace-nowrap hover:bg-white/5"
        style={{ color: c, boxShadow: `inset 0 0 0 1px ${c}` }}
      >
        Acknowledge
      </button>
    </div>
  );
}
