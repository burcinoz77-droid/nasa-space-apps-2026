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
      { bilgi: 'Güneş fırtınası senaryosundaki olay sırası Mayıs 2024 DONKI kayıtlarını izler; doz çarpanları varsayımdır (DONKI doz değeri vermez).', ...src('donkiSep', 'NASA DONKI, Mayıs 2024 SEP') },
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
      { bilgi: 'SpO₂ normalde %96–99; %94 altı dikkat, %90 altı kritik kabul edilir.', ...ASSUMPTION, kaynak: 'Klinik eşik, varsayım (risk: NASA HRP hipoksi)' },
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
    konu: 'yontem',
    anahtarKelimeler: ['yöntem', 'yontem', 'baseline', 'z-skoru', 'z skoru', 'katman', 'nasıl karar', 'eşik', 'esik'],
    bilgiler: [
      {
        bilgi: 'NASA kaynaklarında nabız, tansiyon, SpO₂ ve ruh hali için evrensel sayısal eşik yoktur; bu yüzden Katman 1 her astronotun kişisel normalinden sapmayı (z-skoru) izler: z ≥ 2 dikkat, z ≥ 3 kritik, en az 3 ardışık ölçümde.',
        kaynak: 'Proje yöntemi (plan: Veri ve kaynaklar)',
      },
      { bilgi: 'Uyarıları yalnızca Katman 1 açar; ASTRA (Katman 2) sadece okur ve açıklar.', kaynak: 'Proje mimarisi' },
    ],
  },
];
