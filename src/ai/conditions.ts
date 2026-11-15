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
    durum: 'Effects of CO₂ build-up (hypercapnia)',
    aciklama: 'When ambient CO₂ rises, breathing and heart rate can speed up; headache and loss of attention can follow.',
    kaynak: 'OCHMO-TB-004 CO₂',
    oneri: 'Check ventilation and the CO₂ scrubber; monitor for headache and attention symptoms',
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
    durum: 'Low oxygen (hypoxia)',
    aciklama: 'If blood oxygen saturation drops, the body tries to compensate by speeding up breathing and heart rate.',
    kaynak: 'NASA HRP hypoxia risk (SpO₂ threshold is a clinical assumption)',
    oneri: 'Check oxygen supply and cabin or suit pressure, and a medical check',
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
    durum: 'Heat stress and overexertion',
    aciklama: 'Heavy effort and heat build-up inside the suit raise core temperature, heart rate and lactate together.',
    kaynak: 'Stahn et al. 2017, Sci Rep',
    oneri: 'Reduce effort, check the cooling system, and rest',
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
    durum: 'A tendency toward fluid and electrolyte loss (dehydration)',
    aciklama: 'Heavy sweating raises sweat sodium and lactate; fluid loss can also raise heart rate.',
    kaynak: 'Sweat biomarker table',
    oneri: 'Review fluid and electrolyte intake, reduce effort',
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
    durum: 'A cardiac rhythm disturbance (arrhythmia)',
    aciklama: 'More irregular beats on the ECG may point to a rhythm disturbance; fatigue, stress and effort also play a role.',
    kaynak: 'NASA HRP cardiovascular risk',
    oneri: 'Reduce effort, continue ECG monitoring, and a medical check',
    isaretler: [
      { key: 'cardio.ecg_ectopic_per_min', dir: 'high', abs: 6 },
      { key: 'cardio.hr_bpm', dir: 'high' },
      { key: 'cardio.hrv_rmssd_ms', dir: 'low' },
    ],
    enAz: 1,
    zorunlu: 'cardio.ecg_ectopic_per_min',
  },
  {
    durum: 'Sleep deprivation and fatigue',
    aciklama: 'Insufficient sleep lengthens reaction time and increases attention lapses and negative affect.',
    kaynak: 'Barger et al. 2014; Jones et al. 2022',
    oneri: 'Rest, review the sleep schedule, hand over critical tasks',
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
    durum: 'Acute stress load (signs of anxiety)',
    aciklama: 'Skin conductance, sweat cortisol and negative affect rising together fit a stress response.',
    kaynak: 'NASA HRP behavioral health risk',
    oneri: 'A short break and a crew talk; if it persists, Flight Surgeon and psychological support review',
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
    durum: 'Eye and vision changes (SANS)',
    aciklama: 'A change in pupil response may call for monitoring of the neuro-ocular changes seen in long-duration flight.',
    kaynak: 'NASA HRP SANS risk (pupil measures are an assumption)',
    oneri: 'Schedule an eye exam and vision tests',
    isaretler: [
      { key: 'cog.pupilLatency_ms', dir: 'high' },
      { key: 'cog.pupilDiameter_mm', dir: 'high' },
    ],
    enAz: 2,
  },
  {
    durum: 'Increased radiation exposure',
    aciklama: 'A higher dose rate quickly raises the cumulative dose; long-term health risk grows with cumulative dose.',
    kaynak: 'NASA-STD-3001 (OCHMO radiation brief)',
    oneri: 'Consider storm shelter ingress and track the dose',
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
  const text = pn ? `${label} ${valueText(sign.key, value)} (personal baseline ${valueText(sign.key, pn.mean)})` : `${label} ${valueText(sign.key, value)}`;
  return { key: sign.key, value, normal: pn?.mean, z, text };
}

export interface PossibleCondition {
  durum: string;
  olasilik: 'low' | 'medium';
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
      olasilik: strong ? 'medium' : 'low',
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
  'This assessment is not definitive; it is a possibility based on changes in the measurements and does not replace a diagnosis. A medical check and Flight Surgeon review are needed.';
