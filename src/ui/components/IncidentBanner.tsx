// Parça 3 · Olay deneyimi (demonun kalbi). Uyarıyı her zaman Katman 1 açar; bu bileşen sadece gösterir.
//  - Açık KRİTİK olay: ekranın üstünde kırmızı bant. Başlık, etkilenen kişiler, uygulanan otonom adım ve "Onayla"
//    yapışkandır (sayfa kaysa da görünür). Hemen altında sinyaller (değer + birim + kişisel normal) ve
//    Parça 4'ün mor ASTRA açıklaması durur; bunlar sayfayla birlikte kayar, böylece tablette ekranı kapatmaz.
//  - Onaylanmış kritik olay: ince kırmızı şerit (sinyaller normale dönene kadar izleniyor).
//  - Açık DİKKAT olayı: amber tek satır bildirim, istenirse ayrıntı.
//  - Senaryonun gemi olayı (ship.activeEvents, örn. "CO₂ temizleyici durdu"): mavi bilgi satırı. Senaryo başlar başlamaz
//    görünür; Katman 1'in olayı ise sapma kişisel baseline'a göre 3 ölçüm sürünce açılır.
//  - dense (Kokpit konsolu): ayrıntılar açılmaz, dikkat bildirimleri tek satırda toplanır; ayrıntı ve ASTRA açıklaması
//    konsolun "ASTRA iletileri" panelindedir. Böylece bant konsolu aşağı itmez.
// Kritik bant NASA-STD-3001'e göre ters video: kırmızı zemin, beyaz yazı (yalnızca hemen eylem gereken olaylar için).
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

export function IncidentBanner({ onOpenCrew, dense = false }: { onOpenCrew?: (id: CrewId) => void; dense?: boolean }) {
  const active = useAstra(useShallow((s) => s.incidents.filter((i) => i.status !== 'resolved')));
  const events = useAstra(useShallow((s) => (s.ship && s.ship.scenario !== 'NORMAL' ? s.ship.activeEvents : [])));
  const [pick, setPick] = useState<string | null>(null); // birden çok kritik olay varsa hangisi gösteriliyor
  const [expanded, setExpanded] = useState<string | null>(null); // ayrıntısı açılan dikkat bildirimi
  const [compact, setCompact] = useState<Set<string>>(() => new Set()); // ayrıntısı gizlenen kritik olaylar

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
  const mainCompact = main ? dense || compact.has(main.id) : true;
  const openCaution = cautionOpen.find((i) => i.id === expanded);
  const toggleCompact = (id: string) =>
    setCompact((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Fragment: yapışkan kısmın kapsayıcısı doğrudan <main> olmalı, yoksa sayfa kayınca yapışmaz.
  return (
    <>
      <div className="sticky top-0 z-30 -mx-4 shrink-0 space-y-1.5 bg-space-bg/90 px-4 pt-0.5 pb-2 backdrop-blur" aria-live="assertive">
        {events.length > 0 && <EventLine events={events} />}
        {dense
          ? cautionOpen.length > 0 && <CautionSummary list={cautionOpen} />
          : cautionOpen
              .slice(0, 3)
              .map((i) => <CautionNotice key={i.id} inc={i} open={expanded === i.id} onToggle={() => setExpanded((e) => (e === i.id ? null : i.id))} />)}
        {!dense && cautionOpen.length > 3 && <div className="text-sm text-slate-400">+{cautionOpen.length - 3} more caution notices · see Reports</div>}
        {critAck.slice(0, dense ? 1 : 2).map((i) => (
          <Strip key={i.id} inc={i} note="Acknowledged · monitored until signals return to nominal" />
        ))}
        {main && (
          <CriticalHeader
            inc={main}
            others={critOpen.filter((i) => i !== main)}
            onPick={setPick}
            onOpenCrew={onOpenCrew}
            compact={mainCompact}
            onToggle={dense ? undefined : () => toggleCompact(main.id)}
          />
        )}
      </div>

      {main && !mainCompact && <Details inc={main} />}
      {!dense && openCaution && <Details inc={openCaution} onOpenCrew={onOpenCrew} withPeople />}
      {!dense && <div className="h-3" aria-hidden />}
    </>
  );
}

function EventLine({ events }: { events: string[] }) {
  const last = events[events.length - 1];
  return (
    <div
      className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
      style={{ color: COLORS.calm, backgroundColor: alpha(COLORS.calm, 0.08), borderColor: alpha(COLORS.calm, 0.35) }}
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
          title="Select this crew member in the console"
        >
          {firstName(id)}
        </button>
      ))}
    </span>
  );
}

function AutoActions({ inc, color = COLORS.calm }: { inc: Incident; color?: string }) {
  if (!inc.autoActions.length)
    return (
      <span className="text-sm" style={{ color: color === COLORS.calm ? COLORS.textMuted : color }}>
        No automatic action · crew decision
      </span>
    );
  return (
    <span className="flex flex-wrap gap-2">
      {inc.autoActions.map((a) => (
        <span key={a} className="rounded px-2 py-0.5 text-sm font-semibold" style={{ color, backgroundColor: alpha(color, 0.14) }}>
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
    <div className="flex min-w-0 flex-col rounded-md bg-black/25 px-3 py-2" style={{ boxShadow: `inset 0 0 0 1px ${alpha(c, 0.35)}` }}>
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

/** Kritik olayın yapışkan üst kısmı: ne oldu, kimde, sistem ne yaptı, onay. */
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
  onToggle?: () => void;
}) {
  const w = COLORS.text;
  return (
    <section role="alert" className="astra-alert overflow-hidden rounded-md" style={{ backgroundColor: COLORS.alarm, color: w }}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <span className="rounded px-2 py-0.5 font-mono text-sm font-medium" style={{ backgroundColor: w, color: COLORS.alarm }}>
          {LEVEL_ICON.critical} {LEVEL_LABEL.critical}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg leading-snug font-bold">{inc.title}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-semibold">{INCIDENT_LABELS[inc.type]}</span>
            <span className="font-mono">{time(inc.openedAt)}</span>
            <span className="flex items-center gap-1.5">
              Affected <CrewChips ids={inc.crewIds} color={w} onOpenCrew={onOpenCrew} />
            </span>
            <span className="flex items-center gap-1.5">
              <AutoActions inc={inc} color={w} />
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onToggle && (
            <button type="button" onClick={onToggle} className="rounded-md px-2.5 py-2 text-sm hover:bg-white/15" aria-expanded={!compact}>
              {compact ? 'Details ▾' : 'Collapse ▴'}
            </button>
          )}
          <button
            type="button"
            onClick={() => controls.acknowledge(inc.id)}
            className="rounded-md px-5 py-2 text-base font-bold hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            style={{ backgroundColor: w, color: COLORS.alarm }}
          >
            Acknowledge
          </button>
        </div>
      </div>

      {others.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-white/30 px-4 py-1.5 text-sm">
          <span>+{others.length} more warning events:</span>
          {others.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onPick(o.id)}
              className="max-w-[320px] truncate rounded px-2 py-0.5 font-semibold ring-1 ring-white/60 hover:bg-white/15"
            >
              {LEVEL_ICON.critical} {o.title}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** Olayın ayrıntısı: sinyaller ve ASTRA açıklaması. Yapışkan değildir, sayfayla kayar. */
function Details({ inc, onOpenCrew, withPeople = false }: { inc: Incident; onOpenCrew?: (id: CrewId) => void; withPeople?: boolean }) {
  const c = LEVEL_COLOR[inc.level];
  const single = inc.crewIds.length === 1 ? inc.crewIds[0] : undefined;
  return (
    <section
      className="mt-1 space-y-3 rounded-md border p-3"
      style={{ borderColor: alpha(c, 0.45), backgroundColor: alpha(c, 0.05) }}
      aria-label="Event details"
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
            <span className="text-slate-400">Action taken</span>
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
    <div className="flex items-center gap-3 rounded-md border px-3 py-1.5 text-sm" style={{ borderColor: alpha(c, 0.6), backgroundColor: alpha(c, 0.08) }}>
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

/** Konsolda dikkat bildirimleri tek satır: en yenisi + kaç tane daha. Ayrıntı ASTRA iletileri panelinde. */
function CautionSummary({ list }: { list: Incident[] }) {
  const c = COLORS.caution;
  const [first, ...rest] = list;
  return (
    <div
      className="flex items-center gap-3 rounded-md border px-3 py-1.5 text-sm"
      style={{ borderColor: alpha(c, 0.6), backgroundColor: alpha(c, 0.08) }}
      role="status"
    >
      <span className="font-mono font-medium whitespace-nowrap" style={{ color: c }}>
        {LEVEL_ICON.caution} {LEVEL_LABEL.caution}
      </span>
      <span className="min-w-0 flex-1 truncate">{first.title}</span>
      {rest.length > 0 && <span className="whitespace-nowrap text-slate-300">+{rest.length} bildirim</span>}
      <button
        type="button"
        onClick={() => controls.acknowledge(first.id)}
        className="rounded px-3 py-0.5 font-semibold whitespace-nowrap hover:bg-white/5"
        style={{ color: c, boxShadow: `inset 0 0 0 1px ${c}` }}
      >
        Acknowledge
      </button>
    </div>
  );
}

function CautionNotice({ inc, open, onToggle }: { inc: Incident; open: boolean; onToggle: () => void }) {
  const c = COLORS.caution;
  return (
    <div
      className="flex items-center gap-3 rounded-md border px-3 py-1.5 text-sm"
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
