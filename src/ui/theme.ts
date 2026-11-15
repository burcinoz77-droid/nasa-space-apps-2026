// Color system (Owner: Part 3). Color = meaning. Do not write color codes in other files, take them from here.
// Red is only for WARNING; never used for decoration (to avoid alarm fatigue).
// Alert colors follow the aviation rule: warning red, caution amber (14 CFR 25.1322).
import type { Level } from '../types';

export const COLORS = {
  bg: '#070B1A', // deep navy: easy on the eyes in a dark cabin
  panel: '#0E1530',
  border: '#1E2A4A',
  text: '#E6EDF7',
  textMuted: '#8EA0C0',
  calm: '#38BDF8', // blue: calm, advisory, main accent
  normal: '#34D399', // green: safe
  caution: '#FBBF24', // amber: caution, should be monitored
  critical: '#F87171', // red: emergency, immediate action
  ai: '#A78BFA', // purple: the voice of ASTRA (AI); kept separate from Layer 1 alerts
  offline: '#94A3B8', // gray: no data / no connection
} as const;

export const LEVEL_COLOR: Record<Level, string> = {
  normal: COLORS.normal,
  caution: COLORS.caution,
  critical: COLORS.critical,
};

// For color blindness, color never carries meaning alone: every level also has a label and a symbol.
export const LEVEL_LABEL: Record<Level, string> = { normal: 'NOMINAL', caution: 'CAUTION', critical: 'WARNING' };
export const LEVEL_ICON: Record<Level, string> = { normal: '●', caution: '▲', critical: '■' };

const LEVEL_RANK: Record<Level, number> = { normal: 0, caution: 1, critical: 2 };

/** The worse of two levels. */
export function worstLevel(...levels: (Level | undefined)[]): Level {
  let out: Level = 'normal';
  for (const l of levels) if (l && LEVEL_RANK[l] > LEVEL_RANK[out]) out = l;
  return out;
}

/**
 * Converts a domain score (0–100) to an on-screen color. Layer 1 domain score = 100 − 12 × Σ max(0, riskZ − 1).
 * Thresholds were measured in the simulation: on a nominal day no domain fell below 88 over 5 minutes,
 * so below 85 is CAUTION and below 60 is WARNING (no false alarms). Layer 1 still raises the actual alert.
 */
export const SCORE_CAUTION_BELOW = 85;
export const SCORE_CRITICAL_BELOW = 60;
export function scoreLevel(score: number | undefined): Level | undefined {
  if (score === undefined || Number.isNaN(score)) return undefined;
  if (score < SCORE_CRITICAL_BELOW) return 'critical';
  if (score < SCORE_CAUTION_BELOW) return 'caution';
  return 'normal';
}

/** Transparent color: hex + alpha (0–1). For backgrounds and glows. */
export function alpha(hex: string, a: number): string {
  const v = Math.round(Math.min(1, Math.max(0, a)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${v}`;
}

/** 36.8 -> "36.8"; number format for display only. */
export function fmt(value: number | undefined, decimals = 0): string {
  if (value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
