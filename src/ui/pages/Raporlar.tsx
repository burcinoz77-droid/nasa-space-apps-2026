// Parça 2 · Raporlar = olay kaydı (incident ledger). Katman 1'in açtığı her olay, her otonom adım,
// her mürettebat onayı ve sistem notu burada, en yeni üstte. Kayıtlar Türkçe ve ekranda aynen görünür.
import { type ComponentType, useMemo, useState } from 'react';
import { CREW } from '../../crew';
import { ACTION_LABELS } from '../../engine';
import { controls } from '../../loop';
import { useAstra } from '../../store';
import type { CrewId, Incident, Level, LedgerEntry } from '../../types';
import { LevelBadge } from '../components/LevelBadge';
import { COLORS, fmt, LEVEL_COLOR, LEVEL_ICON, LEVEL_LABEL } from '../theme';

// Parça 4'ün mor "ASTRA açıklaması" kutusu. Dosya henüz yokken derleme bozulmasın diye glob ile
// yüklenir; src/ui/components/AstraExplanation.tsx eklendiği anda burada kendiliğinden görünür.
type ExplanationProps = { incidentId: string };
const astraModules = import.meta.glob<{ AstraExplanation?: ComponentType<ExplanationProps> }>('../components/AstraExplanation.tsx', { eager: true });
const AstraExplanation = Object.values(astraModules)[0]?.AstraExplanation;

type Filter = 'all' | 'incidents' | 'actions';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'incidents', label: 'Events' },
  { id: 'actions', label: 'Automatic actions' },
];

const INCIDENT_KINDS = new Set<LedgerEntry['kind']>(['INCIDENT_OPENED', 'INCIDENT_RESOLVED', 'ACK']);
const matches = (e: LedgerEntry, f: Filter) =>
  f === 'all' || (f === 'actions' ? e.kind === 'AUTO_ACTION' : INCIDENT_KINDS.has(e.kind) || (e.kind === 'SYSTEM' && !!e.incidentId));

const KIND_LABEL: Record<LedgerEntry['kind'], string> = {
  INCIDENT_OPENED: 'EVENT',
  INCIDENT_RESOLVED: 'RESOLVED',
  AUTO_ACTION: 'AUTO ACTION',
  ACK: 'ACK',
  SCENARIO: 'SCENARIO',
  SYSTEM: 'SYSTEM',
};

const PAGE = 150;
const shortName = (id: CrewId) => CREW.find((c) => c.id === id)?.name.replace(/^Dr\. /, '').split(' ')[0] ?? id;

/** Satırın sol kenar rengi: olaya bağlı kayıtlarda olayın seviyesi, diğerlerinde anlamına göre. */
function rowColor(e: LedgerEntry, inc: Incident | undefined): string {
  if (e.kind === 'INCIDENT_RESOLVED') return COLORS.normal;
  if (e.kind === 'ACK' || e.kind === 'SCENARIO') return COLORS.calm;
  if (inc) return LEVEL_COLOR[inc.level];
  return COLORS.offline;
}

export function Raporlar({ crewId }: { crewId?: CrewId } = {}) {
  const ledger = useAstra((s) => s.ledger);
  const incidents = useAstra((s) => s.incidents);
  const explanations = useAstra((s) => s.explanations);
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<CrewId>(crewId ?? CREW[0].id);
  const [limit, setLimit] = useState(PAGE);

  const byId = useMemo(() => new Map(incidents.map((i) => [i.id, i])), [incidents]);
  const shown = useMemo(() => ledger.filter((e) => matches(e, filter)), [ledger, filter]);
  const counts = useMemo(
    () => ({ all: ledger.length, incidents: ledger.filter((e) => matches(e, 'incidents')).length, actions: ledger.filter((e) => e.kind === 'AUTO_ACTION').length }),
    [ledger],
  );
  const openIncidents = incidents.filter((i) => i.status !== 'resolved');
  const openCritical = openIncidents.some((i) => i.level === 'critical');

  function snapshotReport() {
    const s = useAstra.getState();
    const t = s.telemetry[selected];
    const st = s.statuses[selected];
    const name = CREW.find((c) => c.id === selected)!.name;
    if (!t || !st) {
      s.addLedger([{ id: `rep-${Date.now()}`, at: Date.now(), kind: 'SYSTEM', text: `Telemetry snapshot · ${name}: no data yet`, crewIds: [selected] }]);
      return;
    }
    const parts = [
      `health ${fmt(st.healthScore)}% (${LEVEL_ICON[st.level]} ${LEVEL_LABEL[st.level]})`,
      `heart rate ${fmt(t.cardio.hr_bpm)} bpm`,
      `SpO₂ ${fmt(t.cardio.spo2_pct)}%`,
      `core temp ${fmt(t.resp.coreTemp_C, 1)} °C`,
      `ppCO₂ ${fmt(t.env.ppCO2_mmHg, 1)} mmHg`,
    ];
    if (st.restRequired) parts.push('on mandatory crew rest');
    s.addLedger([{ id: `rep-${Date.now()}`, at: Date.now(), kind: 'SYSTEM', text: `Telemetry snapshot · ${name}: ${parts.join(' · ')}`, crewIds: [selected] }]);
  }

  return (
    <div className="space-y-4">
      {/* Özet */}
      <div className="grid grid-cols-3 gap-4">
        <Stat
          title="Open events"
          value={String(openIncidents.length)}
          color={openIncidents.length ? (openCritical ? COLORS.critical : COLORS.caution) : COLORS.normal}
        />
        <Stat title="Automatic actions" value={String(counts.actions)} color={COLORS.calm} />
        <Stat title="Total entries" value={String(counts.all)} color={COLORS.text} />
      </div>

      {/* Araç çubuğu: filtre + anlık rapor */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-space-border bg-space-panel p-3">
        <div className="flex gap-1 rounded-xl bg-white/5 p-1" role="tablist" aria-label="Log filter">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => {
                setFilter(f.id);
                setLimit(PAGE);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm ${filter === f.id ? 'bg-calm/20 font-semibold text-calm ring-1 ring-calm/50' : 'text-slate-300 hover:bg-white/5'}`}
            >
              {f.label} <span className="font-mono text-slate-400">{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-400" htmlFor="rapor-astronot">
            Astronaut
          </label>
          <select
            id="rapor-astronot"
            value={selected}
            onChange={(e) => setSelected(e.target.value as CrewId)}
            className="rounded-lg border border-space-border bg-space-bg px-2 py-1.5 text-sm"
          >
            {CREW.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button onClick={snapshotReport} className="rounded-lg bg-calm/15 px-3 py-1.5 text-sm font-semibold text-calm ring-1 ring-calm/50 hover:bg-calm/25">
            Create telemetry snapshot
          </button>
        </div>
      </div>

      {/* Kayıt listesi */}
      <div className="space-y-2">
        {shown.length === 0 && (
          <div className="rounded-xl border border-space-border bg-space-panel p-4 text-sm text-slate-400">
            {filter === 'all' ? 'No entries yet.' : 'No entries for this filter. No events are expected on a nominal day.'}
          </div>
        )}
        {shown.slice(0, limit).map((e) => (
          <LedgerRow key={e.id} entry={e} incident={e.incidentId ? byId.get(e.incidentId) : undefined} hasExplanation={!!(e.incidentId && explanations[e.incidentId])} />
        ))}
        {shown.length > limit && (
          <button
            onClick={() => setLimit((l) => l + PAGE)}
            className="w-full rounded-xl border border-space-border bg-space-panel py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            Show {fmt(Math.min(PAGE, shown.length - limit))} older entries
          </button>
        )}
      </div>
    </div>
  );
}

function LedgerRow({ entry: e, incident: inc, hasExplanation }: { entry: LedgerEntry; incident: Incident | undefined; hasExplanation: boolean }) {
  const color = rowColor(e, inc);
  const level: Level | undefined = e.kind === 'INCIDENT_OPENED' ? inc?.level : undefined;
  const isOpening = e.kind === 'INCIDENT_OPENED' && inc;
  // Açıklama: açık olaylarda istenir; çözülmüş olaylarda sadece zaten varsa gösterilir (gereksiz istek olmasın)
  const showExplanation = isOpening && AstraExplanation && (inc.status !== 'resolved' || hasExplanation);

  return (
    <div className="rounded-xl border border-space-border bg-space-panel p-3 pl-4" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-mono text-calm">{new Date(e.at).toLocaleTimeString('en-GB')}</span>
        <span
          className="rounded-md px-2 py-0.5 font-mono text-sm font-semibold"
          style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
        >
          {KIND_LABEL[e.kind]}
        </span>
        {level && <LevelBadge level={level} />}
        {e.crewIds && e.crewIds.length > 0 && <span className="text-slate-400">{e.crewIds.map(shortName).join(', ')}</span>}
        {isOpening && inc.status === 'open' && (
          <button
            onClick={() => controls.acknowledge(inc.id)}
            className="ml-auto rounded-lg px-3 py-1 text-sm font-semibold hover:bg-white/5"
            style={{ color: LEVEL_COLOR[inc.level], boxShadow: `inset 0 0 0 1px ${LEVEL_COLOR[inc.level]}` }}
          >
            Acknowledge
          </button>
        )}
        {isOpening && inc.status === 'acknowledged' && <span className="ml-auto text-sm text-calm">✓ Acknowledged</span>}
        {isOpening && inc.status === 'resolved' && <span className="ml-auto text-sm text-safe">● Resolved</span>}
      </div>
      <div className="mt-1 text-[15px] leading-snug">{e.text}</div>
      {isOpening && inc.autoActions.length > 0 && (
        <div className="mt-1 text-sm text-slate-400">Automatic action taken: {inc.autoActions.map((a) => `${ACTION_LABELS[a]} · automatic`).join(', ')}</div>
      )}
      {showExplanation && (
        <div className="mt-2">
          <AstraExplanation incidentId={inc.id} />
        </div>
      )}
    </div>
  );
}

function Stat({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl border border-space-border bg-space-panel p-4">
      <div className="text-sm text-slate-400">{title}</div>
      <div className="font-mono text-2xl font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
