// Parça 4 · Olası durum taraması (kesin teşhis DEĞİL). Bir astronotun hangi ölçümlerinin kişisel
// normalinden saptığına bakar ve bu sapmaların birlikte hangi durumla UYUMLU OLABİLECEĞİNİ söyler.
// Her sonuç: dayanak sinyaller (güncel değer + kişisel normal), olasılık (düşük / orta; asla "kesin"),
// kaynak ve önerilen kontrol. ASTRA bunu assess_possible_conditions aracıyla okur ve ihtimal diliyle anlatır.
// Uyarı açmaz, Katman 1'in kararlarını değiştirmez.
import { METRIC_BY_KEY, readMetric, type MetricKey } from '../metrics';
import type { AstraState } from '../store';
import type { CrewId } from '../types';
import { valueText } from './labels';
import { baselineReady, personalNormal } from './memory';

type Dir = 'high' | 'low';

interface Sign {
  key: MetricKey;
  dir: Dir;
  /** Mutlak eşik: aşılırsa kişisel normale bakmadan sapma sayılır. */
  abs?: number;
}

export interface ConditionRule {
  durum: string;
  aciklama: string;
  kaynak: string;
  oneri: string;
  isaretler: Sign[];
  /** Bu kuralın tetiklenmesi için gereken en az sapmış işaret sayısı. */
  enAz: number;
  /** Bu işaret sapmadan kural tetiklenmez. */
  zorunlu?: MetricKey;
}

export const CONDITION_RULES: ConditionRule[] = [
  {
    durum: 'CO₂ birikmesine bağlı etkilenme (hiperkapni)',
    aciklama: 'Ortamdaki CO₂ yükselince solunum ve nabız hızlanabilir; baş ağrısı ve dikkat kaybı görülebilir.',
    kaynak: 'OCHMO-TB-004 CO₂',
    oneri: 'Havalandırma ve CO₂ temizleyici kontrolü; baş ağrısı ve dikkat belirtilerinin izlenmesi',
    isaretler: [
      { key: 'env.ppCO2_mmHg', dir: 'high', abs: 2.3 },
      { key: 'resp.etco2_mmHg', dir: 'high', abs: 45 },
      { key: 'resp.rr_bpm', dir: 'high' },
      { key: 'cardio.hr_bpm', dir: 'high' },
      { key: 'cog.pvtMeanRt_ms', dir: 'high' },
    ],
    enAz: 1,
    zorunlu: 'env.ppCO2_mmHg',
  },
  {
    durum: 'Oksijen yetersizliği (hipoksi)',
    aciklama: 'Kandaki oksijen doygunluğu düşerse vücut solunumu ve nabzı hızlandırarak telafi etmeye çalışır.',
    kaynak: 'NASA HRP hipoksi riski (SpO₂ eşiği klinik varsayım)',
    oneri: 'Oksijen beslemesi, kabin ya da giysi basıncının kontrolü ve medikal kontrol',
    isaretler: [
      { key: 'cardio.spo2_pct', dir: 'low', abs: 94 },
      { key: 'cardio.hr_bpm', dir: 'high' },
      { key: 'resp.rr_bpm', dir: 'high' },
      { key: 'env.o2_pct', dir: 'low' },
    ],
    enAz: 1,
    zorunlu: 'cardio.spo2_pct',
  },
  {
    durum: 'Isı stresi ve aşırı efor',
    aciklama: 'Yoğun efor ve giysi içinde ısı birikmesi çekirdek sıcaklığı, nabzı ve laktatı birlikte yükseltir.',
    kaynak: 'Stahn vd. 2017, Sci Rep',
    oneri: 'Eforun azaltılması, soğutma sisteminin kontrolü ve dinlenme',
    isaretler: [
      { key: 'resp.coreTemp_C', dir: 'high', abs: 38.5 },
      { key: 'cardio.hr_bpm', dir: 'high' },
      { key: 'biochem.sweatLactate_mM', dir: 'high' },
      { key: 'resp.rr_bpm', dir: 'high' },
      { key: 'resp.gsr_uS', dir: 'high' },
    ],
    enAz: 2,
    zorunlu: 'resp.coreTemp_C',
  },
  {
    durum: 'Sıvı ve elektrolit kaybı (dehidratasyon) eğilimi',
    aciklama: 'Yoğun terlemede ter sodyumu ve laktat artar; sıvı kaybı nabzı da yükseltebilir.',
    kaynak: 'Ter biyobelirteçleri tablosu',
    oneri: 'Sıvı ve elektrolit alımının değerlendirilmesi, eforun azaltılması',
    isaretler: [
      { key: 'biochem.sweatSodium_mM', dir: 'high' },
      { key: 'biochem.sweatLactate_mM', dir: 'high' },
      { key: 'resp.coreTemp_C', dir: 'high' },
      { key: 'cardio.hr_bpm', dir: 'high' },
    ],
    enAz: 2,
    zorunlu: 'biochem.sweatSodium_mM',
  },
  {
    durum: 'Kalp ritim düzensizliği (aritmi) olasılığı',
    aciklama: "EKG'de düzensiz atımların artması ritim bozukluğuna işaret edebilir; yorgunluk, stres ve efor da etkiler.",
    kaynak: 'NASA HRP kalp-damar riski',
    oneri: 'Eforun azaltılması, EKG izleminin sürdürülmesi ve medikal kontrol',
    isaretler: [
      { key: 'cardio.ecg_ectopic_per_min', dir: 'high', abs: 6 },
      { key: 'cardio.hr_bpm', dir: 'high' },
      { key: 'cardio.hrv_rmssd_ms', dir: 'low' },
    ],
    enAz: 1,
    zorunlu: 'cardio.ecg_ectopic_per_min',
  },
  {
    durum: 'Uyku yoksunluğu ve yorgunluk',
    aciklama: 'Yetersiz uyku tepki süresini uzatır, dikkat kayıplarını ve olumsuz duyguyu artırır.',
    kaynak: 'Barger vd. 2014; Jones vd. 2022',
    oneri: 'Dinlenme ve uyku planının gözden geçirilmesi, kritik görevlerin devri',
    isaretler: [
      { key: 'env.sleepLastNight_h', dir: 'low' },
      { key: 'cog.pvtMeanRt_ms', dir: 'high' },
      { key: 'cog.pvtLapses', dir: 'high' },
      { key: 'cog.panasPositive', dir: 'low' },
      { key: 'cardio.hrv_rmssd_ms', dir: 'low' },
      { key: 'env.remPct', dir: 'low' },
      { key: 'env.swsPct', dir: 'low' },
    ],
    enAz: 3,
  },
  {
    durum: 'Akut stres yükü (kaygı belirtileri)',
    aciklama: 'Deri iletkenliği, ter kortizolü ve olumsuz duygunun birlikte artması stres tepkisiyle uyumludur.',
    kaynak: 'NASA HRP davranışsal sağlık riski',
    oneri: 'Kısa mola, ekip içi görüşme; sürerse uçuş doktoru ve psikolojik destek değerlendirmesi',
    isaretler: [
      { key: 'resp.gsr_uS', dir: 'high' },
      { key: 'biochem.sweatCortisol_ng_mL', dir: 'high' },
      { key: 'cog.panasNegative', dir: 'high' },
      { key: 'cog.bsi18_gsi', dir: 'high' },
      { key: 'cog.speechStrainIndex', dir: 'high' },
      { key: 'cardio.hrv_rmssd_ms', dir: 'low' },
    ],
    enAz: 3,
  },
  {
    durum: 'Göz ve görmeyle ilgili değişiklik (SANS) şüphesi',
    aciklama: 'Göz bebeği tepkisindeki değişiklik, uzun uçuşta görülen nöro-oküler değişikliklerin izlenmesini gerektirebilir.',
    kaynak: 'NASA HRP SANS riski (göz bebeği ölçümleri varsayım)',
    oneri: 'Göz muayenesi ve görme testlerinin planlanması',
    isaretler: [
      { key: 'cog.pupilLatency_ms', dir: 'high' },
      { key: 'cog.pupilDiameter_mm', dir: 'high' },
    ],
    enAz: 2,
  },
  {
    durum: 'Radyasyon maruziyetinde artış',
    aciklama: 'Doz hızının artması toplam dozu hızla yükseltir; uzun vadeli sağlık riski toplam dozla artar.',
    kaynak: 'NASA-STD-3001 (OCHMO radyasyon özeti)',
    oneri: 'Radyasyon sığınağına geçişin değerlendirilmesi ve doz takibi',
    isaretler: [
      { key: 'env.doseRate_uSv_h', dir: 'high' },
      { key: 'env.doseCumulative_mSv', dir: 'high', abs: 480 },
    ],
    enAz: 1,
  },
];

/** Bu z değerinin üstü sapma sayılır. Tek ölçümlük gürültüyü elemek için 2,5. */
const Z_LIMIT = 2.5;

/**
 * Sapma tabanları (plan: "Sd tabanları", Katman 1 ile aynı). Günlük ölçümlerde sapma 0 çıkar ve
 * z sonsuza gider; taban bunu önler. Tabloda olmayan ölçüm için ortalamanın %3'ü.
 */
const SD_FLOOR: Partial<Record<MetricKey, number>> = {
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
};

export interface Deviation {
  key: MetricKey;
  value: number;
  normal?: number;
  z?: number;
  text: string;
}

/** Ölçüm kişisel normalinden riskli yöne sapmış mı? */
function deviation(s: AstraState, id: CrewId, sign: Sign): Deviation | undefined {
  const t = s.telemetry[id];
  if (!t) return undefined;
  const value = readMetric(t, sign.key);
  const pn = personalNormal(id, sign.key);
  const floor = pn ? Math.max(pn.sd, SD_FLOOR[sign.key] ?? Math.abs(pn.mean) * 0.03, 0.01) : 0;
  const z = pn ? (value - pn.mean) / floor : undefined;
  const byZ = z !== undefined && (sign.dir === 'high' ? z >= Z_LIMIT : z <= -Z_LIMIT);
  const byAbs = sign.abs !== undefined && (sign.dir === 'high' ? value >= sign.abs : value <= sign.abs);
  if (!byZ && !byAbs) return undefined;
  const label = METRIC_BY_KEY[sign.key]?.label ?? sign.key;
  const text = pn ? `${label} ${valueText(sign.key, value)} (kişisel normal ${valueText(sign.key, pn.mean)})` : `${label} ${valueText(sign.key, value)}`;
  return { key: sign.key, value, normal: pn?.mean, z, text };
}

export interface PossibleCondition {
  durum: string;
  olasilik: 'düşük' | 'orta';
  dayanak: string[];
  aciklama: string;
  oneri: string;
  kaynak: string;
}

/**
 * Bir astronot için olası durumlar (en fazla 3, en güçlü dayanaklı önce).
 * Kişisel normal henüz kurulmadıysa (ilk 30 ölçüm) boş döner.
 */
export function possibleConditions(s: AstraState, id: CrewId): PossibleCondition[] {
  if (!baselineReady() || !s.telemetry[id]) return [];
  const found: (PossibleCondition & { score: number })[] = [];
  for (const rule of CONDITION_RULES) {
    const devs = rule.isaretler.map((sign) => deviation(s, id, sign)).filter((d): d is Deviation => !!d);
    if (devs.length < rule.enAz) continue;
    if (rule.zorunlu && !devs.some((d) => d.key === rule.zorunlu)) continue;
    const strong = devs.length >= rule.enAz + 1 || devs.some((d) => Math.abs(d.z ?? 0) >= 4);
    found.push({
      durum: rule.durum,
      olasilik: strong ? 'orta' : 'düşük',
      dayanak: devs.map((d) => d.text),
      aciklama: rule.aciklama,
      oneri: rule.oneri,
      kaynak: rule.kaynak,
      score: devs.length + (strong ? 1 : 0),
    });
  }
  return found
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ score: _score, ...rest }) => rest);
}

export const CONDITION_DISCLAIMER =
  'Bu değerlendirme kesin değildir; ölçümlerdeki değişikliklere dayanan bir olasılıktır ve teşhis yerine geçmez. Medikal kontrol ve uçuş doktoru değerlendirmesi gerekir.';
