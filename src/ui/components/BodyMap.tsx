// Parça 3 · 2B vücut haritası (Astronot Ekranı). Her bölge Katman 1'in alan skorunun seviyesinde parlar:
//   baş = bilişsel ve göz (grup 4) · göğüs = kalp ve solunum (grup 1–2)
//   deri = biyokimya ve sıcaklık (grup 2–3) · çevre halkası = radyasyon, CO₂, uyku (grup 5)
// Renk tek başına anlam taşımaz: yandaki listede her bölgenin simgesi, yazısı ve skoru var.
import type { KeyboardEvent } from 'react';
import type { CrewStatus, Level } from '../../types';
import { REGIONS, regionState, type RegionId } from '../bodyRegions';
import { alpha, COLORS, fmt, LEVEL_COLOR, LEVEL_ICON, LEVEL_LABEL } from '../theme';

function tone(level: Level | undefined) {
  const c = level ? LEVEL_COLOR[level] : COLORS.offline;
  return { c, fill: alpha(c, level && level !== 'normal' ? 0.32 : 0.16), glow: level && level !== 'normal', pulse: level === 'critical' };
}

export function BodyMap({ status, onRegion }: { status: CrewStatus | undefined; onRegion?: (r: RegionId) => void }) {
  const st = Object.fromEntries(REGIONS.map((r) => [r.id, regionState(status, r.id)])) as Record<RegionId, ReturnType<typeof regionState>>;
  const head = tone(st.head.level);
  const chest = tone(st.chest.level);
  const skin = tone(st.skin.level);
  const env = tone(st.env.level);

  const regionProps = (id: RegionId) =>
    onRegion
      ? {
          role: 'button',
          tabIndex: 0,
          'aria-label': `${REGIONS.find((r) => r.id === id)!.name}: ayrıntıları aç`,
          onClick: () => onRegion(id),
          onKeyDown: (e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && onRegion(id),
          className: 'cursor-pointer focus:outline-none',
        }
      : {};

  return (
    <div className="@container">
      <div className="flex min-w-0 flex-col items-center gap-3 @[600px]:flex-row @[600px]:gap-6">
        <svg viewBox="0 0 260 340" className="h-[260px] w-auto shrink-0" role="img" aria-label="Vücut haritası: bölgeler sağlık seviyesine göre renkli">
          <defs>
            <filter id="bm-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>

          {/* Çevre halkası · grup 5 */}
          <g {...regionProps('env')}>
            {env.glow && (
              <ellipse
                cx="130"
                cy="172"
                rx="120"
                ry="160"
                fill="none"
                stroke={env.c}
                strokeWidth="10"
                opacity="0.45"
                filter="url(#bm-glow)"
                className={env.pulse ? 'astra-pulse' : ''}
              />
            )}
            <ellipse cx="130" cy="172" rx="120" ry="160" fill="none" stroke={env.c} strokeWidth="3" strokeDasharray="10 7" opacity="0.9" />
            <ellipse cx="130" cy="172" rx="120" ry="160" fill="none" stroke="transparent" strokeWidth="18" />
          </g>

          {/* Deri · biyokimya ve sıcaklık (gövde, kollar, bacaklar) */}
          <g {...regionProps('skin')}>
            {skin.glow && (
              <g filter="url(#bm-glow)" opacity="0.6" className={skin.pulse ? 'astra-pulse' : ''}>
                <path d="M92,98 Q130,88 168,98 L176,110 L170,198 Q130,208 90,198 L84,110 Z" fill={skin.c} />
                <path
                  d="M86,110 L70,168 L64,214 M174,110 L190,168 L196,214 M112,198 L107,262 L105,314 M148,198 L153,262 L155,314"
                  stroke={skin.c}
                  strokeWidth="18"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
            )}
            <path
              d="M86,110 L70,168 L64,214 M174,110 L190,168 L196,214 M112,198 L107,262 L105,314 M148,198 L153,262 L155,314"
              stroke={skin.fill}
              strokeWidth="16"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path d="M92,98 Q130,88 168,98 L176,110 L170,198 Q130,208 90,198 L84,110 Z" fill={skin.fill} stroke={skin.c} strokeWidth="2" />
            <rect x="121" y="80" width="18" height="14" rx="4" fill={skin.fill} />
          </g>

          {/* Göğüs · kalp ve solunum */}
          <g {...regionProps('chest')}>
            {chest.glow && (
              <ellipse cx="130" cy="134" rx="36" ry="32" fill={chest.c} opacity="0.55" filter="url(#bm-glow)" className={chest.pulse ? 'astra-pulse' : ''} />
            )}
            <ellipse cx="115" cy="130" rx="13" ry="23" fill={chest.fill} stroke={chest.c} strokeWidth="2" />
            <ellipse cx="145" cy="130" rx="13" ry="23" fill={chest.fill} stroke={chest.c} strokeWidth="2" />
            <path d="M130,150 C121,143 118,136 123,132 C126,130 129,131 130,134 C131,131 134,130 137,132 C142,136 139,143 130,150 Z" fill={chest.c} />
          </g>

          {/* Baş · bilişsel ve göz */}
          <g {...regionProps('head')}>
            {head.glow && <circle cx="130" cy="56" r="30" fill={head.c} opacity="0.55" filter="url(#bm-glow)" className={head.pulse ? 'astra-pulse' : ''} />}
            <circle cx="130" cy="56" r="24" fill={head.fill} stroke={head.c} strokeWidth="2" />
            <path d="M116,48 Q123,38 130,46 Q137,38 144,48" fill="none" stroke={head.c} strokeWidth="1.6" opacity="0.8" />
            <circle cx="121" cy="60" r="2.6" fill={head.c} />
            <circle cx="139" cy="60" r="2.6" fill={head.c} />
          </g>
        </svg>

        <ul className="grid w-full min-w-0 grid-cols-2 gap-2 @[600px]:flex-1">
          {REGIONS.map((r) => {
            const s = st[r.id];
            const c = s.level ? LEVEL_COLOR[s.level] : COLORS.offline;
            return (
              <li key={r.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onRegion?.(r.id)}
                  className="w-full min-w-0 rounded-xl border border-space-border bg-white/[0.02] px-3 py-2 text-left hover:bg-white/5"
                  style={{ borderLeft: `4px solid ${c}` }}
                  title={`${r.name}: ${r.detail} (${r.groups})`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold">{r.name}</span>
                    <span className="font-mono font-bold tabular-nums" style={{ color: c }}>
                      %{fmt(s.score)}
                    </span>
                  </span>
                  <span className="block font-mono text-sm font-semibold whitespace-nowrap" style={{ color: c }}>
                    {s.level ? `${LEVEL_ICON[s.level]} ${LEVEL_LABEL[s.level]}` : '—'}
                  </span>
                  <span className="block truncate text-sm text-slate-400">{r.detail}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
