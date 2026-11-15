// Parça 4 · Psikolojik testler: NASA'nın ve havacılık yorgunluk çalışmalarının kullandığı, ücretsiz ve
// izin gerektirmeyen üç ölçek. Soruları yapay zekâ YAZMAZ ve değiştirmez: aşağıdaki resmi maddeler aynen kullanılır.
// Türkçe metinler ekibin çevirisidir; resmi (doğrulanmış) Türkçe sürüm değildir. İngilizce asılları yanında durur.
//
// Kullanılmayanlar ve nedeni:
//   PANAS  -> APA telifi (ekip kararıyla kullanılmadı)
//   BSI-18 -> ticari ölçek (Pearson), maddeleri kullanılamaz
//   NASA Cognition bataryası -> lisanslı

export interface TestSource {
  ad: string;
  url: string;
}

export const TEST_SOURCES = {
  tlx: { ad: 'NASA Ames, NASA-TLX', url: 'https://humansystems.arc.nasa.gov/groups/tlx/' },
  hart2006: { ad: 'Hart 2006, NASA-TLX 20 years later (NASA Ames)', url: 'https://humansystems.arc.nasa.gov/publications/HFES_2006_Paper.pdf' },
  basner2011: { ad: 'Basner et al. 2011, PVT-B (Acta Astronautica)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3197786' },
  jones2022: { ad: 'Jones et al. 2022, ISS Reaction Self Test', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8919197' },
  spinoff2013: { ad: 'NASA Spinoff 2013, ISS Reaction Self-Test', url: 'https://spinoff.nasa.gov/Spinoff2013/hm_1.html' },
  samnPerelli: { ad: 'Samn & Perelli 1982 (US Air Force), scale items', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9286802' },
  nasaFatigue: { ad: 'NASA/TM-2012-216053, NASA–easyJet fatigue study (Samn-Perelli + PVT)', url: 'https://ntrs.nasa.gov/citations/20130001718' },
} satisfies Record<string, TestSource>;

export type TestKind = 'SP' | 'TLX' | 'PVT';

export const TEST_INFO: Record<TestKind, { ad: string; kisa: string; sure: string; olcer: string; kaynaklar: TestSource[] }> = {
  SP: {
    ad: 'Samn-Perelli fatigue scale',
    kisa: 'Fatigue',
    sure: '10 s',
    olcer: 'Current fatigue (self-report), 1–7',
    kaynaklar: [TEST_SOURCES.samnPerelli, TEST_SOURCES.nasaFatigue],
  },
  TLX: {
    ad: 'NASA-TLX workload scale',
    kisa: 'Workload',
    sure: '1 min',
    olcer: 'Perceived workload of the last task (self-report), 0–100',
    kaynaklar: [TEST_SOURCES.tlx, TEST_SOURCES.hart2006],
  },
  PVT: {
    ad: 'PVT-B reaction test',
    kisa: 'Reaction (PVT)',
    sure: '3 min',
    olcer: 'Attention and reaction speed (objective measure)',
    kaynaklar: [TEST_SOURCES.basner2011, TEST_SOURCES.spinoff2013],
  },
};

// ---------------------------------------------------------------- Lisanslı ölçeklerin simüle puanları
// Simülasyondaki (Parça 1) PANAS ve BSI-18 puanları gerçek ölçüm değildir; soruları kullanılmaz, sadece puan simüle edilir.
// İki ölçek de lisanslıdır; gerçek sistemde bu puanları toplamak için lisans gerekir. ASTRA ve Testler sekmesi bunu belirtir.
export const LICENSED_SIM_KEYS: readonly string[] = ['cog.panasPositive', 'cog.panasNegative', 'cog.bsi18_gsi'];
export const LICENSED_NOTE = 'PANAS and BSI-18 scores are simulated; a real system needs licensed scales.';
export const LICENSED_NOTE_LONG = `${LICENSED_NOTE.slice(0, -1)} (PANAS: APA copyright, BSI-18: Pearson commercial scale).`;

// ---------------------------------------------------------------- Samn-Perelli (7 basamak)
// Maddeler: Samn & Perelli 1982. Uç ifadeler PMC9286802'de, tüm basamaklar havacılık çalışmalarında aynen geçer.
export const SP_LEVELS: { puan: number; tr: string; en: string }[] = [
  { puan: 1, tr: 'Fully alert, wide awake', en: 'Fully alert, wide awake' },
  { puan: 2, tr: 'Very lively, responsive, but not at peak', en: 'Very lively, responsive, but not at peak' },
  { puan: 3, tr: 'Okay, somewhat fresh', en: 'Okay, somewhat fresh' },
  { puan: 4, tr: 'A little tired, less than fresh', en: 'A little tired, less than fresh' },
  { puan: 5, tr: 'Moderately tired, let down', en: 'Moderately tired, let down' },
  { puan: 6, tr: 'Extremely tired, very difficult to concentrate', en: 'Extremely tired, very difficult to concentrate' },
  { puan: 7, tr: 'Completely exhausted, unable to function effectively', en: 'Completely exhausted, unable to function effectively' },
];
export const SP_PROMPT = 'Choose the statement that best describes how you feel right now.';

// ---------------------------------------------------------------- NASA-TLX (6 alt ölçek)
// Maddeler: NASA Ames TLX kâğıt-kalem formu (Hart & Staveland 1988). Her alt ölçek 0–100, 5'er adım (21 çentik).
// Performans alt ölçeğinde 0 = mükemmel, 100 = başarısız; yani tüm alt ölçeklerde yüksek puan = daha yüksek yük.
export type TlxKey = 'zihinsel' | 'fiziksel' | 'zamansal' | 'performans' | 'efor' | 'engellenme';

export const TLX_ITEMS: { key: TlxKey; ad: string; en: string; soru: string; soruEn: string; alt: string; ust: string }[] = [
  { key: 'zihinsel', ad: 'Mental Demand', en: 'Mental Demand', soru: 'How mentally demanding was the task?', soruEn: 'How mentally demanding was the task?', alt: 'Very low', ust: 'Very high' },
  { key: 'fiziksel', ad: 'Physical Demand', en: 'Physical Demand', soru: 'How physically demanding was the task?', soruEn: 'How physically demanding was the task?', alt: 'Very low', ust: 'Very high' },
  { key: 'zamansal', ad: 'Temporal Demand', en: 'Temporal Demand', soru: 'How hurried or rushed was the pace of the task?', soruEn: 'How hurried or rushed was the pace of the task?', alt: 'Very low', ust: 'Very high' },
  {
    key: 'performans',
    ad: 'Performance',
    en: 'Performance',
    soru: 'How successful were you in accomplishing what you were asked to do?',
    soruEn: 'How successful were you in accomplishing what you were asked to do?',
    alt: 'Perfect',
    ust: 'Failure',
  },
  {
    key: 'efor',
    ad: 'Effort',
    en: 'Effort',
    soru: 'How hard did you have to work to accomplish your level of performance?',
    soruEn: 'How hard did you have to work to accomplish your level of performance?',
    alt: 'Very low',
    ust: 'Very high',
  },
  {
    key: 'engellenme',
    ad: 'Frustration',
    en: 'Frustration',
    soru: 'How insecure, discouraged, irritated, stressed, and annoyed were you?',
    soruEn: 'How insecure, discouraged, irritated, stressed, and annoyed were you?',
    alt: 'Very low',
    ust: 'Very high',
  },
];
export const TLX_STEP = 5;
export const TLX_PROMPT = 'Think about the task you just finished and mark each scale.';

// ---------------------------------------------------------------- PVT-B (Basner et al. 2011)
export const PVT = {
  durationS: 180, // 3 dakika
  demoDurationS: 30, // kısa deneme: sonucu Katman 1'e GİTMEZ (geçerli PVT-B değil)
  minDelayMs: 1000, // uyaranlar arası 1–4 sn (1 sn'lik tepki gösterimi dahil)
  maxDelayMs: 4000,
  feedbackMs: 1000,
  lapseMs: 355, // PVT-B dikkat kaybı eşiği (standart 10 dk PVT'de 500 ms)
  falseStartMs: 100, // 100 ms'den kısa tepki ya da uyarandan önce basma = erken basma
  timeoutMs: 30_000, // 30 sn tepki yoksa dikkat kaybı sayılır
} as const;
