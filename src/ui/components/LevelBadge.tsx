// Part 3 · Level badge: color + symbol + text (● NOMINAL, ▲ CAUTION, ■ WARNING). All three together for color blindness.
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
