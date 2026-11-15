// Parça 3 · Konsol: seçili astronot sütunu. Üstte kimlik ve dört temel değer, ortada 3B model (bölgeye göre
// renklenir, imleçte risk, tıklayınca ayrıntı), altında "Önemli durum" ve seçili bölgenin sağlık verileri.
import { useShallow } from 'zustand/react/shallow';
import { CREW_BY_ID } from '../../crew';
import { INCIDENT_LABELS } from '../../engine';
import { readMetric, type MetricKey } from '../../metrics';
import { useAstra } from '../../store';
import type { CrewId, CrewStatus, Telemetry } from '../../types';
import { BodyPanel } from '../components/BodyPanel';
import { LevelBadge } from '../components/LevelBadge';
import { RangeNote } from '../components/RangeNote';
import { worstIncidentOf } from '../earthLink';
import { fmtMetric, LOCATION_LONG, signalLevel } from '../format';
import { alpha, COLORS, fmt, LEVEL_COLOR, LEVEL_ICON, LEVEL_LABEL, scoreLevel } from '../theme';
import { Tile } from './Tile';

const VITALS: { k: MetricKey; label: string }[] = [
  { k: 'cardio.hr_bpm', label: 'Nabız' },
  { k: 'cardio.spo2_pct', label: 'SpO₂' },
  { k: 'resp.coreTemp_C', label: 'Vücut ısısı' },
];

export function CrewDetail({ crewId }: { crewId: CrewId }) {
  const { t, st } = useAstra(useShallow((s) => ({ t: s.telemetry[crewId], st: s.statuses[crewId] })));
  const m = CREW_BY_ID[crewId];
  return (
    <Tile area="det" title={m.name} meta={<LevelBadge level={st?.level} />} bodyClass="p-3">
      <p className="-mt-1 mb-2 text-sm text-slate-400">
        {m.role} · {m.unit} · {LOCATION_LONG[m.location]}
      </p>
      <div className="mb-3 grid grid-cols-2 gap-px overflow-hidden rounded-md bg-space-border">
        <div className="flex items-baseline justify-between gap-2 bg-space-bg/70 px-2.5 py-1.5">
          <div className="text-sm text-slate-400">Sağlık skoru</div>
          <div className="font-mono text-lg leading-tight" style={{ color: st ? LEVEL_COLOR[scoreLevel(st.healthScore) ?? 'normal'] : COLORS.offline }}>
            %{fmt(st?.healthScore)}
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
          ● Önemli durum yok
        </span>
        <span className="text-slate-300"> · değerler kişisel normalinde</span>
      </div>
    );
  const c = LEVEL_COLOR[inc.level];
  return (
    <div className="rounded-md px-3 py-2 text-sm" style={{ backgroundColor: alpha(c, 0.1), boxShadow: `inset 3px 0 0 ${c}` }}>
      <div className="flex flex-wrap items-center gap-x-2">
        <span className="font-semibold text-slate-200">Önemli durum</span>
        <span className="font-mono font-medium" style={{ color: c }}>
          {LEVEL_ICON[inc.level]} {LEVEL_LABEL[inc.level]} · {INCIDENT_LABELS[inc.type]}
        </span>
        {st?.restRequired && <span className="ml-auto text-slate-300">revirde · zorunlu dinlenme</span>}
      </div>
      <p className="mt-0.5 text-white">{inc.title}</p>
    </div>
  );
}
