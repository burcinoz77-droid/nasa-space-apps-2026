// Ölçüm kataloğu: her sayısal ölçümün adı, birimi, grubu ve "kötü yönü".
// Parça 1 (bilim) günceller; Parça 2 z-skoru için, Parça 3 etiket için,
// Parça 4 yapay zekâ bağlamı için okur.
import type { Biochem, Cardio, Cognitive, Environment, Respiratory, Telemetry } from './types';

type NumKeys<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T] & string;

export type MetricKey =
  | `cardio.${NumKeys<Cardio>}`
  | `resp.${NumKeys<Respiratory>}`
  | `biochem.${NumKeys<Biochem>}`
  | `cog.${NumKeys<Cognitive>}`
  | `env.${NumKeys<Environment>}`;

export interface MetricInfo {
  key: MetricKey;
  label: string; // ekranda görünen Türkçe ad
  unit: string; // ekranda görünen birim
  group: 1 | 2 | 3 | 4 | 5; // veri grubu
  badWhen: 'high' | 'low' | 'both'; // hangi yöndeki sapma risklidir
  cadence: 'live' | 'daily'; // canlı sensör mü, günde bir mi ölçülür
  decimals: number; // ekranda kaç ondalık
}

export const METRICS: MetricInfo[] = [
  // Veri grubu 1 · Kalp-damar
  { key: 'cardio.hr_bpm', label: 'Kalp atış hızı', unit: 'bpm', group: 1, badWhen: 'both', cadence: 'live', decimals: 0 },
  { key: 'cardio.hrv_rmssd_ms', label: 'Kalp hızı değişkenliği (HRV)', unit: 'ms', group: 1, badWhen: 'low', cadence: 'live', decimals: 0 },
  { key: 'cardio.ecg_ectopic_per_min', label: 'EKG düzensiz atım', unit: '/dk', group: 1, badWhen: 'high', cadence: 'live', decimals: 1 },
  { key: 'cardio.bp_sys_mmHg', label: 'Sistolik tansiyon', unit: 'mmHg', group: 1, badWhen: 'both', cadence: 'live', decimals: 0 },
  { key: 'cardio.bp_dia_mmHg', label: 'Diyastolik tansiyon', unit: 'mmHg', group: 1, badWhen: 'both', cadence: 'live', decimals: 0 },
  { key: 'cardio.spo2_pct', label: 'Oksijen doygunluğu (SpO₂)', unit: '%', group: 1, badWhen: 'low', cadence: 'live', decimals: 0 },
  // Veri grubu 2 · Solunum ve metabolik
  { key: 'resp.rr_bpm', label: 'Solunum sayısı', unit: 'nefes/dk', group: 2, badWhen: 'both', cadence: 'live', decimals: 0 },
  { key: 'resp.minuteVent_L_min', label: 'Dakika ventilasyonu', unit: 'L/dk', group: 2, badWhen: 'both', cadence: 'live', decimals: 1 },
  { key: 'resp.etco2_mmHg', label: 'Soluk sonu CO₂ (EtCO₂)', unit: 'mmHg', group: 2, badWhen: 'both', cadence: 'live', decimals: 0 },
  { key: 'resp.coreTemp_C', label: 'Çekirdek sıcaklık', unit: '°C', group: 2, badWhen: 'high', cadence: 'live', decimals: 1 },
  { key: 'resp.skinTemp_C', label: 'Deri sıcaklığı', unit: '°C', group: 2, badWhen: 'both', cadence: 'live', decimals: 1 },
  { key: 'resp.gsr_uS', label: 'Galvanik deri tepkisi (GSR)', unit: 'µS', group: 2, badWhen: 'high', cadence: 'live', decimals: 1 },
  // Veri grubu 3 · Biyokimyasal
  { key: 'biochem.vocOxStressIndex', label: 'Nefes VOC oksidatif stres', unit: '/100', group: 3, badWhen: 'high', cadence: 'daily', decimals: 0 },
  { key: 'biochem.sweatCortisol_ng_mL', label: 'Ter kortizolü', unit: 'ng/mL', group: 3, badWhen: 'high', cadence: 'live', decimals: 0 },
  { key: 'biochem.sweatLactate_mM', label: 'Ter laktatı', unit: 'mM', group: 3, badWhen: 'high', cadence: 'live', decimals: 1 },
  { key: 'biochem.sweatSodium_mM', label: 'Ter sodyumu', unit: 'mM', group: 3, badWhen: 'both', cadence: 'live', decimals: 0 },
  // Veri grubu 4 · Psikolojik ve bilişsel
  { key: 'cog.pvtMeanRt_ms', label: 'PVT tepki süresi', unit: 'ms', group: 4, badWhen: 'high', cadence: 'daily', decimals: 0 },
  { key: 'cog.pvtLapses', label: 'PVT dikkat kaybı', unit: 'adet', group: 4, badWhen: 'high', cadence: 'daily', decimals: 0 },
  { key: 'cog.bsi18_gsi', label: 'BSI-18 genel şiddet', unit: '/72', group: 4, badWhen: 'high', cadence: 'daily', decimals: 0 },
  { key: 'cog.panasPositive', label: 'PANAS olumlu duygu', unit: '/50', group: 4, badWhen: 'low', cadence: 'daily', decimals: 0 },
  { key: 'cog.panasNegative', label: 'PANAS olumsuz duygu', unit: '/50', group: 4, badWhen: 'high', cadence: 'daily', decimals: 0 },
  { key: 'cog.speechStrainIndex', label: 'Konuşma zorlanma indeksi', unit: '/100', group: 4, badWhen: 'high', cadence: 'daily', decimals: 0 },
  { key: 'cog.pupilDiameter_mm', label: 'Göz bebeği çapı', unit: 'mm', group: 4, badWhen: 'both', cadence: 'daily', decimals: 1 },
  { key: 'cog.pupilLatency_ms', label: 'Göz bebeği tepki gecikmesi', unit: 'ms', group: 4, badWhen: 'high', cadence: 'daily', decimals: 0 },
  // Veri grubu 5 · Çevre
  { key: 'env.doseRate_uSv_h', label: 'Radyasyon doz hızı', unit: 'µSv/sa', group: 5, badWhen: 'high', cadence: 'live', decimals: 1 },
  { key: 'env.doseCumulative_mSv', label: 'Toplam radyasyon dozu', unit: 'mSv', group: 5, badWhen: 'high', cadence: 'live', decimals: 0 },
  { key: 'env.ppCO2_mmHg', label: 'CO₂ kısmi basıncı', unit: 'mmHg', group: 5, badWhen: 'high', cadence: 'live', decimals: 1 },
  { key: 'env.o2_pct', label: 'Oksijen oranı', unit: '%', group: 5, badWhen: 'low', cadence: 'live', decimals: 1 },
  { key: 'env.pressure_kPa', label: 'Basınç', unit: 'kPa', group: 5, badWhen: 'low', cadence: 'live', decimals: 1 },
  { key: 'env.sleepLastNight_h', label: 'Dün gece uyku', unit: 'sa', group: 5, badWhen: 'low', cadence: 'daily', decimals: 1 },
  { key: 'env.remPct', label: 'REM uykusu', unit: '%', group: 5, badWhen: 'low', cadence: 'daily', decimals: 0 },
  { key: 'env.swsPct', label: 'Derin uyku', unit: '%', group: 5, badWhen: 'low', cadence: 'daily', decimals: 0 },
  { key: 'env.circadianShift_h', label: 'Sirkadiyen kayma', unit: 'sa', group: 5, badWhen: 'high', cadence: 'daily', decimals: 1 },
];

export const GROUP_NAMES: Record<MetricInfo['group'], string> = {
  1: 'Kalp-damar',
  2: 'Solunum ve metabolik',
  3: 'Biyokimyasal',
  4: 'Psikolojik ve bilişsel',
  5: 'Çevre',
};

export const METRIC_BY_KEY = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<MetricKey, MetricInfo>;

/** Telemetry içinden 'cardio.hr_bpm' gibi bir anahtarın değerini okur. */
export function readMetric(t: Telemetry, key: MetricKey): number {
  const [group, field] = key.split('.') as [keyof Telemetry, string];
  return (t[group] as unknown as Record<string, number>)[field];
}
