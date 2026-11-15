// Parça 2 · Katman 1 ayarları. Eşikler, sd tabanları ve kurallardaki sabitler burada.
// Kaynağı olan her eşiğin linki yanında yazar; "varsayım" yazanlar ayar değeridir ve jüriye öyle söylenir.
// Sayılar plandaki "2 · Katman 1 Anomali" ve "Veri ve kaynaklar" sekmelerinden gelir.
import type { MetricKey } from '../metrics';
import type { Domain, Level } from '../types';

/** Kişisel baseline: her astronot × her ölçüm için ilk 30 ölçüm (≈ 36 sn), sonra dondurulur. */
export const BASELINE_WINDOW = 30;

/**
 * Demo güvenliği: senaryo 30 ölçüm dolmadan başlatılırsa baseline anomaliyle kirlenmesin diye
 * o ana kadarki ölçümlerle erken dondurulur; ama en az bu kadar ölçüm toplanmış olmalı.
 */
export const BASELINE_MIN_WINDOW = 10;

/** Seviye ancak bu kadar ardışık ölçüm aynı yönde kalırsa değişir (tek sıçrama alarm vermez). */
export const STREAK_REQUIRED = 3;

/** Olayın tüm sinyalleri bu kadar ölçüm boyunca normalse olay "çözüldü" olur. */
export const RESOLVE_AFTER = 10;

/** Yönlü z-skoru eşikleri: riskZ ≥ 2 dikkat, ≥ 3 kritik. */
export const Z_CAUTION = 2;
export const Z_CRITICAL = 3;

/** Alan skoru = 100 − 12 × Σ max(0, riskZ − 1), 0–100 arasına kırpılır. */
export const SCORE_WEIGHT = 12;

/** Z-skoruna hiç girmeyen ölçümler (sadece mutlak eşikle izlenir). */
export const Z_EXCLUDED = new Set<MetricKey>(['env.doseCumulative_mSv']);

// ---------------------------------------------------------------------------
// Sd tabanları: sd = max(baseline sd, taban). Günlük ölçümler (uyku, PVT, BSI-18 ...)
// normalde sabit olduğundan sd = 0 çıkar ve z sonsuza gider; taban bunu önler.
// Hepsi ayar değeridir (varsayım). Tabloda olmayan ölçüm için taban = ortalamanın %3'ü.
// ---------------------------------------------------------------------------
export const SD_FLOOR: Partial<Record<MetricKey, number>> = {
  'cardio.hr_bpm': 3,
  'cardio.hrv_rmssd_ms': 5,
  'cardio.bp_sys_mmHg': 4,
  'cardio.bp_dia_mmHg': 4,
  'cardio.spo2_pct': 0.8,
  'resp.rr_bpm': 1.5,
  'resp.etco2_mmHg': 1.5,
  'resp.coreTemp_C': 0.15,
  'resp.gsr_uS': 0.8,
  'biochem.sweatCortisol_ng_mL': 6,
  'biochem.sweatLactate_mM': 1.5,
  'biochem.sweatSodium_mM': 6,
  'cog.pvtMeanRt_ms': 20,
  'cog.pvtLapses': 1,
  'cog.bsi18_gsi': 2,
  'cog.panasPositive': 3,
  'cog.panasNegative': 3,
  'cog.speechStrainIndex': 6,
  'cog.pupilDiameter_mm': 0.3,
  'cog.pupilLatency_ms': 15,
  'env.doseRate_uSv_h': 5,
  'env.ppCO2_mmHg': 0.15,
  'env.sleepLastNight_h': 0.4,
  'env.remPct': 2,
  'env.swsPct': 2,
  // Tabloya Parça 2'nin eklediği tabanlar (varsayım). Ortalaması sıfıra yakın ya da çok küçük
  // olan ölçümlerde "%3" anlamsız kalıyor ve gürültü yanlış alarm üretiyordu:
  'cardio.ecg_ectopic_per_min': 0.5, // ortalama ~0,2/dk; %3'ü 0,006 olurdu
  'resp.minuteVent_L_min': 1, // dinlenmede ~6,5 L/dk; %3'ü 0,2 L/dk, sensör gürültüsünün altında
  'env.circadianShift_h': 0.5, // ortalama ~0,5 sa; %3'ü 0,015 sa → 1 saatlik kayma z = 66 olurdu
};
export const SD_FLOOR_DEFAULT_PCT = 0.03;

// ---------------------------------------------------------------------------
// Mutlak eşikler. NASA'nın ya da klinik bir kesin sınırın olduğu ölçümlerde seviye
// z-skorundan önce gelir: bu ölçümlerin seviyesi SADECE bu eşiklerle belirlenir.
// Z-skoru yine hesaplanır ve sağlık skoruna girer.
// ---------------------------------------------------------------------------
export interface AbsoluteLimit {
  dir: 'above' | 'below'; // eşiğin hangi tarafı riskli
  caution: number;
  critical: number;
  inclusive: boolean; // true: ≥ / ≤ ; false: > / <
  source: string;
  url?: string;
  assumption?: boolean;
}

export const ABSOLUTE_LIMITS: Partial<Record<MetricKey, AbsoluteLimit>> = {
  // ppCO₂ > 2,3 mmHg dikkat, > 3,0 mmHg kritik
  'env.ppCO2_mmHg': {
    dir: 'above',
    caution: 2.3,
    critical: 3.0,
    inclusive: false,
    source: 'OCHMO-TB-004 CO₂; NASA-STD-3001 Vol. 2, 6004',
    url: 'https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/',
  },
  // SpO₂ < 94 % dikkat, < 90 % kritik — NASA'da evrensel sayı yok; klinik eşik, varsayım etiketi
  'cardio.spo2_pct': {
    dir: 'below',
    caution: 94,
    critical: 90,
    inclusive: false,
    source: 'Clinical threshold (assumption); risk context: NASA HRP hypoxia risk',
    url: 'https://www.nasa.gov/reference/risk-of-hypoxia/',
    assumption: true,
  },
  // Çekirdek sıcaklık ≥ 38,5 °C dikkat, ≥ 39,0 °C kritik — Stahn 2017: uzayda egzersizde 40 °C'yi aşabiliyor; eşik varsayım
  'resp.coreTemp_C': {
    dir: 'above',
    caution: 38.5,
    critical: 39.0,
    inclusive: true,
    source: 'Stahn et al. 2017, Sci Rep (threshold assumed)',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5701078',
    assumption: true,
  },
  // Toplam doz ≥ 480 mSv (kariyer limitinin %80'i) dikkat, ≥ 600 mSv kritik
  'env.doseCumulative_mSv': {
    dir: 'above',
    caution: 480,
    critical: 600,
    inclusive: true,
    source: 'NASA-STD-3001 career limit 600 mSv (OCHMO radiation brief)',
    url: 'https://www.nasa.gov/sites/default/files/atoms/files/radiation_protection_technical_brief_ochmo.pdf',
  },
};

// ---------------------------------------------------------------------------
// Olay kurallarının sabitleri (rules.ts kullanır)
// ---------------------------------------------------------------------------

/** FATIGUE: bu 5 sinyalden en az 3'ü aynı anda dikkatte (kapsam belgesi örneği; Jones 2022). */
export const FATIGUE_SIGNALS: MetricKey[] = [
  'env.sleepLastNight_h',
  'cog.pvtMeanRt_ms',
  'cog.panasPositive',
  'cog.bsi18_gsi',
  'cardio.hrv_rmssd_ms',
];
export const FATIGUE_MIN_SIGNALS = 3;

/** STRESS: üçü birden riskZ ≥ 2 (dikkat) olmalı. */
export const STRESS_SIGNALS: MetricKey[] = ['resp.gsr_uS', 'biochem.sweatCortisol_ng_mL', 'cog.panasNegative'];

/** CARDIO: EKG ritmi "irregular" ya da düzensiz atım riskZ ≥ 3 (3 ölçüm). */
export const CARDIO_ECTOPIC_KEY: MetricKey = 'cardio.ecg_ectopic_per_min';

/**
 * MULTI: aynı kişide en az 2 alan kritik. Çevre alanı (grup 5) sayılmaz: doz hızı ve CO₂
 * zaten kendi olaylarını (RADIATION, CO2) açıyor; çevre kritikken herkes MULTI almasın diye
 * sadece vücut alanları sayılır. (Ayar kararı, Parça 2.)
 */
export const MULTI_DOMAINS: Domain[] = ['cardio', 'resp', 'biochem', 'cog'];
export const MULTI_MIN_CRITICAL_DOMAINS = 2;

export const LEVEL_RANK: Record<Level, number> = { normal: 0, caution: 1, critical: 2 };
