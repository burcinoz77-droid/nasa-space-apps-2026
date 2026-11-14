// Parça 2 · Kişisel baseline, yönlü z-skoru ve ardışık ölçüm (streak) kuralı.
// Her astronot × her ölçüm için bir MetricTracker vardır.
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

/** Welford yöntemiyle akan ortalama ve standart sapma (tek geçiş, sayısal olarak kararlı). */
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

/** Ölçümün riskli yönündeki z: high → max(z,0), low → max(−z,0), both → |z|. */
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
 * Bir astronotun bir ölçümünü izler.
 *  - İlk BASELINE_WINDOW ölçümde baseline öğrenir, sonra dondurur (anomali kendi normalini kirletmesin).
 *  - Ham seviye: mutlak eşik varsa o (NASA sınırı z-skorundan önce gelir), yoksa yönlü z-skoru.
 *  - Görünen seviye ancak STREAK_REQUIRED ardışık ölçüm aynı yönde kalırsa değişir (yukarı da aşağı da).
 */
export class MetricTracker {
  readonly key: MetricKey;
  private readonly badWhen: 'high' | 'low' | 'both';
  private readonly limit: AbsoluteLimit | undefined;
  private readonly useZ: boolean;
  readonly stat = new RunningStat();
  private recent: Level[] = []; // son STREAK_REQUIRED ham seviye
  level: Level = 'normal';
  streak = 0; // eşiği (≥ dikkat) üst üste kaç ölçümdür aşıyor
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

  /** Senaryo kalibrasyon bitmeden başlarsa baseline o ana kadarki ölçümlerle dondurulur. */
  freeze() {
    this.frozenEarly = true;
  }

  /** Yeni ölçümü işler ve güncel MetricScore'u döndürür. */
  push(value: number): MetricScore {
    let z = 0;
    let sd: number;
    if (!this.frozen) {
      this.stat.push(value); // kalibrasyon: baseline'a katılır, z hesaplanmaz
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
      const floor = this.recent.reduce(minLevel); // son 3 ölçümün hepsinin ulaştığı seviye
      const ceil = this.recent.reduce(maxLevel); // son 3 ölçümün hiçbirinin geçmediği seviye
      if (LEVEL_RANK[floor] > LEVEL_RANK[this.level]) this.level = floor;
      else if (LEVEL_RANK[ceil] < LEVEL_RANK[this.level]) this.level = ceil;
    }

    this.last = { key: this.key, value, mean: this.stat.mean, sd, z, streak: this.streak, level: this.level };
    return this.last;
  }

  /** Sağlık skorunda kullanılan risk z'si (dondurulmamışsa 0). */
  get riskZ(): number {
    return riskZ(this.last.z, this.badWhen);
  }
}
