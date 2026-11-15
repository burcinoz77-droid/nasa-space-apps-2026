// Parça 3 · Konsol: seçili astronot sütunu. Üstte kimlik ve dört temel değer, ortada 3B model (bölgeye göre
// renklenir, imleçte risk, tıklayınca ayrıntı), altında "Önemli durum" ve seçili bölgenin sağlık verileri.
// Başlıktaki "Testler" düğmesi Parça 4'ün psikolojik test panelini (PsychTestsPanel) geniş bir pencerede açar.
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { CREW_BY_ID } from '../../crew';
import { INCIDENT_LABELS } from '../../engine';
import { readMetric, type MetricKey } from '../../metrics';
import { dueTests, psychState } from '../../psych/analysis';
import { useTests } from '../../psych/store';
import { useAstra } from '../../store';
import type { CrewId, CrewStatus, Telemetry } from '../../types';
import { BodyPanel } from '../components/BodyPanel';
import { LevelBadge } from '../components/LevelBadge';
import { PsychTestsPanel } from '../components/PsychTests';
import { VISOR_EVENT } from '../cinematic/phases';
import { RangeNote } from '../components/RangeNote';
import { worstIncidentOf } from '../earthLink';
import { fmtMetric, LOCATION_LONG, signalLevel } from '../format';
import { alpha, COLORS, fmt, LEVEL_COLOR, LEVEL_ICON, LEVEL_LABEL, scoreLevel } from '../theme';
import { Tile } from './Tile';

const VITALS: { k: MetricKey; label: string }[] = [
  { k: 'cardio.hr_bpm', label: 'Heart rate' },
  { k: 'cardio.spo2_pct', label: 'SpO₂' },
  { k: 'resp.coreTemp_C', label: 'Core temp' },
];

export function CrewDetail({ crewId }: { crewId: CrewId }) {
  const { t, st } = useAstra(useShallow((s) => ({ t: s.telemetry[crewId], st: s.statuses[crewId] })));
  const m = CREW_BY_ID[crewId];
  const [tests, setTests] = useState(false);
  return (
    <Tile
      area="det"
      title={m.name}
      meta={
        <>
          {/* Kask vizörü yalnız uzay yürüyüşündekilerde (Burçin, PR #24) */}
          {m.location === 'GEZEGEN' && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent(VISOR_EVENT, { detail: crewId }))}
              className="flex items-center gap-1.5 rounded bg-calm/15 px-2 py-0.5 text-sm font-semibold text-calm ring-1 ring-calm/70 hover:bg-calm/25"
              title="Show what this astronaut sees on the helmet HUD"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 13a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
                <path d="M7 12.5a5 5 0 0 1 10 0v1.5H7z" fill="currentColor" fillOpacity="0.25" />
              </svg>
              HUD
            </button>
          )}
          <TestsButton crewId={crewId} onOpen={() => setTests(true)} />
          <LevelBadge level={st?.level} />
        </>
      }
      bodyClass="p-3"
    >
      {tests && <TestsDialog crewId={crewId} onClose={() => setTests(false)} />}
      <p className="-mt-1 mb-2 text-sm text-slate-400">
        {m.role} · {m.unit} · {LOCATION_LONG[m.location]}
      </p>
      <div className="mb-3 grid grid-cols-2 gap-px overflow-hidden rounded-md bg-space-border">
        <div className="flex items-baseline justify-between gap-2 bg-space-bg/70 px-2.5 py-1.5">
          <div className="text-sm text-slate-400">Health score</div>
          <div className="font-mono text-lg leading-tight" style={{ color: st ? LEVEL_COLOR[scoreLevel(st.healthScore) ?? 'normal'] : COLORS.offline }}>
            {fmt(st?.healthScore)}%
          </div>
        </div>
        {VITALS.map((v) => (
          <Vital key={v.k} crewId={crewId} t={t} st={st} k={v.k} label={v.label} />
        ))}
      </div>
      <BodyPanel key={crewId} crewId={crewId} status={st} t={t} height={300} slot={<KeyStatus crewId={crewId} st={st} />} />
    </Tile>
  );
}

function Vital({ crewId, t, st, k, label }: { crewId: CrewId; t: Telemetry | undefined; st: CrewStatus | undefined; k: MetricKey; label: string }) {
  const l = signalLevel(st, k);
  const off = l && l !== 'normal';
  const v = t ? readMetric(t, k) : undefined;
  return (
    <div className="min-w-0 bg-space-bg/70 px-2.5 py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm text-slate-400">{label}</span>
        <span className="font-mono text-lg leading-tight whitespace-nowrap" style={{ color: off ? LEVEL_COLOR[l] : COLORS.text }}>
          {off && <span className="mr-0.5 text-sm">{LEVEL_ICON[l]}</span>}
          {t ? fmtMetric(k, v) : '—'}
        </span>
      </div>
      <div className="text-right">
        <RangeNote crewId={crewId} k={k} value={v} />
      </div>
    </div>
  );
}

/** Önemli durum: kişinin en ağır açık olayı; yoksa "önemli durum yok". */
function KeyStatus({ crewId, st }: { crewId: CrewId; st: CrewStatus | undefined }) {
  const inc = useAstra((s) => worstIncidentOf(s.incidents, crewId));
  if (!inc)
    return (
      <div className="rounded-md px-3 py-2 text-sm" style={{ backgroundColor: alpha(COLORS.normal, 0.08), boxShadow: `inset 3px 0 0 ${COLORS.normal}` }}>
        <span className="font-semibold" style={{ color: COLORS.normal }}>
          ● No significant findings
        </span>
        <span className="text-slate-300"> · values within personal baseline</span>
      </div>
    );
  const c = LEVEL_COLOR[inc.level];
  return (
    <div className="rounded-md px-3 py-2 text-sm" style={{ backgroundColor: alpha(c, 0.1), boxShadow: `inset 3px 0 0 ${c}` }}>
      <div className="flex flex-wrap items-center gap-x-2">
        <span className="font-semibold text-slate-200">Key finding</span>
        <span className="font-mono font-medium" style={{ color: c }}>
          {LEVEL_ICON[inc.level]} {LEVEL_LABEL[inc.level]} · {INCIDENT_LABELS[inc.type]}
        </span>
        {st?.restRequired && <span className="ml-auto text-slate-300">medical bay · mandatory crew rest</span>}
      </div>
      <p className="mt-0.5 text-white">{inc.title}</p>
    </div>
  );
}

/** Parça 4'ün psikolojik testleri: ASTRA'nın önerdiği test sayısı, öncelikli varsa sarı; psikolojik durum normal değilse simgesi. */
function TestsButton({ crewId, onOpen }: { crewId: CrewId; onOpen: () => void }) {
  const a = useAstra((s) => s);
  const ts = useTests((s) => s);
  const due = dueTests(crewId, a, ts);
  const urgent = due.filter((d) => d.oncelik === 'öncelikli').length;
  const level = psychState(crewId, a, ts).seviye;
  const c = level !== 'normal' ? LEVEL_COLOR[level] : urgent ? COLORS.caution : COLORS.ai;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-1.5 rounded px-2 py-0.5 text-sm font-semibold hover:bg-white/5"
      style={{ color: c, boxShadow: `inset 0 0 0 1px ${alpha(c, 0.6)}` }}
      title={due.length ? `ASTRA recommends ${due.length} test${due.length === 1 ? '' : 's'}${urgent ? `, ${urgent} priority` : ''}` : 'Psychological tests'}
    >
      {level !== 'normal' && <span aria-label={LEVEL_LABEL[level]}>{LEVEL_ICON[level]}</span>}
      Tests
      {due.length > 0 && <span className="font-mono">{urgent ? `▲${urgent}` : due.length}</span>}
    </button>
  );
}

/** Test paneli konsolun üstünde geniş pencerede: soru formları dar sütuna sığmaz. Esc ya da Kapat ile kapanır. */
function TestsDialog({ crewId, onClose }: { crewId: CrewId; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-6" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Psychological tests: ${CREW_BY_ID[crewId].name}`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-[1080px] flex-col overflow-hidden rounded-md border border-space-border bg-space-panel shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-space-border bg-chrome px-4 py-2.5">
          <h2 className="text-lg font-bold text-white">Psychological tests · {CREW_BY_ID[crewId].name}</h2>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-md px-3 py-1 text-sm text-white ring-1 ring-white/40 hover:bg-white/10">
            Close
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <PsychTestsPanel key={crewId} crewId={crewId} />
        </div>
      </section>
    </div>
  );
}
