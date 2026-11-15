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
  normalRange?: [number, number]; // resmi kaynağın normal aralığı: değer bu aralıktaysa Katman 1 uyarı vermez
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
  watson1988: { source: 'Watson vd. 1988, PANAS', url: 'https://doi.org/10.1037/0022-3514.54.6.1063' },
  hrpSans: { source: 'NASA HRP SANS riski', url: 'https://www.nasa.gov/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans' },
  swri: { source: 'Curiosity RAD, Zeitlin vd. 2013 (SwRI)', url: 'https://www.swri.org/newsroom/press-releases/swri-led-team-calculates-the-radiation-exposure-associated-trip-mars' },
  ochmoRad: { source: 'NASA-STD-3001 (OCHMO radyasyon özeti)', url: 'https://www.nasa.gov/sites/default/files/atoms/files/radiation_protection_technical_brief_ochmo.pdf' },
  eda: { source: 'OSDR EDA (ISS çevre verisi)', url: 'https://visualization.osdr.nasa.gov/eda/' },
  ochmoCO2: { source: 'OCHMO-TB-004 CO₂', url: 'https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/' },
  ntrsSuit: { source: 'EVA giysisi regülatörü (NASA NTRS)', url: 'https://ntrs.nasa.gov/api/citations/20230007781/downloads/Regulators_ICES2023_Final.pdf' },
  ntrsCabin: { source: 'Kabin atmosferi 14,7 psia, %21 O₂ (NASA NTRS, ICES-2024)', url: 'https://ntrs.nasa.gov/api/citations/20240005117/downloads/ICES-2024-128-Final%20Manuscript-No%20Tracked%20Changes.pdf' },
  barger2014: { source: 'Barger vd. 2014, The Lancet Neurology (ISS, 21 astronot)', url: 'https://doi.org/10.1016/S1474-4422(14)70122-X' },
  hrpSleep: { source: 'NASA HRP uyku riski', url: 'https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/' },
  relay: { source: 'NASA NTRS, ASCEND 2022: Mars görevlerinde iletişim gecikmesi', url: 'https://ntrs.nasa.gov/api/citations/20220013418/downloads/ASCEND-Communication%20Delays%2C%20Disruptions%2C%20and%20Blackouts%20for%20Crewed%20Mars%20Missions.pdf' },
  donki: { source: 'NASA DONKI, Mayıs 2024 SEP', url: 'https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP?startDate=2024-05-01&endDate=2024-05-31' },
  ochmoEclss: { source: 'OCHMO-TB-002 ECLSS (NASA-STD-3001 V2 6012, 6013)', url: 'https://www.nasa.gov/wp-content/uploads/2023/07/eclss-technical-brief-ochmo.pdf' },
  ochmoAcoustics: { source: 'OCHMO-TB-035 Akustik (NASA-STD-3001 V2 6078)', url: 'https://www.nasa.gov/sites/default/files/atoms/files/acoustics_technical_brief_ochmo_0.pdf' },
  issNoise: { source: 'ISS gürültü sınırları (Int J Audiol 2020, NASA tıbbi operasyon gereksinimleri)', url: 'https://informahealthcare.com/doi/abs/10.1080/14992027.2019.1698067' },
  nihSpo2: { source: 'NIH StatPearls, Pulse Oximetry (ABD Ulusal Tıp Kütüphanesi)', url: 'https://www.ncbi.nlm.nih.gov/books/NBK470348/' },
  piltch2025: { source: 'Piltch vd. 2025, J Sleep Research (Harvard, NASA Ames; Mir astronotları)', url: 'https://onlinelibrary.wiley.com/doi/10.1111/jsr.14345' },
  ntrsApolloEva: { source: 'NASA NTRS, Apollo EVA metabolik ölçümleri', url: 'https://ntrs.nasa.gov/api/citations/19910001262/downloads/19910001262.pdf' },
  pvcHolter: { source: 'Frontiers in Space Technologies 2016, uzayda kalp ritmi (hakemli derleme)', url: 'https://www.frontiersin.org/articles/10.3389/fspas.2016.00027/pdf' },
  tvst2021: { source: 'TVST 2021, sağlıklı kontrol grubu göz bebeği refleksi (Dünya, n=25)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8083111/table/tbl1' },
  guo2015: { source: 'Guo vd. 2015, A&A: Curiosity RAD Mars yolculuğu doz ölçümü', url: 'https://www.aanda.org/10.1051/0004-6361/201525680' },
  artemis1: { source: 'George vd. 2024, Nature: Artemis I Orion radyasyon ölçümü (NASA JSC)', url: 'https://www.osti.gov/pages/servlets/purl/2447574' },
  hassler2014: { source: 'Hassler vd. 2014, Science: Curiosity RAD Mars yüzeyi (NASA NTRS kaydı)', url: 'https://ntrs.nasa.gov/citations/20180007641' },
  nasaMay2024: { source: 'NASA, Mayıs 2024 Mars güneş fırtınası (Curiosity RAD)', url: 'https://www.nasa.gov/?p=670127' },
  assumption: { source: 'Varsayım', assumption: true },
} as const;

// ---------- PARAMS: ekranda kaynak rozetiyle gösterilebilecek her sayı ----------
// Mevcut anahtarlar (doseRateMarsTransit, careerDoseLimit ...) korunur; Parça 3 bunlara bağlanabilir.
export const PARAMS = {
  // Veri grubu 1 · Kalp-damar
  heartRateRest: { label: 'Nabız, dinlenme', value: 68, unit: 'bpm (dinlenme 60–75)', ...SRC.norsk2015 },
  heartRateEva: { label: 'Nabız, EVA', value: 105, unit: 'bpm (Apollo EVA: normal işte 100–110, zorlu işte 150–160)', ...SRC.ntrsApolloEva, normalRange: [100, 110] },
  hrvRmssdMean: { label: 'Kalp hızı değişkenliği (HRV)', value: 42, unit: 'ms (SD 15, aralık 19–75)', ...SRC.nunan2010 },
  ecgEctopicNormal: { label: 'EKG düzensiz atım, normal üst sınır', value: 1, unit: 'düzensiz atım/dk üst sınır', ...SRC.assumption },
  ecgIrregularThreshold: { label: 'EKG "düzensiz ritim" eşiği', value: 6, unit: 'düzensiz atım/dk → ritim "irregular" (24 sa Holter\'de >5/dk klinik olarak önemli)', ...SRC.pvcHolter },
  bpSysRest: { label: 'Sistolik tansiyon', value: 112, unit: 'mmHg', ...SRC.norsk2015 },
  bpDiaRest: { label: 'Diyastolik tansiyon', value: 70, unit: 'mmHg', ...SRC.norsk2015 },
  bpDropInSpace: { label: 'Uzayda tansiyon düşüşü', value: 8, unit: 'mmHg (24 saatlik, sistolik)', ...SRC.norsk2015 },
  // NASA HRP hipoksi sayfası konuyu verir ama sayı vermez; normal aralık NIH'ten (deniz seviyesi; kabin basıncı da 101,3 kPa).
  spo2Normal: { label: 'Oksijen doygunluğu (SpO₂)', value: 98, unit: '% (normal %96–100, deniz seviyesi basıncında)', ...SRC.nihSpo2, normalRange: [96, 100] },
  // Veri grubu 2 · Solunum ve metabolik
  respRateRest: { label: 'Solunum sayısı, dinlenme', value: 14, unit: 'nefes/dk (normal 12–20)', ...SRC.jems, normalRange: [12, 20] },
  respRateEva: { label: 'Solunum sayısı, EVA', value: 22, unit: 'nefes/dk (EVA 20–32)', ...SRC.jems },
  minuteVentRest: { label: 'Dakika ventilasyonu, dinlenme', value: 6.5, unit: 'L/dk (5–8)', ...SRC.assumption },
  minuteVentEva: { label: 'Dakika ventilasyonu, EVA', value: 22, unit: 'L/dk (EVA 20+)', ...SRC.assumption },
  etco2Normal: { label: 'Soluk sonu CO₂ (EtCO₂)', value: 38, unit: 'mmHg (normal 35–45)', ...SRC.jems, normalRange: [35, 45] },
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
  pupilDiameterRest: { label: 'Göz bebeği çapı', value: 6.1, unit: 'mm (sağlıklı kişilerde 6,12 ± 0,69; SANS ölçümü değildir)', ...SRC.tvst2021 },
  pupilLatencyRest: { label: 'Göz bebeği tepki gecikmesi', value: 276, unit: 'ms (sağlıklı kişilerde ortanca 276, çeyrekler 249,5–289)', ...SRC.tvst2021 },
  // Veri grubu 5 · Çevre
  doseRateMarsTransit: { label: 'Doz hızı, Mars yolu (Kokpit)', value: 1.84, unit: 'mSv/gün', ...SRC.swri },
  doseRateMarsSurface: { label: 'Doz hızı, Mars yüzeyi', value: 0.64, unit: 'mSv/gün', ...SRC.hassler2014 },
  careerDoseLimit: { label: 'Kariyer radyasyon limiti', value: 600, unit: 'mSv', ...SRC.ochmoRad },
  cabinCO2Median: { label: 'Kabin CO₂, ISS medyanı', value: 1.9, unit: 'mmHg (ISS RR-19 medyan 2.516 ppm; 2,3 mmHg\'ye kadar uyarı yok)', ...SRC.eda, normalRange: [0, 2.3] },
  cabinCO2FailurePeak: { label: 'Kabin CO₂, ölçülen en yüksek', value: 5.3, unit: 'mmHg (EDA en yüksek 6.977 ppm)', ...SRC.eda },
  // 2,3 mmHg: NASA NTRS'e göre belirtiler bu seviyeden itibaren bildirilmiş (plan). OCHMO-TB-004 ayrıca baş ağrısı riskini
  // %1'in altında tutmak için 7 günlük ortalamanın 2,5 mmHg altında kalmasını ister; 3,0 mmHg 1 saatlik üst sınırdır.
  co2CautionLimit: { label: 'CO₂ dikkat eşiği', value: 2.3, unit: 'mmHg (belirtiler başlıyor; 7 gün ort. sınırı 2,5)', ...SRC.ochmoCO2 },
  co2CriticalLimit: { label: 'CO₂ kritik eşiği', value: 3.0, unit: 'mmHg (1 saatlik ortalama, NASA-STD-3001 V2 6004)', ...SRC.ochmoCO2 },
  cabinPressure: { label: 'Kabin basıncı ve O₂', value: 101.3, unit: 'kPa, %21 O₂', ...SRC.ntrsCabin },
  suitPressure: { label: 'EVA giysisi basıncı ve O₂', value: 29.6, unit: 'kPa, %100 O₂ (4,3 psia)', ...SRC.ntrsSuit },
  sleepInSpaceMean: { label: 'Uzayda ortalama uyku', value: 6.09, unit: 'sa', ...SRC.barger2014 },
  remPctNormal: { label: 'REM uykusu oranı', value: 19.6, unit: '% (uzayda; uçuş öncesi %26,4)', ...SRC.piltch2025 },
  swsPctNormal: { label: 'Derin uyku oranı', value: 18, unit: '%', ...SRC.hrpSleep, assumption: true },
  // Ortam: NASA-STD-3001 performans bölgesi 20–25 °C ve %30–60 nem; sağlık sınırı 18 °C/%75 – 27 °C/%25 (OCHMO-TB-002).
  // Normal değer aralığın ortasıdır. Gezegen ekibinde giysi içi de aynı kabul edildi (varsayım).
  ambientTempComfort: { label: 'Ortam sıcaklığı', value: 22.5, unit: '°C (NASA performans bölgesi 20–25 °C; sağlık sınırı 18–27 °C)', ...SRC.ochmoEclss, normalRange: [20, 25] },
  humidityComfort: { label: 'Ortam nemi', value: 45, unit: '% (NASA performans bölgesi %30–60; sağlık sınırı %25–75)', ...SRC.ochmoEclss, normalRange: [30, 60] },
  // Gürültü: çalışma alanında sürekli gürültü sınırı NC-50 eğrisi (yaklaşık 58 dBA). 55 dBA bu sınırın altında seçilmiş bir varsayımdır.
  noiseBaseline: { label: 'Ortam gürültüsü', value: 55, unit: 'dBA (sürekli gürültü sınırı NC-50, yaklaşık 58 dBA)', ...SRC.ochmoAcoustics, assumption: true },
  noiseWorkLimit: { label: 'Gürültü sınırı, çalışma', value: 72, unit: 'dBA (16 saat ortalaması; uyku için 8 saatte 62 dBA)', ...SRC.issNoise, normalRange: [0, 72] },
  noiseSleepLimit: { label: 'Gürültü sınırı, uyku', value: 62, unit: 'dBA (8 saat ortalaması)', ...SRC.issNoise },
  // İletişim
  commDelayMin: { label: 'Dünya gecikmesi, en kısa', value: 180, unit: 's (tek yön)', ...SRC.relay },
  commDelayMax: { label: 'Dünya gecikmesi, en uzun', value: 1344, unit: 's (tek yön)', ...SRC.relay },
  commDelayDemo: { label: 'Dünya gecikmesi, demo', value: 750, unit: 's (tek yön, 12,5 dk)', ...SRC.relay },
  // Senaryo çarpanları (DONKI zamanı verir, doz değerini vermez)
  stormDoseMultiplierOnset: { label: 'Fırtına doz çarpanı, başlangıç', value: 25, unit: '× doz hızı (Kokpit)', ...SRC.assumption },
  stormDoseMultiplierPeak: { label: 'Fırtına doz çarpanı, zirve', value: 30, unit: '× doz hızı (Kokpit; Curiosity yolculukta sakin ~332, fırtınada >10.000 µGy/gün)', ...SRC.guo2015 },
  stormDoseMultiplierSurface: { label: 'Fırtına doz çarpanı, yüzey', value: 5, unit: '× doz hızı (Mars atmosferi kalkan; NASA: Mayıs 2024 fırtınasında yüzeyde 8.100 µGy, oran belirsiz)', ...SRC.assumption },
  shelterDoseFactor: { label: 'Sığınakta doz çarpanı', value: 0.23, unit: '× doz hızı (Orion sığınağı: 1989 fırtınası simülasyonunda 414 → 95 µGy/dk)', ...SRC.artemis1 },
} satisfies Record<string, Param>;

export type ParamKey = keyof typeof PARAMS;

/** Bir ölçümün kaynak rozeti için: hangi parametreye dayanıyor? (Parça 3'ün SourceBadge'i bunu kullanabilir) */
// Gezegen ekibi uzay yürüyüşünde: bu ölçümlerin kaynağı EVA değeridir
const EVA_PARAMS: Partial<Record<MetricKey, ParamKey>> = {
  'cardio.hr_bpm': 'heartRateEva',
  'resp.rr_bpm': 'respRateEva',
  'resp.minuteVent_L_min': 'minuteVentEva',
};

export function sourceForMetric(key: MetricKey, location?: CrewLocation): Param & { key: ParamKey } {
  const k = (location === 'GEZEGEN' ? EVA_PARAMS[key] : undefined) ?? NORMALS[key].param;
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
  'cardio.hr_bpm': { rest: 68, eva: 105, personSd: 4, sd: 6, min: 35, max: 200, param: 'heartRateRest' },
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
  'cog.pupilDiameter_mm': { rest: 6.1, eva: 6.1, personSd: 0.25, sd: 0.3, min: 2, max: 8, param: 'pupilDiameterRest' },
  'cog.pupilLatency_ms': { rest: 276, eva: 276, personSd: 10, sd: 15, min: 150, max: 400, param: 'pupilLatencyRest', integer: true },
  // Doz hızı: Kokpit 1,84 mSv/gün = 76,7 µSv/sa; yüzey 0,64 mSv/gün = 26,7 µSv/sa
  'env.doseRate_uSv_h': { rest: 76.7, eva: 26.7, personSd: 0, sd: 5, min: 0, max: 50000, param: 'doseRateMarsTransit' },
  // Toplam doz baseline'ı kullanılmaz; aşağıdaki initialCumulativeDose ile başlar ve doz hızıyla birikir
  'env.doseCumulative_mSv': { rest: 0, eva: 0, personSd: 0, sd: 0, min: 0, max: 5000, param: 'careerDoseLimit' },
  'env.ppCO2_mmHg': { rest: 1.9, eva: 2.0, personSd: 0, sd: 0.15, min: 0.5, max: 10, param: 'cabinCO2Median' },
  'env.o2_pct': { rest: 21, eva: 100, personSd: 0, sd: 0.1, min: 10, max: 100, param: 'cabinPressure' },
  'env.pressure_kPa': { rest: 101.3, eva: 29.6, personSd: 0, sd: 0.2, min: 0, max: 110, param: 'suitPressure' },
  'env.sleepLastNight_h': { rest: 6.09, eva: 6.09, personSd: 0.35, sd: 0.4, min: 2, max: 10, param: 'sleepInSpaceMean' },
  'env.remPct': { rest: 19.6, eva: 19.6, personSd: 1.5, sd: 2, min: 5, max: 35, param: 'remPctNormal' },
  'env.swsPct': { rest: 18, eva: 18, personSd: 1.5, sd: 2, min: 5, max: 30, param: 'swsPctNormal' },
  'env.circadianShift_h': { rest: 0.5, eva: 0.5, personSd: 0.15, sd: 0.2, min: 0, max: 6, param: 'sleepInSpaceMean' },
  'env.ambientTemp_C': { rest: 22.5, eva: 22.5, personSd: 0, sd: 0.3, min: 5, max: 45, param: 'ambientTempComfort' },
  'env.humidity_pct': { rest: 45, eva: 45, personSd: 0, sd: 2, min: 0, max: 100, param: 'humidityComfort', integer: true },
  'env.noise_dBA': { rest: 55, eva: 55, personSd: 0, sd: 1.5, min: 20, max: 130, param: 'noiseBaseline', integer: true },
};

// ---------- Resmi normal aralıklar: ölçüm bu aralıktaysa Katman 1 uyarı vermez ----------
// Sadece kaynağında açık bir normal aralık olan ölçümler. Kokpit = dinlenme, Gezegen = EVA.
const RANGE_PARAMS: Partial<Record<MetricKey, { rest?: ParamKey; eva?: ParamKey }>> = {
  'cardio.spo2_pct': { rest: 'spo2Normal', eva: 'spo2Normal' },
  'cardio.hr_bpm': { eva: 'heartRateEva' },
  'resp.rr_bpm': { rest: 'respRateRest' },
  'resp.etco2_mmHg': { rest: 'etco2Normal', eva: 'etco2Normal' },
  'env.ppCO2_mmHg': { rest: 'cabinCO2Median', eva: 'cabinCO2Median' },
  'env.ambientTemp_C': { rest: 'ambientTempComfort', eva: 'ambientTempComfort' },
  'env.humidity_pct': { rest: 'humidityComfort', eva: 'humidityComfort' },
  'env.noise_dBA': { rest: 'noiseWorkLimit', eva: 'noiseWorkLimit' },
};

/** Ölçümün o konumdaki resmi normal aralığı; yoksa undefined. */
export function normalRangeFor(key: MetricKey, location: CrewLocation): [number, number] | undefined {
  const p = RANGE_PARAMS[key]?.[location === 'GEZEGEN' ? 'eva' : 'rest'];
  return p ? (PARAMS[p] as Param).normalRange : undefined;
}

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
