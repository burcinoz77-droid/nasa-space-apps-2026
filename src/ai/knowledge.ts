// Parça 4 · ASTRA'nın kaynaklı bilgi tabanı (bağlam). Model "neden önemli?" ya da "sınır ne?"
// sorularında lookup_reference aracıyla buradan okur ve kaynağı belirtir.
// Sayılar planın "Veri ve kaynaklar" tablosundan ve src/sim/parameters.ts'ten gelir; yeni sayı uydurulmaz.
// "Varsayım" yazanların NASA ya da hakemli bir kaynağı yoktur.
import { PARAMS } from '../sim/parameters';

export interface Fact {
  bilgi: string;
  kaynak: string;
  url?: string;
}

export interface ReferenceTopic {
  konu: string;
  anahtarKelimeler: string[];
  bilgiler: Fact[];
}

type ParamLike = { value: number; source?: string; url?: string };

/** PARAMS'tan kaynak adı ve linki; anahtar yoksa verilen kaynak adı kullanılır. */
function src(key: string, fallback: string): Pick<Fact, 'kaynak' | 'url'> {
  const p = (PARAMS as Record<string, ParamLike | undefined>)[key];
  return { kaynak: p?.source ?? fallback, ...(p?.url ? { url: p.url } : {}) };
}

function val(key: string, fallback: number): string {
  const v = (PARAMS as Record<string, ParamLike | undefined>)[key]?.value ?? fallback;
  return v.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
}

/** NASA HRP: 4–6 aylık görevlerde ağırlık taşıyan kemikler ayda ortalama %1–1,5 yoğunluk kaybeder. */
export const BONE_LOSS_PER_MONTH = { min: 1, max: 1.5 };
const BONE_SRC = { kaynak: 'NASA HRP, kemik değişimi riski', url: 'https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/' };

/** Görev gününe göre kaba kemik yoğunluğu kaybı tahmini, örneğin 180. gün için "%6–9". Ölçüm değildir. */
export function boneLossEstimate(missionDay: number): string {
  const months = missionDay / 30.4;
  const lo = Math.round(months * BONE_LOSS_PER_MONTH.min);
  const hi = Math.round(months * BONE_LOSS_PER_MONTH.max);
  return lo === hi ? `%${lo}` : `%${lo}–${hi}`;
}

const ASSUMPTION = { kaynak: 'Varsayım (ekip ayarı; NASA ya da hakemli kaynakta evrensel eşik yok)' };

export const REFERENCES: ReferenceTopic[] = [
  {
    konu: 'radyasyon',
    anahtarKelimeler: ['radyasyon', 'doz', 'msv', 'sievert', 'güneş', 'fırtına', 'sığınak', 'kariyer'],
    bilgiler: [
      { bilgi: `Kariyer radyasyon limiti ${val('careerDoseLimit', 600)} mSv.`, ...src('careerDoseLimit', 'NASA-STD-3001 (OCHMO radyasyon özeti)') },
      { bilgi: `Mars yolculuğunda (Kokpit) doz hızı ${val('doseRateMarsTransit', 1.84)} mSv/gün, yaklaşık 76,7 µSv/sa.`, ...src('doseRateMarsTransit', 'Curiosity RAD, Zeitlin vd. 2013') },
      { bilgi: `Mars yüzeyinde doz hızı ${val('doseRateMarsSurface', 0.64)} mSv/gün, yaklaşık 26,7 µSv/sa; atmosfer kısmen kalkan olur.`, ...src('doseRateMarsSurface', 'Curiosity RAD, Hassler vd. 2013') },
      { bilgi: 'Katman 1, toplam doz 480 mSv (kariyer limitinin %80\'i) olunca dikkat, 600 mSv olunca kritik olay açar; doz hızı kişisel normalden z ≥ 3 sapınca radyasyon sığınağına geçişi başlatır.', kaynak: 'Katman 1 kuralı, NASA-STD-3001 limitine göre' },
      { bilgi: "ISS'teki toplam radyasyonun yaklaşık %30'u nötrondur; bu oran ISS içindir, Mars için kullanılmamalıdır.", kaynak: 'Kanada Uzay Ajansı (CSA), 2026', url: 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp' },
      { bilgi: "Mars yüzeyinde nötronlar toplam doz hızının yaklaşık %7'sini, biyolojik açıdan önemli doz eşdeğerinin yaklaşık %10'unu oluşturur. Uygulama nötron payını ayrıca göstermez.", kaynak: 'Köhler vd. 2014, Curiosity RAD Mars yüzeyi nötron ölçümü' },
      { bilgi: 'Güneş fırtınası senaryosundaki olay sırası Mayıs 2024 DONKI kayıtlarını izler (DONKI doz değeri vermez).', ...src('donkiSep', 'NASA DONKI, Mayıs 2024 SEP') },
      { bilgi: `Mars yolculuğunda Curiosity, sakin dönemde günde yaklaşık 332 µGy, güneş fırtınalarında günde 10.000 µGy'nin üzerinde doz ölçtü; senaryodaki fırtına zirvesi bu yüzden normalin ${val('stormDoseMultiplierPeak', 30)} katıdır.`, ...src('stormDoseMultiplierPeak', 'Guo vd. 2015, A&A') },
      { bilgi: `Artemis I'de Orion kapsülünün sığınağında doz, 1989 fırtınası simülasyonunda mürettebat bölümünün yaklaşık ${val('shelterDoseFactor', 0.23)} katıydı (414 µGy/dk yerine 95 µGy/dk).`, ...src('shelterDoseFactor', 'George vd. 2024, Nature') },
      { bilgi: 'Mayıs 2024 fırtınasında Mars yüzeyinde Curiosity\'nin yanındaki bir astronot 8.100 mikrogray doz alırdı. Senaryodaki yüzey fırtına çarpanı (5 kat) ve fırtına başlangıç çarpanı (25 kat) varsayımdır.', ...src('stormDoseMultiplierSurface', 'NASA, Mayıs 2024') , kaynak: 'NASA, Mayıs 2024 Mars güneş fırtınası', url: 'https://www.nasa.gov/?p=670127' },
    ],
  },
  {
    konu: 'co2',
    anahtarKelimeler: ['co2', 'co₂', 'karbondioksit', 'karbon', 'havalandırma', 'temizleyici', 'kabin havası'],
    bilgiler: [
      { bilgi: `CO₂ kısmi basıncı ${val('co2CautionLimit', 2.3)} mmHg üzerinde dikkat, ${val('co2CriticalLimit', 3.0)} mmHg üzerinde kritik kabul edilir.`, ...src('co2CautionLimit', 'OCHMO-TB-004 CO₂') },
      { bilgi: 'Yüksek CO₂ baş ağrısı ve dikkat kaybı gibi belirtilere yol açabilir.', ...src('co2CautionLimit', 'OCHMO-TB-004 CO₂') },
      { bilgi: `ISS kabininde CO₂ medyanı ${val('cabinCO2Median', 1.9)} mmHg (2.516 ppm); ölçülen en yüksek değer ${val('cabinCO2FailurePeak', 5.3)} mmHg (6.977 ppm).`, ...src('cabinCO2Median', 'OSDR EDA (ISS çevre verisi)') },
      { bilgi: 'Katman 1, kritik CO₂ olayında havalandırmayı otomatik artırır.', kaynak: 'Katman 1 kuralı' },
    ],
  },
  {
    konu: 'oksijen',
    anahtarKelimeler: ['oksijen', 'spo2', 'spo₂', 'doygunluk', 'hipoksi', 'basınç', 'giysi', 'kabin'],
    bilgiler: [
      { bilgi: 'SpO₂ deniz seviyesi basıncında normalde %96–100 arasıdır; kabin basıncı da deniz seviyesindedir. Bu aralıktaki değerler için uyarı verilmez.', ...src('spo2Normal', 'NIH StatPearls') },
      { bilgi: "SpO₂ için %94 altı dikkat, %90 altı kritik eşikleri klinik varsayımdır.", ...ASSUMPTION, kaynak: 'Klinik eşik, varsayım (risk: NASA HRP hipoksi)' },
      { bilgi: `Kabin ${val('cabinPressure', 101.3)} kPa ve %21 O₂ (ISS ile aynı).`, ...src('cabinPressure', 'Kabin atmosferi (NASA NTRS)') },
      { bilgi: `EVA giysisi ${val('suitPressure', 29.6)} kPa ve %100 O₂.`, ...src('suitPressure', 'EVA giysisi regülatörü (NASA NTRS)') },
    ],
  },
  {
    konu: 'sicaklik',
    anahtarKelimeler: ['sıcaklık', 'sicaklik', 'ateş', 'çekirdek', 'ısı', 'efor', 'termal'],
    bilgiler: [
      { bilgi: `Uzayda dinlenmede çekirdek sıcaklık yaklaşık ${val('coreTempRiseInSpace', 1)} °C yüksektir (37,3–37,8 °C); egzersizde 40 °C'yi aşabilir.`, ...src('coreTempRiseInSpace', 'Stahn vd. 2017, Sci Rep') },
      { bilgi: 'Katman 1, çekirdek sıcaklık 38,5 °C olunca dikkat, 39,0 °C olunca kritik olay açar ve zorunlu dinlenme verir.', ...ASSUMPTION },
    ],
  },
  {
    konu: 'uyku',
    anahtarKelimeler: ['uyku', 'yorgunluk', 'dinlenme', 'rem', 'sirkadiyen'],
    bilgiler: [
      { bilgi: `Uzayda ortalama uyku süresi ${val('sleepInSpaceMean', 6.09)} saattir; NASA 8,5 saat planlar.`, ...src('sleepInSpaceMean', 'Barger vd. 2014, Lancet Neurology') },
      { bilgi: 'Uyku eksikliği PVT tepki süresini uzatır ve stresi artırır.', ...src('pvtMeanRtRested', 'Jones vd. 2022 (NASA Reaction Self Test)') },
      { bilgi: 'Katman 1, uyku, PVT, PANAS olumlu duygu, BSI-18 ve HRV sinyallerinden en az üçü birlikte dikkate düşerse yorgunluk olayı açar ve zorunlu dinlenme verir.', kaynak: 'Katman 1 kuralı' },
    ],
  },
  {
    konu: 'bilissel',
    anahtarKelimeler: ['pvt', 'tepki', 'dikkat', 'bilişsel', 'bilissel', 'panas', 'bsi', 'ruh', 'stres', 'kortizol'],
    bilgiler: [
      { bilgi: `Dinlenmiş bir kişide PVT tepki süresi yaklaşık ${val('pvtMeanRtRested', 250)} ms'dir.`, ...src('pvtMeanRtRested', 'Jones vd. 2022 (NASA Reaction Self Test)') },
      { bilgi: `PVT'de ${val('pvtLapseThreshold', 355)} ms ve üzerindeki tepkiler dikkat kaybı sayılır.`, ...src('pvtLapseThreshold', 'Basner vd. 2011, PVT-B') },
      { bilgi: 'PANAS olumlu duygu ortalaması 33,3, olumsuz duygu ortalaması 17,4 (10–50 ölçeği).', ...src('panasPositiveMean', 'Watson vd. 1988, PANAS') },
      { bilgi: 'Katman 1, GSR, ter kortizolü ve PANAS olumsuz duygunun üçü birlikte yükselirse stres olayı açar.', kaynak: 'Katman 1 kuralı' },
    ],
  },
  {
    konu: 'kalp',
    anahtarKelimeler: ['kalp', 'nabız', 'nabiz', 'tansiyon', 'hrv', 'ekg', 'ritim'],
    bilgiler: [
      { bilgi: `Uzun görevde nabız belirgin değişmez; 24 saatlik sistolik tansiyon yaklaşık ${val('bpDropInSpace', 8)} mmHg düşüktür.`, ...src('bpDropInSpace', 'Norsk vd. 2015, J Physiol') },
      { bilgi: 'Kısa süreli HRV (RMSSD) normu 42 ± 15 ms; düşüş stres ve yorgunlukla ilişkilidir.', ...src('hrvRmssdMean', 'Nunan vd. 2010') },
      { bilgi: "EKG'de düzensiz atımlar görülürse Katman 1 dikkat olayı açar ve medikal kontrol önerir; teşhis koymaz.", kaynak: 'Katman 1 kuralı (risk: NASA HRP kalp-damar)' },
    ],
  },
  {
    konu: 'gecikme',
    anahtarKelimeler: ['gecikme', 'dünya', 'iletişim', 'mesaj', 'uçuş doktoru'],
    bilgiler: [
      { bilgi: 'Dünya ile Mars arasında tek yön gecikme 3–22,4 dakika, gidiş-dönüş 6–44 dakikadır.', ...src('commDelayMin', 'NASA Mars Relay Network') },
    ],
  },
  {
    konu: 'ortam',
    anahtarKelimeler: ['ortam', 'kabin sıcaklığı', 'ortam sıcaklığı', 'nem', 'rutubet', 'gürültü', 'ses düzeyi', 'desibel', 'dba', 'konfor'],
    bilgiler: [
      { bilgi: 'NASA performans bölgesi: ortam sıcaklığı 20–25 °C ve bağıl nem %30–60. Sağlık sınırı 18 °C ve %75 nem ile 27 °C ve %25 nem arasıdır. Uygulamadaki normal değerler (22,5 °C, %45) bu aralığın ortasıdır.', ...src('ambientTempComfort', 'OCHMO-TB-002 ECLSS') },
      { bilgi: 'Uzay aracı çalışma alanlarında sürekli gürültü sınırı NC-50 eğrisidir (yaklaşık 58 dBA). Uygulamadaki 55 dBA normal değeri bu sınırın altında seçilmiş bir varsayımdır.', ...src('noiseBaseline', 'OCHMO-TB-035 Akustik') },
      { bilgi: "ISS'te astronotların gürültü maruziyeti için sınır 16 saatlik çalışma ortalamasında 72 dBA, 8 saatlik uykuda 62 dBA'dır. Uyku sırasında 50 dBA aşılırsa uçuş doktoru astronotu gürültüyü azaltma adımları konusunda bilgilendirir.", ...src('noiseWorkLimit', 'ISS gürültü sınırları') },
      { bilgi: "ISS'te gürültü, astronotların taktığı kişisel gürültü dozimetreleriyle ölçülür.", kaynak: 'NASA NTRS, ISS akustik izleme', url: 'https://ntrs.nasa.gov/api/citations/20110013006/downloads/20110013006.pdf' },
    ],
  },
  {
    konu: 'kemik',
    anahtarKelimeler: ['kemik', 'osteoporoz', 'kırık', 'kemik yoğunluğu', 'kas kaybı', 'kas'],
    bilgiler: [
      { bilgi: 'Kemik yoğunluğu bu sistemde ölçülmez; NASA bunu uçuş öncesi ve sonrası kemik taramalarıyla izler.', ...BONE_SRC },
      { bilgi: `NASA'ya göre 4–6 aylık görevlerde ağırlık taşıyan kemikler ayda ortalama %1–1,5 yoğunluk kaybeder; 180. gün için bu kabaca ${boneLossEstimate(180)} eder. Bu kişisel bir ölçüm değil, genel bir tahmindir. Daha uzun görevlerde bu hızın sürüp sürmediği henüz bilinmiyor.`, ...BONE_SRC },
    ],
  },
  {
    konu: 'goz',
    anahtarKelimeler: ['göz', 'goz', 'sans', 'görme', 'optik disk', 'ödem'],
    bilgiler: [
      { bilgi: "SANS (uzay uçuşuna bağlı nöro-oküler sendrom), NASA'nın şu anda uçuşla ilgili en önde gelen sağlık riski olarak gösterdiği durumdur.", kaynak: 'NASA HRP riskler', url: 'https://www.nasa.gov/hrp/risks/' },
      { bilgi: "Uzun görevlerde belirgin optik disk ödemi astronotların yaklaşık %16–19'unda görülür; göz taramasıyla (OCT) bakıldığında bu oran yaklaşık %70'tir.", kaynak: 'JAMA Ophthalmology, NASA Bir Yıllık Görev vaka serisi', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8085766' },
      { bilgi: 'Uygulamadaki göz bebeği ölçümleri SANS için yalnızca dolaylı ve varsayıma dayalı bir göstergedir; kesin değerlendirme göz taramasıyla yapılır.', ...ASSUMPTION },
    ],
  },
  {
    konu: 'yercekimi',
    anahtarKelimeler: ['yerçekimi', 'yercekimi', 'gravite', 'çekim', 'ağırlık'],
    bilgiler: [
      { bilgi: "Mars yüzeyinde ortalama yerçekimi 3,73 m/s², yani Dünya'nınkinin 0,38'idir. Simülasyon yerçekiminin vücuda etkisini modellemez.", kaynak: 'NASA Mars Fact Sheet', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html' },
    ],
  },
  {
    konu: 'olculmeyenler',
    anahtarKelimeler: ['bağışıklık', 'bagisiklik', 'immün', 'denge', 'vestibüler', 'ekip uyumu', 'takım', 'ekip', 'mikrop', 'bakteri', 'ölçülmeyen', 'kapsam'],
    bilgiler: [
      { bilgi: 'Bağışıklık sistemi bu sistemde ölçülmez; kan ya da tükürük tahlili gerekir. Inspiration4 görevinin kan verileri NASA OSDR arşivinde açıktır.', kaynak: 'NASA OSDR, Inspiration4', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11094041/' },
      { bilgi: 'Denge (vestibüler sistem) bu sistemde ölçülmez. Uzun görevden dönen astronotlar ayakta dengeyi daha geç bulur ve denge testlerinde daha az doğru adım atar.', kaynak: 'Frontiers in Physiology 2025, NASA JSC', url: 'https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2025.1677377/full' },
      { bilgi: 'Ekip uyumu doğrudan ölçülmez; stres ve ruh hali ölçümleri (BSI-18, PANAS) dolaylı bilgi verir. NASA, uzay uçuşundaki ekip ölçümlerinin henüz yayımlanmadığını belirtir.', kaynak: 'NASA NTRS, ekip riski kanıt raporu', url: 'https://ntrs.nasa.gov/citations/20220007465' },
      { bilgi: "Kabin mikropları bu sistemde ölçülmez. ISS yüzeylerinde en sık görülen mikroplar insan derisiyle ilişkili türlerdir.", kaynak: 'Microbial Tracking-2, Microbiome', url: 'https://www.osti.gov/biblio/1881622' },
    ],
  },
  {
    konu: 'yontem',
    anahtarKelimeler: ['yöntem', 'yontem', 'baseline', 'z-skoru', 'z skoru', 'katman', 'nasıl karar', 'eşik', 'esik'],
    bilgiler: [
      {
        bilgi: 'NASA kaynaklarında nabız, tansiyon, SpO₂ ve ruh hali için evrensel sayısal eşik yoktur; bu yüzden Katman 1 her astronotun kişisel normalinden sapmayı (z-skoru) izler: z ≥ 2 dikkat, z ≥ 3 kritik, en az 3 ardışık ölçümde.',
        kaynak: 'Proje yöntemi (plan: Veri ve kaynaklar)',
      },
      { bilgi: 'Uyarıları yalnızca Katman 1 açar; ASTRA (Katman 2) sadece okur ve açıklar.', kaynak: 'Proje mimarisi' },
      { bilgi: 'Resmi kaynağında normal aralık verilen ölçümlerde değer bu aralıktaysa uyarı verilmez: SpO₂ %96–100 (NIH), dinlenme solunumu 12–20/dk ve EtCO₂ 35–45 mmHg (JEMS), uzay yürüyüşünde nabız 100–110 bpm (NASA, Apollo), kabin CO₂ 2,3 mmHg\'ye kadar, ortam 20–25 °C ve nem %30–60 (NASA), gürültü 72 dBA\'ya kadar (ISS). Aralık dışına çıkınca kişisel normalden sapma değerlendirilir.', kaynak: 'Proje yöntemi (src/sim/parameters.ts normal aralıkları)' },
    ],
  },
];
