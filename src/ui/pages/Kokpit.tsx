// Parça 3 · Kokpit: görevin tek bakışta özeti.
// Üç kutu (aktif astronot, ortalama sağlık, görev durumu) · ekip listesi (Kokpit ve Gezegen, ekip ortalamasıyla)
// · ortada dönen gezegen · sağda görev ilerleme halkası. Tüm sayılar canlı veriden (useAstra).
import { useShallow } from 'zustand/react/shallow';
import { CREW } from '../../crew';
import { useAstra } from '../../store';
import type { CrewId, CrewLocation } from '../../types';
import { Card } from '../components/Card';
import { LevelBadge } from '../components/LevelBadge';
import { Planet } from '../components/Planet';
import { ProgressRing } from '../components/ProgressRing';
import { SourceBadge } from '../components/SourceBadge';
import { StatTile } from '../components/StatTile';
import { averageScore, fmtDelay, initials, LOCATION_LONG } from '../format';
import { UI_PARAMS } from '../params';
import { alpha, COLORS, fmt, LEVEL_COLOR, scoreLevel } from '../theme';

const TEAMS: CrewLocation[] = ['KOKPIT', 'GEZEGEN'];

export function Kokpit({ onOpenCrew }: { onOpenCrew: (id: CrewId) => void }) {
  const { ship, statuses, telemetry, incidents } = useAstra(
    useShallow((s) => ({ ship: s.ship, statuses: s.statuses, telemetry: s.telemetry, incidents: s.incidents })),
  );

  const live = CREW.filter((m) => telemetry[m.id]).length;
  const avg = averageScore(
    statuses,
    CREW.map((m) => m.id),
  );
  const avgLevel = scoreLevel(avg);
  const openInc = incidents.filter((i) => i.status !== 'resolved');
  const critical = openInc.filter((i) => i.level === 'critical');
  const rest = CREW.filter((m) => statuses[m.id]?.restRequired).length;

  const day = ship?.missionDay;
  const total = UI_PARAMS.missionDurationDays.value;
  const progress = day ? day / total : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatTile
          title="Aktif astronot"
          icon="◉"
          value={`${live}/${CREW.length}`}
          color={live === CREW.length ? COLORS.text : COLORS.offline}
          footer={rest ? `${rest} kişi zorunlu dinlenmede` : '3 Kokpit · 3 Gezegen'}
        />
        <StatTile
          title="Ortalama sağlık"
          icon="♥"
          value={`%${fmt(avg)}`}
          color={avgLevel ? LEVEL_COLOR[avgLevel] : COLORS.offline}
          badge={<LevelBadge level={avgLevel} />}
          footer="Katman 1 sağlık skoru, 6 kişi"
        />
        <StatTile
          title="Görev durumu"
          icon="◆"
          size="md"
          value={critical.length ? 'Müdahale gerekiyor' : 'Devam ediyor'}
          color={critical.length ? COLORS.critical : COLORS.normal}
          badge={<LevelBadge level={critical.length ? 'critical' : openInc.length ? 'caution' : 'normal'} />}
          footer={critical.length ? `${critical.length} kritik olay açık` : openInc.length ? `${openInc.length} dikkat bildirimi izleniyor` : 'Açık olay yok'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] min-[1180px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.85fr)]">
        {/* Ekip listesi */}
        <Card title="Mürettebat" right={<span className="text-sm text-slate-400">ARES-1</span>} className="min-[900px]:row-span-2 min-[1180px]:row-span-1">
          <div className="space-y-4">
            {TEAMS.map((loc) => {
              const members = CREW.filter((m) => m.location === loc);
              const teamAvg = averageScore(
                statuses,
                members.map((m) => m.id),
              );
              const tl = scoreLevel(teamAvg);
              return (
                <div key={loc}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 border-b border-space-border pb-1.5">
                    <div className="min-w-0">
                      <div className="font-semibold">{loc === 'KOKPIT' ? 'Kokpit ekibi' : 'Gezegen ekibi'}</div>
                      <div className="truncate text-sm text-slate-400">{LOCATION_LONG[loc]}</div>
                    </div>
                    <span className="shrink-0 font-mono text-sm tabular-nums" style={{ color: tl ? LEVEL_COLOR[tl] : COLORS.offline }}>
                      ort. %{fmt(teamAvg)}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {members.map((m) => {
                      const st = statuses[m.id];
                      const c = st ? LEVEL_COLOR[st.level] : COLORS.offline;
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => onOpenCrew(m.id)}
                            className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-white/5"
                            aria-label={`${m.name} astronot ekranını aç`}
                          >
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold"
                              style={{ color: c, backgroundColor: alpha(c, 0.14), boxShadow: `inset 0 0 0 2px ${alpha(c, 0.6)}` }}
                              aria-hidden
                            >
                              {initials(m.id)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{m.name}</span>
                              <span className="block truncate text-sm text-slate-400">
                                {m.role} · {m.unit}
                                {st?.restRequired ? ' · dinlenmede' : ''}
                              </span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span className="block font-mono font-bold tabular-nums" style={{ color: c }}>
                                %{fmt(st?.healthScore)}
                              </span>
                              <LevelBadge level={st?.level} />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Gezegen */}
        <Card className="flex flex-col items-center justify-center overflow-hidden">
          <div className="text-center">
            <div className="text-sm tracking-widest text-slate-400">ARES-1 · MARS YÖRÜNGESİ</div>
            <div className="mt-0.5 text-lg font-semibold">Gün {fmt(day)}</div>
          </div>
          <div className="astra-planet-wrap my-1">
            <Planet size={240} />
          </div>
          <div className="grid w-full grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-white/[0.03] px-3 py-2">
              <div className="text-slate-400">Kokpit ekibi</div>
              <div className="font-medium">Yörüngede · gemi içi</div>
            </div>
            <div className="rounded-xl bg-white/[0.03] px-3 py-2">
              <div className="text-slate-400">Gezegen ekibi</div>
              <div className="font-medium">Yüzeyde · EVA giysisi</div>
            </div>
          </div>
        </Card>

        {/* Görev ilerlemesi */}
        <Card title="Görev ilerlemesi" right={<SourceBadge param="missionDurationDays" />}>
          <div className="flex flex-col items-center gap-3">
            <ProgressRing value={progress} label={`Görev ilerlemesi yüzde ${fmt(progress * 100)}`}>
              <span className="text-3xl font-bold tabular-nums">%{fmt(progress * 100)}</span>
              <span className="text-sm text-slate-400">
                Gün {fmt(day)} / ~{fmt(total)}
              </span>
            </ProgressRing>
            <dl className="w-full space-y-2 text-sm">
              <div>
                <dt className="flex items-center justify-between gap-2 text-slate-400">
                  Dünya gecikmesi (tek yön) <SourceBadge param="commDelayDemo" />
                </dt>
                <dd className="font-mono text-base font-semibold whitespace-nowrap">{fmtDelay(ship?.commDelayOneWay_s)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Açık olay</dt>
                <dd className="font-mono" style={{ color: critical.length ? COLORS.critical : openInc.length ? COLORS.caution : COLORS.normal }}>
                  {openInc.length}
                </dd>
              </div>
            </dl>
            {ship && ship.activeEvents.length > 0 && (
              <ul className="w-full space-y-1 border-t border-space-border pt-2 text-sm">
                {ship.activeEvents.map((e) => (
                  <li key={e} className="flex gap-2">
                    <span style={{ color: COLORS.calm }} aria-hidden>
                      ◆
                    </span>
                    <span className="text-slate-300">{e}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
