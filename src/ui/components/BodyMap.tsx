// Parça 3 · 2B vücut haritası: 3B model yüklenirken ya da tarayıcıda WebGL yoksa gösterilen yedek çizim.
// Bölgeler 3B modelle aynı: baş, göğüs (kollar dahil), alt gövde (karın ve bacaklar), çevre halkası.
import type { KeyboardEvent } from 'react';
import type { CrewStatus, Level } from '../../types';
import { REGION_BY_ID, regionState, type RegionId } from '../bodyRegions';
import { alpha, COLORS, LEVEL_COLOR } from '../theme';

function tone(level: Level | undefined, on: boolean) {
  const c = level ? LEVEL_COLOR[level] : COLORS.offline;
  const strong = (level && level !== 'normal') || on;
  return { c, fill: alpha(c, strong ? 0.34 : 0.14), glow: strong, pulse: level === 'critical' };
}

export function BodyMap({ status, selected, onSelect }: { status: CrewStatus | undefined; selected?: RegionId; onSelect?: (r: RegionId) => void }) {
  const t = (id: RegionId) => tone(regionState(status, id).level, selected === id);
  const head = t('head');
  const chest = t('chest');
  const lower = t('lower');
  const env = t('env');

  const regionProps = (id: RegionId) =>
    onSelect
      ? {
          role: 'button',
          tabIndex: 0,
          'aria-label': `${REGION_BY_ID[id].name}: ayrıntıyı göster`,
          onClick: () => onSelect(id),
          onKeyDown: (e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && onSelect(id),
          className: 'cursor-pointer focus:outline-none',
        }
      : {};

  const ARMS = 'M86,110 L70,168 L64,214 M174,110 L190,168 L196,214';
  const LEGS = 'M112,198 L107,262 L105,314 M148,198 L153,262 L155,314';
  const UPPER = 'M92,98 Q130,88 168,98 L176,110 L173,150 L87,150 L84,110 Z';
  const ABDOMEN = 'M87,150 L173,150 L170,198 Q130,208 90,198 Z';

  return (
    <svg
      viewBox="0 0 260 340"
      className="mx-auto h-full max-h-[340px] w-auto"
      role="img"
      aria-label="Vücut haritası (2B): bölgeler sağlık seviyesine göre renkli"
    >
      <defs>
        <filter id="bm-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <g {...regionProps('env')}>
        <ellipse cx="130" cy="322" rx="104" ry="14" fill="none" stroke={env.c} strokeWidth={env.glow ? 3 : 2} strokeDasharray="8 6" opacity="0.9" />
        <ellipse cx="130" cy="322" rx="104" ry="14" fill="none" stroke="transparent" strokeWidth="16" />
      </g>

      <g {...regionProps('lower')}>
        {lower.glow && (
          <g filter="url(#bm-glow)" opacity="0.6" className={lower.pulse ? 'astra-pulse' : ''}>
            <path d={ABDOMEN} fill={lower.c} />
            <path d={LEGS} stroke={lower.c} strokeWidth="18" strokeLinecap="round" fill="none" />
          </g>
        )}
        <path d={LEGS} stroke={lower.fill} strokeWidth="16" strokeLinecap="round" fill="none" />
        <path d={LEGS} stroke={lower.c} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />
        <path d={ABDOMEN} fill={lower.fill} stroke={lower.c} strokeWidth="2" />
      </g>

      <g {...regionProps('chest')}>
        {chest.glow && (
          <g filter="url(#bm-glow)" opacity="0.6" className={chest.pulse ? 'astra-pulse' : ''}>
            <path d={UPPER} fill={chest.c} />
            <path d={ARMS} stroke={chest.c} strokeWidth="18" strokeLinecap="round" fill="none" />
          </g>
        )}
        <path d={ARMS} stroke={chest.fill} strokeWidth="16" strokeLinecap="round" fill="none" />
        <path d={UPPER} fill={chest.fill} stroke={chest.c} strokeWidth="2" />
        <ellipse cx="115" cy="122" rx="12" ry="20" fill="none" stroke={chest.c} strokeWidth="1.5" />
        <ellipse cx="145" cy="122" rx="12" ry="20" fill="none" stroke={chest.c} strokeWidth="1.5" />
        <path d="M130,142 C121,135 118,128 123,124 C126,122 129,123 130,126 C131,123 134,122 137,124 C142,128 139,135 130,142 Z" fill={chest.c} />
      </g>

      <g {...regionProps('head')}>
        {head.glow && <circle cx="130" cy="56" r="30" fill={head.c} opacity="0.55" filter="url(#bm-glow)" className={head.pulse ? 'astra-pulse' : ''} />}
        <rect x="121" y="80" width="18" height="14" rx="4" fill={chest.fill} />
        <circle cx="130" cy="56" r="24" fill={head.fill} stroke={head.c} strokeWidth="2" />
        <circle cx="121" cy="60" r="2.6" fill={head.c} />
        <circle cx="139" cy="60" r="2.6" fill={head.c} />
      </g>
    </svg>
  );
}
