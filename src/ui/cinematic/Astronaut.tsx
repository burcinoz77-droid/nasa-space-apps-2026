// Parça 1 · Özgün astronot çizimi (SVG, telifsiz). Sinematiklerde mürettebatı gösterir.
//   stripe : kollardaki kimlik şeridi rengi (her astronota ayrı)
//   glow   : verilirse giysi o renkte parlar (uyarı durumu)
//   breath : bir nefesin süresi (sn); göğüs bu ritimle inip kalkar
//   fog    : 0–1, kask camındaki buğu (CO₂ birikimi)
import { useId } from 'react';

export function Astronaut({ stripe, glow, breath = 4.3, fog = 0, height = 150 }: { stripe: string; glow?: string; breath?: number; fog?: number; height?: number }) {
  const id = useId().replace(/:/g, '');
  const suit = `url(#suit-${id})`;
  return (
    <svg height={height} viewBox="-50 -66 100 166" style={{ overflow: 'visible', filter: glow ? `drop-shadow(0 0 10px ${glow})` : undefined, transition: 'filter .6s' }}>
      <defs>
        <linearGradient id={`suit-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#dfe5ec" />
          <stop offset="0.45" stopColor="#ffffff" />
          <stop offset="1" stopColor="#b9c2cd" />
        </linearGradient>
        <radialGradient id={`visor-${id}`} cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="0.35" stopColor="#d4a017" />
          <stop offset="1" stopColor="#5b3a06" />
        </radialGradient>
      </defs>

      {/* Bacaklar ve botlar */}
      {[-1, 1].map((s) => (
        <g key={s} transform={`scale(${s},1)`}>
          <path d="M3 34 L22 34 L23 86 L5 86 Z" fill={suit} stroke="#94a3b8" strokeWidth="0.8" />
          <rect x="5" y="54" width="17" height="11" rx="3" fill="#6b7280" />
          <path d="M3 86 L25 86 Q27 96 23 98 L3 98 Z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.8" />
          <rect x="3" y="95" width="22" height="3" rx="1.5" fill="#7dd3fc" />
        </g>
      ))}

      {/* Sırt çantası (gövdenin arkasında) */}
      <rect x="-30" y="-30" width="60" height="50" rx="10" fill="#cbd5e1" />

      {/* Kollar */}
      {[-1, 1].map((s) => (
        <g key={s} transform={`scale(${s},1)`}>
          <path d="M22 -22 Q36 -20 38 -2 L40 26 L28 28 L26 0 Z" fill={suit} stroke="#94a3b8" strokeWidth="0.8" />
          <path d="M37.2 -6 L27.2 -4 L27.6 2 L38 0 Z" fill={stripe} />
          <ellipse cx="34" cy="31" rx="7" ry="6" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="0.8" />
        </g>
      ))}

      {/* Gövde: nefesle inip kalkar */}
      <g style={{ transformBox: 'view-box', transformOrigin: '0px 34px', animation: `astro-breathe ${breath}s ease-in-out infinite` }}>
        <path d="M-24 -24 Q0 -32 24 -24 L24 36 Q0 42 -24 36 Z" fill={suit} stroke="#94a3b8" strokeWidth="0.8" />
        {/* Göğüs kontrol ünitesi */}
        <rect x="-13" y="-6" width="26" height="16" rx="3" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.8" />
        <circle cx="-6" cy="2" r="2.4" fill="#475569" />
        <circle cx="1" cy="2" r="2.4" fill="#475569" />
        <rect x="6" y="-1" width="4" height="6" rx="1" fill={stripe} />
        {/* Bel şeridi */}
        <rect x="-24" y="22" width="48" height="4" fill="#94a3b8" />
      </g>

      {/* Kask */}
      <circle cx="0" cy="-40" r="23" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />
      <ellipse cx="0" cy="-39" rx="17" ry="15" fill={`url(#visor-${id})`} />
      <ellipse cx="0" cy="-39" rx="17" ry="15" fill="#e2e8f0" opacity={Math.min(0.85, fog * 0.85)} style={{ transition: 'opacity .8s' }} />
      <path d="M-11 -48 Q-6 -53 1 -52" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.8" />
      <rect x="-3" y="-64" width="6" height="5" rx="1" fill={stripe} />

      <style>{'@keyframes astro-breathe { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(1.07, 1.035); } }'}</style>
    </svg>
  );
}
