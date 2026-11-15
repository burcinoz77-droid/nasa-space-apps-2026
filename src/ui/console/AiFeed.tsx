// Parça 3 · Konsol: "ASTRA iletileri" paneli. Üstte açık olaylar (Katman 1 açar; en ağırı en üstte) ve istenirse
// her birinin mor ASTRA açıklaması (Parça 4); altta son kayıtlar. Olaydaki kişiye tıklayınca konsol o kişiyi seçer.
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ACTION_LABELS, INCIDENT_LABELS } from '../../engine';
import { controls } from '../../loop';
import { METRIC_BY_KEY } from '../../metrics';
import { useAstra } from '../../store';
import type { CrewId, Incident, LedgerEntry } from '../../types';
import { AstraSlot, hasAstraExplanation } from '../components/AstraSlot';
import { firstName, fmtMetric } from '../format';
import { alpha, COLORS, LEVEL_COLOR, LEVEL_ICON, LEVEL_LABEL } from '../theme';
import { Tile } from './Tile';

const time = (ms: number) => new Date(ms).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const RANK = { critical: 2, caution: 1 } as const;

const KIND: Record<LedgerEntry['kind'], { icon: string; color: string }> = {
  INCIDENT_OPENED: { icon: '▲', color: COLORS.caution },
  INCIDENT_RESOLVED: { icon: '●', color: COLORS.normal },
  AUTO_ACTION: { icon: '✓', color: COLORS.calm },
  ACK: { icon: '✓', color: COLORS.textMuted },
  SCENARIO: { icon: '◆', color: COLORS.calm },
  SYSTEM: { icon: '·', color: COLORS.textMuted },
};

export function AiFeed({ onSelect }: { onSelect: (id: CrewId) => void }) {
  const active = useAstra(useShallow((s) => s.incidents.filter((i) => i.status !== 'resolved')));
  const ledger = useAstra(useShallow((s) => s.ledger.slice(0, 14)));
  const [expanded, setExpanded] = useState<string | null>(null);
  const list = [...active].sort((a, b) => RANK[b.level] - RANK[a.level] || b.openedAt - a.openedAt);

  return (
    <Tile
      area="ai"
      title="ASTRA iletileri"
      meta={
        <span className="font-mono" style={{ color: list.length ? COLORS.text : COLORS.textMuted }}>
          {list.length} açık olay
        </span>
      }
      bodyClass="p-0"
    >
      {list.length === 0 ? (
        <p className="px-3 py-3 text-sm text-slate-300">
          <span style={{ color: COLORS.normal }}>● </span>
          Tüm değerler kişisel normalinde. Yeni bir sapma olursa burada görünür.
        </p>
      ) : (
        <ul>
          {list.map((inc) => (
            <IncidentMessage
              key={inc.id}
              inc={inc}
              open={expanded === inc.id}
              onToggle={() => setExpanded((e) => (e === inc.id ? null : inc.id))}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}

      <div className="border-t border-space-border px-3 pt-2 pb-1 text-sm font-semibold text-slate-300">Son kayıtlar</div>
      <ol className="px-3 pb-2">
        {ledger.length === 0 && <li className="py-1 text-sm text-slate-400">Kayıt yok.</li>}
        {ledger.map((e) => (
          <li key={e.id} className="flex gap-2 py-0.5 text-sm">
            <span className="shrink-0 font-mono text-slate-400">{time(e.at)}</span>
            <span className="shrink-0" style={{ color: KIND[e.kind].color }} aria-hidden>
              {KIND[e.kind].icon}
            </span>
            <span className="min-w-0 text-slate-200">{e.text}</span>
          </li>
        ))}
      </ol>
    </Tile>
  );
}

function IncidentMessage({ inc, open, onToggle, onSelect }: { inc: Incident; open: boolean; onToggle: () => void; onSelect: (id: CrewId) => void }) {
  const c = LEVEL_COLOR[inc.level];
  const acked = inc.status === 'acknowledged';
  return (
    <li className="border-b border-space-border px-3 py-2.5" style={{ boxShadow: `inset 3px 0 0 ${c}` }}>
      <div className="flex flex-wrap items-center gap-x-2 text-sm">
        <span className="font-mono font-medium" style={{ color: c }}>
          {LEVEL_ICON[inc.level]} {LEVEL_LABEL[inc.level]}
        </span>
        <span className="text-slate-300">{INCIDENT_LABELS[inc.type]}</span>
        <span className="ml-auto font-mono text-slate-400">{time(inc.openedAt)}</span>
      </div>
      <p className="mt-0.5 leading-snug font-semibold text-white">{inc.title}</p>
      {inc.signals.length > 0 && (
        <p className="mt-0.5 text-sm text-slate-300">
          {inc.signals.slice(0, 2).map((s, i) => (
            <span key={s.key}>
              {i > 0 && ' · '}
              {METRIC_BY_KEY[s.key].label}{' '}
              <span className="font-mono" style={{ color: LEVEL_COLOR[s.level] }}>
                {fmtMetric(s.key, s.value)}
              </span>{' '}
              <span className="text-slate-400">(normal {fmtMetric(s.key, s.mean)})</span>
            </span>
          ))}
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm">
        {inc.crewIds.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className="rounded px-2 py-0.5 font-semibold text-white ring-1 ring-white/25 hover:bg-white/10"
            title="Konsolda bu kişiyi seç"
          >
            {firstName(id)}
          </button>
        ))}
        {inc.autoActions.map((a) => (
          <span key={a} className="rounded px-2 py-0.5" style={{ color: COLORS.calm, backgroundColor: alpha(COLORS.calm, 0.12) }}>
            ✓ {ACTION_LABELS[a]}
          </span>
        ))}
        <span className="ml-auto flex gap-1.5">
          {hasAstraExplanation && (
            <button type="button" onClick={onToggle} aria-expanded={open} className="rounded px-2 py-0.5 text-ai hover:bg-ai/10">
              ✦ {open ? 'Gizle' : 'Açıkla'}
            </button>
          )}
          {acked ? (
            <span className="px-1 py-0.5 text-slate-400">✓ onaylandı</span>
          ) : (
            <button
              type="button"
              onClick={() => controls.acknowledge(inc.id)}
              className="rounded px-2.5 py-0.5 font-semibold hover:bg-white/5"
              style={{ color: c, boxShadow: `inset 0 0 0 1px ${c}` }}
            >
              Onayla
            </button>
          )}
        </span>
      </div>
      {open && (
        <div className="mt-2">
          <AstraSlot incidentId={inc.id} />
        </div>
      )}
    </li>
  );
}
