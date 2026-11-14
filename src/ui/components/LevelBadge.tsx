import type { Level } from '../../types';
import { LEVEL_COLOR, LEVEL_ICON, LEVEL_LABEL } from '../theme';

export function LevelBadge({ level }: { level: Level | undefined }) {
  if (!level) return <span className="text-slate-400">● VERİ YOK</span>;
  return (
    <span className="font-mono text-xs font-semibold" style={{ color: LEVEL_COLOR[level] }}>
      {LEVEL_ICON[level]} {LEVEL_LABEL[level]}
    </span>
  );
}
