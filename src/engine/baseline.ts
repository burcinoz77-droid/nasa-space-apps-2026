// Part 2 · Personal baseline, directional z-score and consecutive-reading (streak) rule.
// There is one MetricTracker per astronaut × metric.
import { METRIC_BY_KEY, type MetricKey } from '../metrics';
import type { Level, MetricScore } from '../types';
import {
  ABSOLUTE_LIMITS,
  type AbsoluteLimit,
  BASELINE_WINDOW,
  LEVEL_RANK,
  SD_FLOOR,
  SD_FLOOR_DEFAULT_PCT,
  STREAK_REQUIRED,
  Z_CAUTION,
  Z_CRITICAL,
  Z_EXCLUDED,
} from './config';

/** Running mean and standard deviation with Welford's method (single pass, numerically stable). */
export class RunningStat {
  n = 0;
  mean = 0;
  m2 = 0;
  push(x: number) {
    this.n++;
    const d = x - this.mean;
    this.mean += d / this.n;
    this.m2 += d * (x - this.mean);
  }
  get sd() {
    return this.n > 1 ? Math.sqrt(this.m2 / (this.n - 1)) : 0;
  }
}

/** z in the metric's risky direction: high → max(z,0), low → max(−z,0), both → |z|. */
export function riskZ(z: number, badWhen: 'high' | 'low' | 'both'): number {
  if (badWhen === 'high') return Math.max(z, 0);
  if (badWhen === 'low') return Math.max(-z, 0);
  return Math.abs(z);
}

export function levelFromRiskZ(rz: number): Level {
  if (rz >= Z_CRITICAL) return 'critical';
  if (rz >= Z_CAUTION) return 'caution';
  return 'normal';
}

function beyond(value: number, limit: number, dir: AbsoluteLimit['dir'], inclusive: boolean): boolean {
  if (dir === 'above') return inclusive ? value >= limit : value > limit;
  return inclusive ? value <= limit : value < limit;
}

export function levelFromAbsolute(value: number, lim: AbsoluteLimit): Level {
  if (beyond(value, lim.critical, lim.dir, lim.inclusive)) return 'critical';
  if (beyond(value, lim.caution, lim.dir, lim.inclusive)) return 'caution';
  return 'normal';
}

export function sdFloor(key: MetricKey, mean: number): number {
  return SD_FLOOR[key] ?? Math.abs(mean) * SD_FLOOR_DEFAULT_PCT;
}

const maxLevel = (a: Level, b: Level): Level => (LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b);
const minLevel = (a: Level, b: Level): Level => (LEVEL_RANK[a] <= LEVEL_RANK[b] ? a : b);

/**
 * Tracks one metric of one astronaut.
 *  - Learns the baseline over the first BASELINE_WINDOW readings, then freezes it (so an anomaly does not contaminate its own baseline).
 *  - Raw level: the absolute threshold if there is one (a NASA limit takes precedence over the z-score), otherwise the directional z-score.
 *  - The displayed level only changes once STREAK_REQUIRED consecutive readings stay in the same direction (both up and down).
 */
export class MetricTracker {
  readonly key: MetricKey;
  private readonly badWhen: 'high' | 'low' | 'both';
  private readonly limit: AbsoluteLimit | undefined;
  private readonly useZ: boolean;
  readonly stat = new RunningStat();
  private recent: Level[] = []; // last STREAK_REQUIRED raw levels
  level: Level = 'normal';
  streak = 0; // for how many consecutive readings it has exceeded the threshold (≥ caution)
  last: MetricScore;

  constructor(key: MetricKey) {
    this.key = key;
    this.badWhen = METRIC_BY_KEY[key].badWhen;
    this.limit = ABSOLUTE_LIMITS[key];
    this.useZ = !Z_EXCLUDED.has(key);
    this.last = { key, value: 0, mean: 0, sd: 0, z: 0, streak: 0, level: 'normal' };
  }

  private frozenEarly = false;

  get frozen(): boolean {
    return this.frozenEarly || this.stat.n >= BASELINE_WINDOW;
  }

  /** If a scenario starts before calibration ends, the baseline is frozen with the readings so far. */
  freeze() {
    this.frozenEarly = true;
  }

  /** Processes a new reading and returns the current MetricScore. */
  push(value: number): MetricScore {
    let z = 0;
    let sd: number;
    if (!this.frozen) {
      this.stat.push(value); // calibration: added to the baseline, no z computed
      sd = Math.max(this.stat.sd, sdFloor(this.key, this.stat.mean));
    } else {
      sd = Math.max(this.stat.sd, sdFloor(this.key, this.stat.mean));
      z = this.useZ && sd > 0 ? (value - this.stat.mean) / sd : 0;
    }

    const rz = riskZ(z, this.badWhen);
    const raw: Level = this.limit ? levelFromAbsolute(value, this.limit) : this.useZ ? levelFromRiskZ(rz) : 'normal';

    this.streak = raw === 'normal' ? 0 : this.streak + 1;
    this.recent.push(raw);
    if (this.recent.length > STREAK_REQUIRED) this.recent.shift();
    if (this.recent.length === STREAK_REQUIRED) {
      const floor = this.recent.reduce(minLevel); // the level all of the last 3 readings reached
      const ceil = this.recent.reduce(maxLevel); // the level none of the last 3 readings exceeded
      if (LEVEL_RANK[floor] > LEVEL_RANK[this.level]) this.level = floor;
      else if (LEVEL_RANK[ceil] < LEVEL_RANK[this.level]) this.level = ceil;
    }

    this.last = { key: this.key, value, mean: this.stat.mean, sd, z, streak: this.streak, level: this.level };
    return this.last;
  }

  /** Risk z used in the health score (0 if not frozen yet). */
  get riskZ(): number {
    return riskZ(this.last.z, this.badWhen);
  }
}
