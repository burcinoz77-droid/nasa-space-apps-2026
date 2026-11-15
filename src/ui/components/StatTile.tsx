// Part 3 · Title + large number tile (the three summary tiles on Mission Status, the metrics on the Astronaut View).
import type { ReactNode } from 'react';
import { COLORS } from '../theme';

export function StatTile({
  title,
  value,
  unit,
  color = COLORS.text,
  icon,
  footer,
  badge,
  size = 'lg',
}: {
  title: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  color?: string;
  icon?: ReactNode;
  footer?: ReactNode;
  badge?: ReactNode;
  size?: 'lg' | 'md'; // md: for long text ("Intervention needed")
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-space-border bg-space-panel p-4">
      <div className="flex items-center justify-between gap-2 text-sm text-slate-400">
        <span className="flex min-w-0 items-center gap-2 truncate">
          {icon && <span aria-hidden>{icon}</span>}
          {title}
        </span>
        {badge}
      </div>
      <div className="mt-1 flex min-w-0 items-baseline gap-1.5">
        <span className={`truncate leading-tight font-bold tabular-nums ${size === 'lg' ? 'text-3xl' : 'text-[22px] min-[1180px]:text-2xl'}`} style={{ color }}>
          {value}
        </span>
        {unit && <span className="text-sm text-slate-400">{unit}</span>}
      </div>
      {footer && <div className="mt-1 min-w-0 text-sm text-slate-400">{footer}</div>}
    </div>
  );
}
