// Parça 3 · İlerleme halkası (Kokpit'te görev ilerlemesi).
import type { ReactNode } from 'react';
import { COLORS } from '../theme';

export function ProgressRing({
  value,
  size = 168,
  stroke = 12,
  color = COLORS.calm,
  children,
  label,
}: {
  value: number; // 0–1
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
  label: string; // ekran okuyucu için
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLORS.border} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
          style={{ transition: 'stroke-dasharray 600ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
