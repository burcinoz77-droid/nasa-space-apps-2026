// Parça 4 · ASTRA'nın veri hafızası. Ortak durumu (useAstra) SADECE okur, kendi içinde tutar:
//  1) Kişisel normal: her astronot × her ölçüm için ilk 30 ölçümün ortalaması ve sapması (sonra donar).
//     Katman 1 de aynı yöntemi kullanır; ASTRA kendi kopyasını tutar çünkü 33 ölçümün hepsine ihtiyaç duyar.
//  2) Uzun geçmiş: her 5 ölçümde bir kayıt, en fazla 72 kayıt (yaklaşık 60 saat görev süresi).
// Ekranlardaki 120 ölçümlük kısa geçmişten (store.history) daha geriyi hatırlar.
// "Simülasyonu sıfırla" ile ortak durum boşalınca hafıza da sıfırlanır.
import { CREW } from '../crew';
import { METRICS, readMetric, type MetricKey } from '../metrics';
import { SIM } from '../sim/parameters';
import { useAstra } from '../store';
import type { CrewId } from '../types';

export const BASELINE_TICKS = 30;
export const SAMPLE_EVERY = 5;
export const MAX_SAMPLES = 72;

/** Bir ölçüm = kaç dakika görev süresi (demo hızlandırması). */
export const MISSION_MIN_PER_TICK = (SIM as { missionMinutesPerTick?: number }).missionMinutesPerTick ?? 10;

interface Stat {
  n: number;
  mean: number;
  m2: number;
}
export interface MemorySample {
  tick: number;
  missionDay?: number;
  values: Partial<Record<CrewId, Record<string, number>>>;
}

let tick = 0;
let baseline: Partial<Record<CrewId, Record<string, Stat>>> = {};
let samples: MemorySample[] = [];

function reset() {
  tick = 0;
  baseline = {};
  samples = [];
}

function record(s: ReturnType<typeof useAstra.getState>) {
  tick++;
  const snapshot: MemorySample = { tick, missionDay: s.ship?.missionDay, values: {} };
  for (const c of CREW) {
    const t = s.telemetry[c.id];
    if (!t) continue;
    const values: Record<string, number> = {};
    const stats = (baseline[c.id] ??= {});
    for (const m of METRICS) {
      const v = readMetric(t, m.key);
      values[m.key] = v;
      if (tick <= BASELINE_TICKS) {
        // Welford: tek geçişte ortalama ve sapma
        const st = (stats[m.key] ??= { n: 0, mean: 0, m2: 0 });
        st.n++;
        const d = v - st.mean;
        st.mean += d / st.n;
        st.m2 += d * (v - st.mean);
      }
    }
    snapshot.values[c.id] = values;
  }
  if (tick % SAMPLE_EVERY === 0 || tick === 1) {
    samples.push(snapshot);
    if (samples.length > MAX_SAMPLES) samples.shift();
  }
}

let started = false;
/** Hafızayı başlatır (bir kez). src/ai modülleri yüklenince kendiliğinden çağrılır. */
export function startMemory() {
  if (started) return;
  started = true;
  useAstra.subscribe((s, prev) => {
    if (Object.keys(s.telemetry).length === 0) {
      if (tick) reset();
      return;
    }
    if (s.telemetry !== prev.telemetry) record(s);
  });
}
startMemory();

/** Kişisel normal hazır mı (ilk 30 ölçüm doldu mu)? */
export function baselineReady(): boolean {
  return tick >= BASELINE_TICKS;
}

/** Bir ölçümün kişisel normali: ortalama ve sapma. Hazır değilse undefined. */
export function personalNormal(id: CrewId, key: MetricKey): { mean: number; sd: number } | undefined {
  const st = baseline[id]?.[key];
  if (!st || st.n < 5) return undefined;
  return { mean: st.mean, sd: st.n > 1 ? Math.sqrt(st.m2 / (st.n - 1)) : 0 };
}

/** Uzun geçmişten bir ölçümün değerleri (eskiden yeniye). */
export function longHistory(id: CrewId, key: MetricKey): number[] {
  return samples.map((x) => x.values[id]?.[key]).filter((v): v is number => typeof v === 'number');
}

/** Uzun geçmişin kapsadığı görev süresi (saat). */
export function longHistorySpanHours(): number {
  if (samples.length < 2) return 0;
  return ((samples[samples.length - 1].tick - samples[0].tick) * MISSION_MIN_PER_TICK) / 60;
}

/** Testler için. */
export function resetMemory() {
  reset();
}
