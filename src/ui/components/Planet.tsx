// Parça 3 · Kokpit'in ortasındaki dönen gezegen (ARES-1 yörüngede, Gezegen ekibi yüzeyde).
// Bilerek kırmızı değil: kırmızı yalnızca KRİTİK için. Renkler theme.ts → PLANET.
import { useMemo } from 'react';
import { COLORS, PLANET } from '../theme';

const W = 200; // dokunun bir tur genişliği (gezegen çapı)

function useReducedMotion() {
  return useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
}

/** Yüzey dokusu: bantlar ve kraterler. İki kopya yan yana çizilir, sola kaydıkça kesintisiz döner. */
function Surface({ dx }: { dx: number }) {
  return (
    <g transform={`translate(${dx} 0)`}>
      <path
        d="M50,92 C90,84 130,100 170,90 C200,84 230,94 250,90 L250,104 C220,110 190,98 160,106 C120,116 90,100 50,108 Z"
        fill={PLANET.band}
        opacity="0.55"
      />
      <path
        d="M50,150 C80,142 120,160 160,148 C200,138 230,156 250,150 L250,166 C220,172 190,158 150,170 C110,180 80,162 50,170 Z"
        fill={PLANET.dark}
        opacity="0.45"
      />
      <path
        d="M50,200 C90,194 140,212 180,200 C210,192 235,206 250,202 L250,214 C220,222 180,208 140,220 C100,230 80,212 50,218 Z"
        fill={PLANET.band}
        opacity="0.4"
      />
      <circle cx="88" cy="128" r="9" fill={PLANET.dark} opacity="0.5" />
      <circle cx="140" cy="186" r="6" fill={PLANET.dark} opacity="0.45" />
      <circle cx="196" cy="124" r="12" fill={PLANET.dark} opacity="0.4" />
      <circle cx="228" cy="176" r="5" fill={PLANET.dark} opacity="0.5" />
      <circle cx="118" cy="232" r="7" fill={PLANET.dark} opacity="0.35" />
    </g>
  );
}

// Düz çerçevede elips: merkez (150,150), rx 132, ry 38. Gemi saat yönünde: üstten (arkadan) geçer, alttan (önden) döner.
const ORBIT = 'M18,150 A132,38 0 1 1 282,150 A132,38 0 1 1 18,150';
const ORBIT_BACK = 'M18,150 A132,38 0 0 1 282,150';
const ORBIT_FRONT = 'M282,150 A132,38 0 0 1 18,150';

function Ship({ still }: { still: boolean }) {
  return (
    <g>
      <circle r="5" fill={COLORS.text} />
      <circle r="9" fill="none" stroke={COLORS.calm} strokeOpacity="0.7" />
      <animateMotion
        path={ORBIT}
        dur={still ? '1s' : '16s'}
        repeatCount={still ? '1' : 'indefinite'}
        fill="freeze"
        {...(still ? { keyPoints: '0.75;0.75', keyTimes: '0;1', calcMode: 'linear' } : {})}
      />
    </g>
  );
}

export function Planet({ size = 260 }: { size?: number }) {
  const still = useReducedMotion();
  return (
    <svg width={size} height={size} viewBox="0 0 300 300" role="img" aria-label="Mars ve yörüngedeki ARES-1 gemisi" className="max-w-full">
      <defs>
        <clipPath id="planet-clip">
          <circle cx="150" cy="150" r="100" />
        </clipPath>
        <clipPath id="orbit-front" clipPathUnits="userSpaceOnUse">
          <rect x="0" y="150" width="300" height="150" />
        </clipPath>
        <radialGradient id="planet-base" cx="38%" cy="34%" r="75%">
          <stop offset="0%" stopColor={PLANET.light} />
          <stop offset="60%" stopColor={PLANET.mid} />
          <stop offset="100%" stopColor={PLANET.dark} />
        </radialGradient>
        <radialGradient id="planet-shade" cx="36%" cy="32%" r="80%">
          <stop offset="55%" stopColor={PLANET.dark} stopOpacity="0" />
          <stop offset="100%" stopColor={COLORS.bg} stopOpacity="0.85" />
        </radialGradient>
        <radialGradient id="planet-atmo" cx="50%" cy="50%" r="50%">
          <stop offset="78%" stopColor={PLANET.atmosphere} stopOpacity="0" />
          <stop offset="88%" stopColor={PLANET.atmosphere} stopOpacity="0.28" />
          <stop offset="100%" stopColor={PLANET.atmosphere} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="150" cy="150" r="128" fill="url(#planet-atmo)" />
      {/* Yörünge düz çerçevede çizilir, sonra eğilir. Arka yarı gezegenin arkasında, ön yarı önünde. */}
      <g transform="rotate(-14 150 150)">
        <path d={ORBIT_BACK} fill="none" stroke={COLORS.calm} strokeOpacity="0.25" strokeDasharray="4 6" strokeWidth="1.5" />
        <Ship still={still} />
      </g>

      <circle cx="150" cy="150" r="100" fill="url(#planet-base)" />
      <g clipPath="url(#planet-clip)">
        <g>
          <Surface dx={0} />
          <Surface dx={W} />
          {!still && <animateTransform attributeName="transform" type="translate" from="0 0" to={`${-W} 0`} dur="48s" repeatCount="indefinite" />}
        </g>
        {/* Gezegen ekibinin konumu (EVA) */}
        <circle cx="168" cy="178" r="4" fill={COLORS.calm} />
        <circle cx="168" cy="178" r="4" fill="none" stroke={COLORS.calm} strokeWidth="1.5">
          {!still && <animate attributeName="r" values="4;12;4" dur="3s" repeatCount="indefinite" />}
          {!still && <animate attributeName="opacity" values="0.9;0;0.9" dur="3s" repeatCount="indefinite" />}
        </circle>
      </g>
      <circle cx="150" cy="150" r="100" fill="url(#planet-shade)" />

      <g transform="rotate(-14 150 150)">
        <path d={ORBIT_FRONT} fill="none" stroke={COLORS.calm} strokeOpacity="0.6" strokeDasharray="4 6" strokeWidth="1.5" />
        <g clipPath="url(#orbit-front)">
          <Ship still={still} />
        </g>
      </g>
    </svg>
  );
}
