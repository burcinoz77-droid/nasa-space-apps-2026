// Parça 3 · Konsol: "Astronotlar" paneli. Altı astronot, yerlerine göre iki sıra: gemide (yörüngede) ve uzay
// yürüyüşünde (Mars yüzeyinde). Halka rengi = seviye; seçili kişide ikinci, beyaz halka. Tıklayınca sağdaki
// 3B model ve sağlık verileri o kişiye geçer.
import { useShallow } from 'zustand/react/shallow';
import { CREW } from '../../crew';
import { useAstra } from '../../store';
import type { CrewId, CrewLocation } from '../../types';
import { initials } from '../format';
import { alpha, COLORS, fmt, LEVEL_COLOR, LEVEL_ICON, LEVEL_LABEL } from '../theme';
import { Tile } from './Tile';

const GROUPS: { loc: CrewLocation; title: string; where: string }[] = [
  { loc: 'KOKPIT', title: 'Gemide', where: 'Mars yörüngesi · ARES-1' },
  { loc: 'GEZEGEN', title: 'Uzay yürüyüşünde', where: 'Mars yüzeyi · EVA giysisi' },
];

export function CrewGrid({ selected, onSelect }: { selected: CrewId; onSelect: (id: CrewId) => void }) {
  return (
    <Tile area="crew" title="Astronotlar" meta={<span>kişiye tıklayın</span>} bodyClass="flex flex-col gap-2 px-3 py-2">
      {GROUPS.map((g) => (
        <div key={g.loc} className="min-w-0">
          <div className="mb-1 flex items-baseline gap-2 text-sm">
            <span className="font-semibold text-slate-200">{g.title}</span>
            <span className="text-slate-400">{g.where}</span>
          </div>
          <div className="grid grid-cols-3 gap-2" role="tablist" aria-label={`${g.title} astronotlar`}>
            {CREW.filter((m) => m.location === g.loc).map((m) => (
              <Person key={m.id} id={m.id} on={m.id === selected} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ))}
    </Tile>
  );
}

function Person({ id, on, onSelect }: { id: CrewId; on: boolean; onSelect: (id: CrewId) => void }) {
  const { st, t } = useAstra(useShallow((s) => ({ st: s.statuses[id], t: s.telemetry[id] })));
  const member = CREW.find((m) => m.id === id)!;
  const l = st?.level;
  const c = l ? LEVEL_COLOR[l] : COLORS.offline;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={() => onSelect(id)}
      className={`relative flex min-w-0 flex-col items-center rounded-md px-2 pt-2.5 pb-1.5 text-center transition-colors ${on ? 'bg-select/30 ring-1 ring-calm' : 'hover:bg-white/5'}`}
      title={`${member.name} · ${member.role}`}
    >
      {st?.restRequired && (
        <span className="absolute top-1 right-1 rounded px-1.5 text-sm" style={{ color: COLORS.caution, backgroundColor: alpha(COLORS.caution, 0.14) }}>
          revirde
        </span>
      )}
      <span
        className="flex h-[52px] w-[52px] items-center justify-center rounded-full font-display text-lg font-bold text-white"
        style={{
          backgroundColor: alpha(c, 0.14),
          boxShadow: on ? `inset 0 0 0 3px ${c}, 0 0 0 3px ${COLORS.panel}, 0 0 0 5px ${COLORS.text}` : `inset 0 0 0 3px ${c}`,
        }}
        aria-hidden
      >
        {initials(id)}
      </span>
      <span className="mt-1.5 block w-full truncate text-sm font-semibold text-white">{member.name.replace(/^Dr\.\s*/, '')}</span>
      <span className="flex items-center gap-1.5 font-mono text-sm whitespace-nowrap">
        <span style={{ color: c }} aria-label={l ? LEVEL_LABEL[l] : 'veri yok'}>
          {l ? LEVEL_ICON[l] : '○'} %{fmt(st?.healthScore)}
        </span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-200" title="Nabız">
          ♥ {fmt(t?.cardio.hr_bpm)}
        </span>
      </span>
    </button>
  );
}
