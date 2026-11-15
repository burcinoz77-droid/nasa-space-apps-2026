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
  hart2006: { ad: 'Hart 2006, NASA-TLX 20 yıl sonra (NASA Ames)', url: 'https://humansystems.arc.nasa.gov/publications/HFES_2006_Paper.pdf' },
  basner2011: { ad: 'Basner vd. 2011, PVT-B (Acta Astronautica)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3197786' },
  jones2022: { ad: 'Jones vd. 2022, ISS Reaction Self Test', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8919197' },
  spinoff2013: { ad: 'NASA Spinoff 2013, ISS Reaction Self-Test', url: 'https://spinoff.nasa.gov/Spinoff2013/hm_1.html' },
  samnPerelli: { ad: 'Samn & Perelli 1982 (ABD Hava Kuvvetleri), ölçek maddeleri', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9286802' },
  nasaFatigue: { ad: 'NASA/TM-2012-216053, NASA–easyJet yorgunluk çalışması (Samn-Perelli + PVT)', url: 'https://ntrs.nasa.gov/citations/20130001718' },
} satisfies Record<string, TestSource>;

export type TestKind = 'SP' | 'TLX' | 'PVT';

export const TEST_INFO: Record<TestKind, { ad: string; kisa: string; sure: string; olcer: string; kaynaklar: TestSource[] }> = {
  SP: {
    ad: 'Samn-Perelli yorgunluk ölçeği',
    kisa: 'Yorgunluk',
    sure: '10 sn',
    olcer: 'Şu anki yorgunluk (öz bildirim), 1–7',
    kaynaklar: [TEST_SOURCES.samnPerelli, TEST_SOURCES.nasaFatigue],
  },
  TLX: {
    ad: 'NASA-TLX iş yükü ölçeği',
    kisa: 'İş yükü',
    sure: '1 dk',
    olcer: 'Son görevin algılanan iş yükü (öz bildirim), 0–100',
    kaynaklar: [TEST_SOURCES.tlx, TEST_SOURCES.hart2006],
  },
  PVT: {
    ad: 'PVT-B tepki testi',
    kisa: 'Tepki (PVT)',
    sure: '3 dk',
    olcer: 'Dikkat ve tepki hızı (nesnel ölçüm)',
    kaynaklar: [TEST_SOURCES.basner2011, TEST_SOURCES.spinoff2013],
  },
};

// ---------------------------------------------------------------- Lisanslı ölçeklerin simüle puanları
// Simülasyondaki (Parça 1) PANAS ve BSI-18 puanları gerçek ölçüm değildir; soruları kullanılmaz, sadece puan simüle edilir.
// İki ölçek de lisanslıdır; gerçek sistemde bu puanları toplamak için lisans gerekir. ASTRA ve Testler sekmesi bunu belirtir.
export const LICENSED_SIM_KEYS: readonly string[] = ['cog.panasPositive', 'cog.panasNegative', 'cog.bsi18_gsi'];
export const LICENSED_NOTE = 'PANAS ve BSI-18 puanları simüledir; gerçek sistemde lisanslı ölçek gerekir.';
export const LICENSED_NOTE_LONG = `${LICENSED_NOTE.slice(0, -1)} (PANAS: APA telifi, BSI-18: Pearson'un ticari ölçeği).`;

// ---------------------------------------------------------------- Samn-Perelli (7 basamak)
// Maddeler: Samn & Perelli 1982. Uç ifadeler PMC9286802'de, tüm basamaklar havacılık çalışmalarında aynen geçer.
export const SP_LEVELS: { puan: number; tr: string; en: string }[] = [
  { puan: 1, tr: 'Tamamen zinde, tamamen uyanık', en: 'Fully alert, wide awake' },
  { puan: 2, tr: 'Çok canlı ve tepkili ama en iyi hâlinde değil', en: 'Very lively, responsive, but not at peak' },
  { puan: 3, tr: 'İyi, biraz dinç', en: 'Okay, somewhat fresh' },
  { puan: 4, tr: 'Biraz yorgun, pek dinç değil', en: 'A little tired, less than fresh' },
  { puan: 5, tr: 'Orta derecede yorgun, keyifsiz', en: 'Moderately tired, let down' },
  { puan: 6, tr: 'Aşırı yorgun, odaklanmak çok zor', en: 'Extremely tired, very difficult to concentrate' },
  { puan: 7, tr: 'Tamamen bitkin, etkili çalışamıyor', en: 'Completely exhausted, unable to function effectively' },
];
export const SP_PROMPT = 'Şu anki durumunuzu en iyi anlatan ifadeyi seçin.';

// ---------------------------------------------------------------- NASA-TLX (6 alt ölçek)
// Maddeler: NASA Ames TLX kâğıt-kalem formu (Hart & Staveland 1988). Her alt ölçek 0–100, 5'er adım (21 çentik).
// Performans alt ölçeğinde 0 = mükemmel, 100 = başarısız; yani tüm alt ölçeklerde yüksek puan = daha yüksek yük.
export type TlxKey = 'zihinsel' | 'fiziksel' | 'zamansal' | 'performans' | 'efor' | 'engellenme';

export const TLX_ITEMS: { key: TlxKey; ad: string; en: string; soru: string; soruEn: string; alt: string; ust: string }[] = [
  { key: 'zihinsel', ad: 'Zihinsel talep', en: 'Mental Demand', soru: 'Görev zihinsel olarak ne kadar zorlayıcıydı?', soruEn: 'How mentally demanding was the task?', alt: 'Çok düşük', ust: 'Çok yüksek' },
  { key: 'fiziksel', ad: 'Fiziksel talep', en: 'Physical Demand', soru: 'Görev fiziksel olarak ne kadar zorlayıcıydı?', soruEn: 'How physically demanding was the task?', alt: 'Çok düşük', ust: 'Çok yüksek' },
  { key: 'zamansal', ad: 'Zaman baskısı', en: 'Temporal Demand', soru: 'Görevin temposu ne kadar aceleli ya da sıkışıktı?', soruEn: 'How hurried or rushed was the pace of the task?', alt: 'Çok düşük', ust: 'Çok yüksek' },
  {
    key: 'performans',
    ad: 'Performans',
    en: 'Performance',
    soru: 'Sizden isteneni yerine getirmede ne kadar başarılıydınız?',
    soruEn: 'How successful were you in accomplishing what you were asked to do?',
    alt: 'Mükemmel',
    ust: 'Başarısız',
  },
  {
    key: 'efor',
    ad: 'Efor',
    en: 'Effort',
    soru: 'Bu performansa ulaşmak için ne kadar çok çalışmanız gerekti?',
    soruEn: 'How hard did you have to work to accomplish your level of performance?',
    alt: 'Çok düşük',
    ust: 'Çok yüksek',
  },
  {
    key: 'engellenme',
    ad: 'Engellenme (stres)',
    en: 'Frustration',
    soru: 'Ne kadar güvensiz, cesaretsiz, sinirli, stresli ve rahatsız hissettiniz?',
    soruEn: 'How insecure, discouraged, irritated, stressed, and annoyed were you?',
    alt: 'Çok düşük',
    ust: 'Çok yüksek',
  },
];
export const TLX_STEP = 5;
export const TLX_PROMPT = 'Az önce bitirdiğiniz görevi düşünün ve her ölçekte işaretleyin.';

// ---------------------------------------------------------------- PVT-B (Basner vd. 2011)
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
