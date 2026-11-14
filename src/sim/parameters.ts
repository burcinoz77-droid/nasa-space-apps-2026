// Simülasyondaki her sabit burada, yanında kaynağıyla. (Sahibi: Parça 1)
// Arayüz bu kaynak linklerini "kaynak rozeti" olarak gösterir (SourceBadge).
// "Varsayım" etiketli sayıların NASA ya da hakemli bir kaynağı yoktur; jüriye öyle söylenir.
// Sayılar plandaki "Veri ve kaynaklar" tablosundan gelir; tabloda olmayan sayı uydurulmaz.

import type { CrewId, CrewLocation } from '../types';
import type { MetricKey } from '../metrics';

export interface Param {
  label: string; // ekranda görünen Türkçe ad
  value: number;
  unit: string;
  source: string; // kısa ad
  url?: string;
  assumption?: boolean;
}

// ---------- Kaynak bağlantıları (bir kez yazılır, PARAMS içinde tekrar kullanılır) ----------
const SRC = {
  norsk2015: { source: 'Norsk vd. 2015, J Physiol', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4324706/' },
  nunan2010: { source: 'Nunan vd. 2010, kısa süreli HRV normları', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5624990/table/T6' },
  hrpCardio: { source: 'NASA HRP kalp-damar riski', url: 'https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/' },
  hrpHypoxia: { source: 'NASA HRP hipoksi riski', url: 'https://www.nasa.gov/reference/risk-of-hypoxia/' },
  jems: { source: 'JEMS kapnografi rehberi', url: 'https://www.jems.com/patient-care/how-to-read-and-interpret-end-tidal-capnography-waveforms/' },
  stahn2017: { source: 'Stahn vd. 2017, Sci Rep', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5701078' },
  iac18: { source: 'IAC-18 E-nose (uzayda nefes VOC)', url: 'https://iafastro.directory/iac/archive/browse/IAC-18/A1/3/46598/' },
  sweat: { source: 'Ter biyobelirteçleri tablosu', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8985157/table/tab2' },
  jones2022: { source: 'Jones vd. 2022 (NASA Reaction Self Test)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8919197' },
  basner2011: { source: 'Basner vd. 2011, PVT-B', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3197786' },
  franke2017: { source: 'Franke vd. 2017, BSI-18 normları', url: 'https://bmcmedresmethodol.biomedcentral.com/articles/10.1186/s12874-016-0283-3' },
  watson1988: { source: 'Watson vd. 1988, PANAS', url: 'https://ogg.osu.edu/media/documents/MB%20Stream/PANAS.pdf' },
  hrpSans: { source: 'NASA HRP SANS riski', url: 'https://www.nasa.gov/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans' },
  swri: { source: 'Curiosity RAD, Zeitlin vd. 2013 (SwRI)', url: 'https://www.swri.org/newsroom/press-releases/swri-led-team-calculates-the-radiation-exposure-associated-trip-mars' },
  spaceCom: { source: 'Curiosity RAD, Hassler vd. 2013 (Space.com)', url: 'https://www.space.com/23875-mars-radiation-life-manned-mission.html' },
  ochmoRad: { source: 'NASA-STD-3001 (OCHMO radyasyon özeti)', url: 'https://www.nasa.gov/sites/default/files/atoms/files/radiation_protection_technical_brief_ochmo.pdf' },
  eda: { source: 'OSDR EDA (ISS çevre verisi)', url: 'https://visualization.osdr.nasa.gov/eda/' },
  ochmoCO2: { source: 'OCHMO-TB-004 CO₂', url: 'https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/' },
  ntrsSuit: { source: 'EVA giysisi regülatörü (NASA NTRS)', url: 'https://ntrs.nasa.gov/api/citations/20230007781/downloads/Regulators_ICES2023_Final.pdf' },
  ntrsCabin: { source: 'Kabin atmosferi (NASA NTRS)', url: 'https://ntrs.nasa.gov/api/citations/20240004074/downloads/SHOP%20-%20Variable%20Pressure%20Suit_v2.pdf' },
  barger2014: { source: 'Barger vd. 2014, Lancet Neurology (ISS)', url: 'https://www.eurekalert.org/news-releases/595450' },
  hrpSleep: { source: 'NASA HRP uyku riski', url: 'https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/' },
  relay: { source: 'NASA Mars Relay Network', url: 'https://science.nasa.gov/?p=434038' },
  donki: { source: 'NASA DONKI, Mayıs 2024 SEP', url: 'https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP?startDate=2024-05-01&endDate=2024-05-31' },
  assumption: { source: 'Varsayım', assumption: true },
} as const;

// ---------- PARAMS: ekranda kaynak rozetiyle gösterilebilecek her sayı ----------
// Mevcut anahtarlar (doseRateMarsTransit, careerDoseLimit ...) korunur; Parça 3 bunlara bağlanabilir.
export const PARAMS = {
  // Veri grubu 1 · Kalp-damar
  heartRateRest: { label: 'Nabız, dinlenme', value: 68, unit: 'bpm (dinlenme 60–75)', ...SRC.norsk2015 },
  heartRateEva: { label: 'Nabız, EVA', value: 92, unit: 'bpm (EVA 90–150)', ...SRC.norsk2015 },
  hrvRmssdMean: { label: 'Kalp hızı değişkenliği (HRV)', value: 42, unit: 'ms (SD 15, aralık 19–75)', ...SRC.nunan2010 },
  ecgEctopicNormal: { label: 'EKG düzensiz atım, normal üst sınır', value: 1, unit: 'düzensiz atım/dk üst sınır', ...SRC.assumption },
  ecgIrregularThreshold: { label: 'EKG "düzensiz ritim" eşiği', value: 6, unit: 'düzensiz atım/dk → ritim "irregular"', ...SRC.assumption },
  bpSysRest: { label: 'Sistolik tansiyon', value: 112, unit: 'mmHg', ...SRC.norsk2015 },
  bpDiaRest: { label: 'Diyastolik tansiyon', value: 70, unit: 'mmHg', ...SRC.norsk2015 },
  bpDropInSpace: { label: 'Uzayda tansiyon düşüşü', value: 8, unit: 'mmHg (24 saatlik, sistolik)', ...SRC.norsk2015 },
  spo2Normal: { label: 'Oksijen doygunluğu (SpO₂)', value: 98, unit: '% (aralık 96–99)', ...SRC.hrpHypoxia },
  // Veri grubu 2 · Solunum ve metabolik
  respRateRest: { label: 'Solunum sayısı, dinlenme', value: 14, unit: 'nefes/dk (12–20)', ...SRC.jems },
  respRateEva: { label: 'Solunum sayısı, EVA', value: 22, unit: 'nefes/dk (EVA 20–32)', ...SRC.jems },
  minuteVentRest: { label: 'Dakika ventilasyonu, dinlenme', value: 6.5, unit: 'L/dk (5–8)', ...SRC.assumption },
  minuteVentEva: { label: 'Dakika ventilasyonu, EVA', value: 22, unit: 'L/dk (EVA 20+)', ...SRC.assumption },
  etco2Normal: { label: 'Soluk sonu CO₂ (EtCO₂)', value: 38, unit: 'mmHg (35–45)', ...SRC.jems },
  coreTempRiseInSpace: { label: 'Uzayda çekirdek sıcaklık artışı', value: 1.0, unit: '°C', ...SRC.stahn2017 },
  coreTempRest: { label: 'Çekirdek sıcaklık, dinlenme', value: 37.4, unit: '°C (uzayda 37,3–37,8)', ...SRC.stahn2017 },
  skinTempRest: { label: 'Deri sıcaklığı', value: 33.7, unit: '°C (33–34,5)', ...SRC.assumption },
  gsrBaseline: { label: 'Galvanik deri tepkisi (GSR)', value: 4, unit: 'µS (2–6)', ...SRC.assumption },
  // Veri grubu 3 · Biyokimyasal
  vocIndexBaseline: { label: 'Nefes VOC oksidatif stres indeksi', value: 20, unit: '/100', ...SRC.iac18, assumption: true },
  sweatCortisolNormal: { label: 'Ter kortizolü', value: 40, unit: 'ng/mL (8–140)', ...SRC.sweat },
  sweatLactateRest: { label: 'Ter laktatı, dinlenme', value: 10, unit: 'mM (5–20)', ...SRC.sweat },
  sweatSodiumNormal: { label: 'Ter sodyumu', value: 45, unit: 'mM (10–100)', ...SRC.sweat },
  // Veri grubu 4 · Psikolojik ve bilişsel
  pvtMeanRtRested: { label: 'PVT tepki süresi, dinlenmiş', value: 250, unit: 'ms', ...SRC.jones2022 },
  pvtLapseThreshold: { label: 'PVT dikkat kaybı eşiği', value: 355, unit: 'ms', ...SRC.basner2011 },
  bsi18PopulationMean: { label: 'BSI-18 genel nüfus ortalaması', value: 4.7, unit: '/72', ...SRC.franke2017 },
  panasPositiveMean: { label: 'PANAS olumlu ortalama', value: 33.3, unit: '/50', ...SRC.watson1988 },
  panasNegativeMean: { label: 'PANAS olumsuz ortalama', value: 17.4, unit: '/50', ...SRC.watson1988 },
  speechStrainBaseline: { label: 'Konuşma zorlanma indeksi', value: 25, unit: '/100', ...SRC.assumption },
  pupilDiameterRest: { label: 'Göz bebeği çapı', value: 4.5, unit: 'mm', ...SRC.hrpSans, assumption: true },
  pupilLatencyRest: { label: 'Göz bebeği tepki gecikmesi', value: 230, unit: 'ms', ...SRC.hrpSans, assumption: true },
  // Veri grubu 5 · Çevre
  doseRateMarsTransit: { label: 'Doz hızı, Mars yolu (Kokpit)', value: 1.84, unit: 'mSv/gün', ...SRC.swri },
  doseRateMarsSurface: { label: 'Doz hızı, Mars yüzeyi', value: 0.64, unit: 'mSv/gün', ...SRC.spaceCom },
  careerDoseLimit: { label: 'Kariyer radyasyon limiti', value: 600, unit: 'mSv', ...SRC.ochmoRad },
  cabinCO2Median: { label: 'Kabin CO₂, ISS medyanı', value: 1.9, unit: 'mmHg (ISS RR-19 medyan 2.516 ppm)', ...SRC.eda },
  cabinCO2FailurePeak: { label: 'Kabin CO₂, ölçülen en yüksek', value: 5.3, unit: 'mmHg (EDA en yüksek 6.977 ppm)', ...SRC.eda },
  co2CautionLimit: { label: 'CO₂ dikkat eşiği', value: 2.3, unit: 'mmHg', ...SRC.ochmoCO2 },
  co2CriticalLimit: { label: 'CO₂ kritik eşiği', value: 3.0, unit: 'mmHg', ...SRC.ochmoCO2 },
  cabinPressure: { label: 'Kabin basıncı ve O₂', value: 101.3, unit: 'kPa, %21 O₂', ...SRC.ntrsCabin },
  suitPressure: { label: 'EVA giysisi basıncı ve O₂', value: 29.6, unit: 'kPa, %100 O₂ (4,3 psia)', ...SRC.ntrsSuit },
  sleepInSpaceMean: { label: 'Uzayda ortalama uyku', value: 6.09, unit: 'sa', ...SRC.barger2014 },
  remPctNormal: { label: 'REM uykusu oranı', value: 22, unit: '%', ...SRC.hrpSleep, assumption: true },
  swsPctNormal: { label: 'Derin uyku oranı', value: 18, unit: '%', ...SRC.hrpSleep, assumption: true },
  // İletişim
  commDelayMin: { label: 'Dünya gecikmesi, en kısa', value: 180, unit: 's (tek yön)', ...SRC.relay },
  commDelayMax: { label: 'Dünya gecikmesi, en uzun', value: 1344, unit: 's (tek yön)', ...SRC.relay },
  commDelayDemo: { label: 'Dünya gecikmesi, demo', value: 750, unit: 's (tek yön, 12,5 dk)', ...SRC.relay },
  // Senaryo çarpanları (DONKI zamanı verir, doz değerini vermez)
  stormDoseMultiplierOnset: { label: 'Fırtına doz çarpanı, başlangıç', value: 25, unit: '× doz hızı (Kokpit)', ...SRC.assumption },
  stormDoseMultiplierPeak: { label: 'Fırtına doz çarpanı, zirve', value: 60, unit: '× doz hızı (Kokpit)', ...SRC.assumption },
  stormDoseMultiplierSurface: { label: 'Fırtına doz çarpanı, yüzey', value: 5, unit: '× doz hızı (Mars atmosferi kalkan)', ...SRC.assumption },
  shelterDoseFactor: { label: 'Sığınakta doz çarpanı', value: 0.3, unit: '× doz hızı (sığınakta)', ...SRC.assumption },
} satisfies Record<string, Param>;

export type ParamKey = keyof typeof PARAMS;

/** Bir ölçümün kaynak rozeti için: hangi parametreye dayanıyor? (Parça 3'ün SourceBadge'i bunu kullanabilir) */
export function sourceForMetric(key: MetricKey): Param & { key: ParamKey } {
  const k = NORMALS[key].param;
  return { key: k, ...PARAMS[k] };
}

// ---------- Simülasyon ayarları ----------
export const SIM = {
  missionDay: 180, // ARES-1, 180. gün
  daysOnSurface: 10, // Gezegen ekibi kaç gündür yüzeyde (varsayım; toplam dozu hesaplamak için)
  missionMinutesPerTick: 10, // hızlandırma: 1 ölçüm = 10 dk görev süresi (demo)
  approachRate: 0.25, // her ölçümde hedefe yaklaşma oranı: x += 0.25 × (hedef − x)
  noiseScale: 0.3, // gürültü = gaussian × sd × 0.3
  baselineWindow: 30, // Parça 2 baseline'ı ilk 30 ölçümde kurar; senaryoyu bundan önce başlatmayın
} as const;

// ---------- Ölçüm normalleri: kişisel baseline'ın çıkış noktası ----------
// rest = Kokpit'te dinlenme değeri, eva = Gezegen ekibinde EVA değeri.
// personSd = astronotlar arası fark (seed'li, kişi başına bir kez), sd = ölçümden ölçüme oynama.
export interface MetricNormal {
  rest: number;
  eva: number;
  personSd: number;
  sd: number;
  min: number;
  max: number;
  param: ParamKey; // kaynak rozeti için
  integer?: boolean; // tam sayı ölçümler (PVT dikkat kaybı, ölçek puanları)
}

export const NORMALS: Record<MetricKey, MetricNormal> = {
  'cardio.hr_bpm': { rest: 68, eva: 92, personSd: 4, sd: 6, min: 35, max: 200, param: 'heartRateRest' },
  'cardio.hrv_rmssd_ms': { rest: 42, eva: 36, personSd: 6, sd: 10, min: 10, max: 120, param: 'hrvRmssdMean' },
  'cardio.ecg_ectopic_per_min': { rest: 0.2, eva: 0.3, personSd: 0.1, sd: 0.3, min: 0, max: 30, param: 'ecgEctopicNormal' },
  'cardio.bp_sys_mmHg': { rest: 112, eva: 118, personSd: 5, sd: 6, min: 70, max: 200, param: 'bpSysRest' },
  'cardio.bp_dia_mmHg': { rest: 70, eva: 74, personSd: 3, sd: 4, min: 40, max: 130, param: 'bpDiaRest' },
  'cardio.spo2_pct': { rest: 98, eva: 97.5, personSd: 0.4, sd: 1, min: 70, max: 100, param: 'spo2Normal' },
  'resp.rr_bpm': { rest: 14, eva: 22, personSd: 1.2, sd: 2.5, min: 6, max: 45, param: 'respRateRest' },
  'resp.minuteVent_L_min': { rest: 6.5, eva: 22, personSd: 0.5, sd: 1.5, min: 3, max: 80, param: 'minuteVentRest' },
  'resp.etco2_mmHg': { rest: 38, eva: 40, personSd: 1.5, sd: 2.5, min: 20, max: 70, param: 'etco2Normal' },
  'resp.coreTemp_C': { rest: 37.4, eva: 37.8, personSd: 0.1, sd: 0.15, min: 35, max: 42, param: 'coreTempRest' },
  'resp.skinTemp_C': { rest: 33.7, eva: 34.2, personSd: 0.3, sd: 0.4, min: 28, max: 39, param: 'skinTempRest' },
  'resp.gsr_uS': { rest: 4, eva: 4.8, personSd: 0.6, sd: 0.8, min: 0.5, max: 30, param: 'gsrBaseline' },
  'biochem.vocOxStressIndex': { rest: 20, eva: 22, personSd: 3, sd: 4, min: 0, max: 100, param: 'vocIndexBaseline', integer: true },
  'biochem.sweatCortisol_ng_mL': { rest: 40, eva: 45, personSd: 6, sd: 6, min: 8, max: 140, param: 'sweatCortisolNormal' },
  'biochem.sweatLactate_mM': { rest: 10, eva: 14, personSd: 1.5, sd: 1.5, min: 5, max: 40, param: 'sweatLactateRest' },
  'biochem.sweatSodium_mM': { rest: 45, eva: 50, personSd: 6, sd: 6, min: 10, max: 100, param: 'sweatSodiumNormal' },
  'cog.pvtMeanRt_ms': { rest: 250, eva: 255, personSd: 12, sd: 20, min: 150, max: 600, param: 'pvtMeanRtRested', integer: true },
  'cog.pvtLapses': { rest: 1, eva: 1, personSd: 0.5, sd: 1, min: 0, max: 30, param: 'pvtLapseThreshold', integer: true },
  'cog.bsi18_gsi': { rest: 4.7, eva: 4.7, personSd: 1.5, sd: 2, min: 0, max: 72, param: 'bsi18PopulationMean', integer: true },
  'cog.panasPositive': { rest: 33.3, eva: 33.3, personSd: 2.5, sd: 3, min: 10, max: 50, param: 'panasPositiveMean', integer: true },
  'cog.panasNegative': { rest: 17.4, eva: 17.4, personSd: 2, sd: 3, min: 10, max: 50, param: 'panasNegativeMean', integer: true },
  'cog.speechStrainIndex': { rest: 25, eva: 27, personSd: 4, sd: 6, min: 0, max: 100, param: 'speechStrainBaseline', integer: true },
  'cog.pupilDiameter_mm': { rest: 4.5, eva: 4.5, personSd: 0.25, sd: 0.3, min: 2, max: 8, param: 'pupilDiameterRest' },
  'cog.pupilLatency_ms': { rest: 230, eva: 230, personSd: 10, sd: 15, min: 150, max: 400, param: 'pupilLatencyRest', integer: true },
  // Doz hızı: Kokpit 1,84 mSv/gün = 76,7 µSv/sa; yüzey 0,64 mSv/gün = 26,7 µSv/sa
  'env.doseRate_uSv_h': { rest: 76.7, eva: 26.7, personSd: 0, sd: 5, min: 0, max: 50000, param: 'doseRateMarsTransit' },
  // Toplam doz baseline'ı kullanılmaz; aşağıdaki initialCumulativeDose ile başlar ve doz hızıyla birikir
  'env.doseCumulative_mSv': { rest: 0, eva: 0, personSd: 0, sd: 0, min: 0, max: 5000, param: 'careerDoseLimit' },
  'env.ppCO2_mmHg': { rest: 1.9, eva: 2.0, personSd: 0, sd: 0.15, min: 0.5, max: 10, param: 'cabinCO2Median' },
  'env.o2_pct': { rest: 21, eva: 100, personSd: 0, sd: 0.1, min: 10, max: 100, param: 'cabinPressure' },
  'env.pressure_kPa': { rest: 101.3, eva: 29.6, personSd: 0, sd: 0.2, min: 0, max: 110, param: 'suitPressure' },
  'env.sleepLastNight_h': { rest: 6.09, eva: 6.09, personSd: 0.35, sd: 0.4, min: 2, max: 10, param: 'sleepInSpaceMean' },
  'env.remPct': { rest: 22, eva: 22, personSd: 1.5, sd: 2, min: 5, max: 35, param: 'remPctNormal' },
  'env.swsPct': { rest: 18, eva: 18, personSd: 1.5, sd: 2, min: 5, max: 30, param: 'swsPctNormal' },
  'env.circadianShift_h': { rest: 0.5, eva: 0.5, personSd: 0.15, sd: 0.2, min: 0, max: 6, param: 'sleepInSpaceMean' },
};

/** 180. gündeki toplam doz: Kokpit 180 × 1,84; Gezegen (180 − 10) × 1,84 + 10 × 0,64 (yüzeyde 10 gün varsayım). */
export function initialCumulativeDose(location: CrewLocation): number {
  const transit = PARAMS.doseRateMarsTransit.value;
  const surface = PARAMS.doseRateMarsSurface.value;
  if (location === 'KOKPIT') return SIM.missionDay * transit;
  return (SIM.missionDay - SIM.daysOnSurface) * transit + SIM.daysOnSurface * surface;
}

// ---------- Kişisel hassasiyetler (crew.ts'teki "sensitivity" notlarının sayısal karşılığı) ----------
// Hepsi varsayım: senaryo etkisinin kişiye göre büyüklüğü. 1 = ekip ortalaması.
export interface CrewTraits {
  co2Response: number; // CO₂ arızasında solunum/nabız/PVT etkisinin çarpanı
  radiationResponse: number; // radyasyon olayında stres (kortizol, GSR, nabız) etkisinin çarpanı
  cardioResponse: number; // nabız etkilerinin çarpanı
  metabolicResponse: number; // laktat, çekirdek sıcaklık, ter etkilerinin çarpanı
  fatigueResponse: number; // Mars 180. gün yükü: 1 = tablodaki tam etki, 0,5 = yarı şiddet
  offsets: Partial<Record<MetricKey, number>>; // kişisel baseline kayması
}

// Plan: Mars 180. gün yükünü Elif tam şiddette, diğerleri yarı şiddette yaşar
const NEUTRAL: CrewTraits = { co2Response: 1, radiationResponse: 1, cardioResponse: 1, metabolicResponse: 1, fatigueResponse: 0.5, offsets: {} };

export const CREW_TRAITS: Record<CrewId, CrewTraits> = {
  // Elif: radyasyona hassas; Mars 180. gün yükünü güçlü yaşar
  elif: { ...NEUTRAL, radiationResponse: 1.6, fatigueResponse: 1 },
  // Kerem: CO₂'ye iki kat tepki
  kerem: { ...NEUTRAL, co2Response: 2 },
  // Zeynep: nabzı düşük ve dayanıklı (pilot)
  zeynep: { ...NEUTRAL, cardioResponse: 0.6, offsets: { 'cardio.hr_bpm': -10, 'cardio.hrv_rmssd_ms': 8 } },
  emir: { ...NEUTRAL },
  deniz: { ...NEUTRAL },
  // Mert: metabolizması hızlı
  mert: { ...NEUTRAL, metabolicResponse: 1.4, offsets: { 'cardio.hr_bpm': 4, 'biochem.sweatLactate_mM': 2, 'resp.coreTemp_C': 0.1 } },
};
