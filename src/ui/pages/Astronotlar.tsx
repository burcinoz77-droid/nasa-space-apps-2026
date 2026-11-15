// Parça 3 · Astronotlar: iki ekip başlığı (ekip ortalamasıyla) ve altı kart.
// Kart: konum, birim, rol, kişisel hassasiyet, sağlık skoru, seviye, nabız mini grafiği.
// Karta tıklayınca o kişinin Astronot Ekranı açılır (seçili kişi App.tsx'te tutulur).
import { useShallow } from 'zustand/react/shallow';
import { CREW } from '../../crew';
import { useAstra } from '../../store';
import type { CrewId, CrewLocation, CrewMember } from '../../types';
import { Card } from '../components/Card';
import { LevelBadge } from '../components/LevelBadge';
import { SourceBadge } from '../components/SourceBadge';
import { Sparkline } from '../components/Sparkline';
import { averageScore, fmtMetric, initials, LOCATION_LONG } from '../format';
import { alpha, COLORS, fmt, LEVEL_COLOR, LEVEL_ICON, scoreLevel } from '../theme';

const TEAMS: { loc: CrewLocation; title: string }[] = [
  { loc: 'KOKPIT', title: 'Orbit crew (IVA)' },
  { loc: 'GEZEGEN', title: 'Surface crew' },
];

export function Astronotlar({ onOpenCrew }: { onOpenCrew: (id: CrewId) => void }) {
  const statuses = useAstra((s) => s.statuses);
  return (
    <div className="space-y-6">
      {TEAMS.map(({ loc, title }) => {
        const members = CREW.filter((m) => m.location === loc);
        const avg = averageScore(
          statuses,
          members.map((m) => m.id),
        );
        const l = scoreLevel(avg);
        return (
          <section key={loc} aria-label={title}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">{title}</h2>
                <div className="text-sm text-slate-400">{LOCATION_LONG[loc]}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-400">Team average</span>
                <span className="font-mono text-xl font-bold tabular-nums" style={{ color: l ? LEVEL_COLOR[l] : COLORS.offline }}>
                  {fmt(avg)}%
                </span>
                <LevelBadge level={l} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 min-[1180px]:grid-cols-3">
              {members.map((m) => (
                <CrewCard key={m.id} m={m} onOpen={() => onOpenCrew(m.id)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CrewCard({ m, onOpen }: { m: CrewMember; onOpen: () => void }) {
  const { st, hr, openInc } = useAstra(
    useShallow((s) => ({
      st: s.statuses[m.id],
      hr: s.telemetry[m.id]?.cardio.hr_bpm,
      openInc: s.incidents.filter((i) => i.status !== 'resolved' && i.crewIds.includes(m.id)).length,
    })),
  );
  const c = st ? LEVEL_COLOR[st.level] : COLORS.offline;
  return (
    <Card
      onClick={onOpen}
      ariaLabel={`${m.name}: open astronaut view`}
      flush
      style={{ borderTop: `3px solid ${st && st.level !== 'normal' ? c : COLORS.border}` }}
    >
      <div className="p-4">
        <div className="flex items-center justify-between font-mono text-sm text-slate-400">
          <span>{m.location === 'KOKPIT' ? 'Orbit · IVA, inside the spacecraft' : 'Surface · EVA'}</span>
          <span>{m.unit}</span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-mono font-bold"
            style={{ color: c, backgroundColor: alpha(c, 0.14), boxShadow: `inset 0 0 0 2px ${alpha(c, 0.6)}` }}
            aria-hidden
          >
            {initials(m.id)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold">{m.name}</div>
            <div className="truncate text-sm" style={{ color: COLORS.calm }}>
              {m.role}
            </div>
          </div>
        </div>
        <div className="mt-2 truncate text-sm text-slate-400" title={m.sensitivity}>
          {m.sensitivity}
        </div>

        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <div className="text-sm text-slate-400">Health score</div>
            <div className="font-mono text-3xl leading-none font-bold tabular-nums" style={{ color: c }}>
              {fmt(st?.healthScore)}%
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <LevelBadge level={st?.level} pill />
            {st?.restRequired && (
              <span className="text-sm" style={{ color: COLORS.calm }}>
                ✓ Mandatory crew rest
              </span>
            )}
            {!st?.restRequired && openInc > 0 && (
              <span className="text-sm" style={{ color: c }}>
                {LEVEL_ICON[st?.level ?? 'caution']} {openInc} open incident(s)
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-space-border px-4 pt-2 pb-3">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-slate-400">Heart rate</span>
          <span className="flex items-center gap-2">
            <span className="font-mono font-semibold tabular-nums">{fmtMetric('cardio.hr_bpm', hr)}</span>
            <SourceBadge metric="cardio.hr_bpm" crewId={m.id} />
          </span>
        </div>
        <Sparkline crewId={m.id} metric="cardio.hr_bpm" height={40} color={st?.level === 'critical' ? COLORS.critical : COLORS.calm} />
      </div>
    </Card>
  );
}
