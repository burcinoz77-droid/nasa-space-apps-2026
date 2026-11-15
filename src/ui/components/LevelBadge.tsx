// Parça 3 · Seviye rozeti: renk + simge + yazı (● NORMAL, ▲ DİKKAT, ■ KRİTİK). Renk körlüğü için üçü birlikte.
import type { Level } from '../../types';
import { alpha, COLORS, LEVEL_COLOR, LEVEL_ICON, LEVEL_LABEL } from '../theme';

export function LevelBadge({ level, pill = false }: { level: Level | undefined; pill?: boolean }) {
  if (!level)
    return (
      <span className="font-mono text-sm font-semibold whitespace-nowrap" style={{ color: COLORS.offline }}>
        ● NO DATA
      </span>
    );
  const color = LEVEL_COLOR[level];
  return (
    <span
      className={`font-mono text-sm font-semibold whitespace-nowrap ${pill ? 'rounded-full px-2 py-0.5' : ''}`}
      style={{ color, backgroundColor: pill ? alpha(color, 0.14) : undefined }}
    >
      {LEVEL_ICON[level]} {LEVEL_LABEL[level]}
    </span>
  );
}
