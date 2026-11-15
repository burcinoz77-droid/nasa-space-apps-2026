// Parça 3 · Konsol: "Kokpit" paneli. Görevin durumu tek bakışta: genel seviye, görev günü, ekiplerin yeri,
// revir doluluğu, ortalama sağlık ve kabin havası. Hepsi canlı veriden.
import { useShallow } from 'zustand/react/shallow';
import { CREW } from '../../crew';
import { SCENARIO_NAMES } from '../../loop';
import { useAstra } from '../../store';
import type { Telemetry } from '../../types';
import { SourceBadge } from '../components/SourceBadge';
import { averageScore, firstName, fmtMetric } from '../format';
import { INFIRMARY_BEDS } from '../medical';
import { UI_PARAMS } from '../params';
import { COLORS, fmt, LEVEL_COLOR, LEVEL_ICON, scoreLevel, worstLevel } from '../theme';
import { Row, Tile } from './Tile';

const LEVEL_WORD = { normal: 'Nominal', caution: 'Caution', critical: 'Warning' } as const;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);

export function MissionTile() {
  const { ship, statuses, telemetry } = useAstra(useShallow((s) => ({ ship: s.ship, statuses: s.statuses, telemetry: s.telemetry })));
  const ids = CREW.map((m) => m.id);
  const live = ids.some((id) => statuses[id]);
  const level = live ? worstLevel(...ids.map((id) => statuses[id]?.level)) : undefined;
  const score = averageScore(statuses, ids);
  const scoreL = scoreLevel(score);
  const day = ship?.missionDay;
  const total = UI_PARAMS.missionDurationDays.value;
  const inBay = CREW.filter((m) => statuses[m.id]?.restRequired);
  const onShip = CREW.filter((m) => m.location === 'KOKPIT');
  const cabin = onShip.map((m) => telemetry[m.id]).filter((t): t is Telemetry => !!t);
  const co2 = avg(cabin.map((t) => t.env.ppCO2_mmHg));
  const o2 = avg(cabin.map((t) => t.env.o2_pct));

  return (
    <Tile
      area="mis"
      title="Mission status"
      meta={
        <span>
          mean health{' '}
          <span className="font-mono" style={{ color: score === undefined ? COLORS.offline : LEVEL_COLOR[scoreL ?? 'normal'] }}>
            {fmt(score)}%
          </span>
        </span>
      }
      bodyClass="px-3 py-0.5"
    >
      <Row label="Status" sub={ship ? SCENARIO_NAMES[ship.scenario] : 'awaiting telemetry'}>
        <span className="font-semibold" style={{ color: level ? LEVEL_COLOR[level] : COLORS.offline }}>
          {level ? `${LEVEL_ICON[level]} ${LEVEL_WORD[level]}` : '—'}
        </span>
      </Row>

      <Row
        mono
        label="Mission Day"
        sub={
          <span className="flex items-center justify-end gap-2">
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10" aria-hidden>
              <span className="block h-full bg-calm" style={{ width: `${day ? Math.min(100, (day / total) * 100) : 0}%` }} />
            </span>
            <SourceBadge param="missionDurationDays" />
          </span>
        }
      >
        {fmt(day)} <span className="text-slate-400">/ {fmt(total)}</span>
      </Row>

      <Row label="Crew">
        {onShip.length} IVA · {CREW.length - onShip.length} EVA
      </Row>

      <Row mono label="Medical bay" sub={inBay.length ? `${inBay.map((m) => firstName(m.id)).join(', ')} · mandatory crew rest` : undefined}>
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex gap-0.5" aria-hidden>
            {Array.from({ length: INFIRMARY_BEDS }, (_, i) => (
              <span key={i} className="h-3 w-2 rounded-[2px]" style={{ backgroundColor: i < inBay.length ? COLORS.caution : 'rgba(255,255,255,0.18)' }} />
            ))}
          </span>
          {inBay.length}/{INFIRMARY_BEDS}
        </span>
      </Row>

      <Row mono label="Cabin ppCO₂" sub={<SourceBadge metric="env.ppCO2_mmHg" crewId={onShip[0]?.id} />}>
        {fmtMetric('env.ppCO2_mmHg', co2)}
      </Row>
      <Row mono label="Cabin O₂">
        {fmtMetric('env.o2_pct', o2)}
      </Row>
    </Tile>
  );
}
