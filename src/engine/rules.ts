// Parça 2 · Olay kuralları (plandaki "Olay kuralları" tablosu, kural kural).
// Başlıklar teşhis koymaz: ne görüldüğünü söyler, gerekirse "medikal kontrol önerilir" der.
// Eşiklerin kaynakları config.ts'te, eşiğin yanında.
import type { MetricKey } from '../metrics';
import type { AutoActionType, CrewId, CrewLocation, Domain, IncidentType, Level, MetricScore } from '../types';
import {
  ABSOLUTE_LIMITS,
  CARDIO_ECTOPIC_KEY,
  FATIGUE_MIN_SIGNALS,
  FATIGUE_SIGNALS,
  LEVEL_RANK,
  MULTI_DOMAINS,
  MULTI_MIN_CRITICAL_DOMAINS,
  STREAK_REQUIRED,
  STRESS_SIGNALS,
} from './config';
import { DOMAIN_LABELS, joinTr, LOCATION_LABELS, metricText, names, num } from './labels';

/** Katman 1'in bir astronot için bu ölçümdeki değerlendirmesi (kuralların girdisi). */
export interface CrewEval {
  id: CrewId;
  location: CrewLocation;
  calibrated: boolean; // kişisel baseline kuruldu mu
  scores: Record<MetricKey, MetricScore>;
  riskZ: Record<MetricKey, number>;
  domainLevels: Record<Domain, Level>;
  irregularStreak: number; // EKG "irregular" ardışık ölçüm sayısı
}

export interface RuleHit {
  level: 'caution' | 'critical';
  signals: MetricScore[];
  /** Otonom adımın şartı sağlandı mı (örn. CO₂'de sadece kritikte). */
  actionable: boolean;
  /** Grup içinde en çok etkileneni seçmek için. */
  severity: number;
}

export interface Rule {
  type: IncidentType;
  /** location: aynı yerdeki (Kokpit/Gezegen) etkilenenler tek olayda; person: kişi başına bir olay. */
  scope: 'location' | 'person';
  action?: AutoActionType;
  evaluate(c: CrewEval): RuleHit | null;
  /** Olayın bütün sinyalleri bu kişide normal mi? (RESOLVE_AFTER ölçüm sürerse olay çözülür) */
  isClear(c: CrewEval): boolean;
  title(crewIds: CrewId[], worst: RuleHit, location: CrewLocation): string;
  reason(crewIds: CrewId[], worst: RuleHit, location: CrewLocation): string;
}

const atLeast = (l: Level, min: Level) => LEVEL_RANK[l] >= LEVEL_RANK[min];
const isNormal = (s: MetricScore) => s.level === 'normal';
const rank = (s: MetricScore, c: CrewEval) => LEVEL_RANK[s.level] * 1000 + c.riskZ[s.key];
const bySeverity = (c: CrewEval) => (a: MetricScore, b: MetricScore) => rank(b, c) - rank(a, c);
const withBaseline = (s: MetricScore) => `${metricText(s.key, s.value)} (kişisel normal ${metricText(s.key, s.mean)})`;

// ---------------------------------------------------------------------------
// RADIATION — doz hızı riskZ ≥ 3 (3 ölçüm) → kritik + sığınak; toplam doz ≥ 480 / ≥ 600 mSv
// ---------------------------------------------------------------------------
const radiation: Rule = {
  type: 'RADIATION',
  scope: 'location',
  action: 'RADIATION_SHELTER',
  evaluate(c) {
    const rate = c.scores['env.doseRate_uSv_h'];
    const total = c.scores['env.doseCumulative_mSv'];
    const rateCritical = rate.level === 'critical';
    const level: Level = rateCritical ? 'critical' : total.level;
    if (level === 'normal') return null;
    const signals = [rate];
    if (total.level !== 'normal') signals.push(total);
    return { level, signals, actionable: rateCritical, severity: rateCritical ? c.riskZ[rate.key] : total.value };
  },
  isClear: (c) => isNormal(c.scores['env.doseRate_uSv_h']) && isNormal(c.scores['env.doseCumulative_mSv']),
  title(crewIds, worst, loc) {
    const rate = worst.signals[0];
    if (rate.level === 'critical')
      return `${LOCATION_LABELS[loc]} ekibi: radyasyon doz hızı kişisel normalin çok üzerinde (${metricText(rate.key, rate.value)})`;
    const total = worst.signals[worst.signals.length - 1];
    const limit = ABSOLUTE_LIMITS['env.doseCumulative_mSv']!.critical;
    return `${names(crewIds)}: toplam radyasyon dozu ${metricText(total.key, total.value)}, kariyer limiti ${num(limit)} mSv'nin %${num((total.value / limit) * 100)}'i`;
  },
  reason(_ids, worst, loc) {
    const rate = worst.signals[0];
    return `${LOCATION_LABELS[loc]} ekibi: doz hızı ${STREAK_REQUIRED} ölçümdür kritik, ${withBaseline(rate)}`;
  },
};

// ---------------------------------------------------------------------------
// CO2 — ppCO₂ > 2,3 mmHg (3 ölçüm) dikkat, > 3,0 mmHg kritik → havalandırma (sadece kritikte)
// ---------------------------------------------------------------------------
const co2: Rule = {
  type: 'CO2',
  scope: 'location',
  action: 'INCREASE_VENTILATION',
  evaluate(c) {
    const s = c.scores['env.ppCO2_mmHg'];
    if (s.level === 'normal') return null;
    // Belirti sinyalleri (solunum, EtCO₂, nabız, PVT) dikkatteyse olaya eklenir
    const symptoms = (['resp.rr_bpm', 'resp.etco2_mmHg', 'cardio.hr_bpm', 'cog.pvtMeanRt_ms'] as MetricKey[])
      .map((k) => c.scores[k])
      .filter((x) => !isNormal(x));
    return { level: s.level, signals: [s, ...symptoms], actionable: s.level === 'critical', severity: s.value };
  },
  isClear: (c) => isNormal(c.scores['env.ppCO2_mmHg']),
  title(_ids, worst, loc) {
    const where = loc === 'KOKPIT' ? 'Kokpit kabininde' : 'Gezegen ekibinin giysi içinde';
    return `${where} CO₂ yükseliyor (ppCO₂ ${metricText('env.ppCO2_mmHg', worst.signals[0].value)})`;
  },
  reason(_ids, worst, loc) {
    const lim = ABSOLUTE_LIMITS['env.ppCO2_mmHg']!.critical;
    const where = loc === 'KOKPIT' ? 'Kokpit kabini' : 'Gezegen ekibi giysileri';
    return `${where}: ppCO₂ ${STREAK_REQUIRED} ölçümdür kritik sınırın (${num(lim, 1)} mmHg) üzerinde; normali ${metricText('env.ppCO2_mmHg', worst.signals[0].mean)}`;
  },
};

// ---------------------------------------------------------------------------
// HYPOXIA — SpO₂ < 94 % dikkat, < 90 % kritik. Otonom adım yok: karar insanın.
// ---------------------------------------------------------------------------
const hypoxia: Rule = {
  type: 'HYPOXIA',
  scope: 'person',
  evaluate(c) {
    const s = c.scores['cardio.spo2_pct'];
    if (s.level === 'normal') return null;
    const extra = (['resp.rr_bpm', 'cardio.hr_bpm'] as MetricKey[]).map((k) => c.scores[k]).filter((x) => !isNormal(x));
    return { level: s.level, signals: [s, ...extra], actionable: false, severity: c.riskZ[s.key] };
  },
  isClear: (c) => isNormal(c.scores['cardio.spo2_pct']),
  title: (ids, worst) => `${names(ids)}: oksijen doygunluğu düşük (SpO₂ ${metricText('cardio.spo2_pct', worst.signals[0].value)}), medikal kontrol önerilir`,
  reason: () => '',
};

// ---------------------------------------------------------------------------
// CARDIO — EKG ritmi "irregular" (3 ölçüm) ya da düzensiz atım riskZ ≥ 3 → dikkat
// ---------------------------------------------------------------------------
const cardio: Rule = {
  type: 'CARDIO',
  scope: 'person',
  evaluate(c) {
    const ect = c.scores[CARDIO_ECTOPIC_KEY];
    const irregular = c.irregularStreak >= STREAK_REQUIRED;
    if (!irregular && ect.level !== 'critical') return null;
    return { level: 'caution', signals: [ect, c.scores['cardio.hr_bpm']], actionable: false, severity: c.riskZ[ect.key] };
  },
  isClear: (c) => c.irregularStreak === 0 && isNormal(c.scores[CARDIO_ECTOPIC_KEY]),
  title: (ids) => `${names(ids)}: EKG'de düzensiz atımlar görülüyor, medikal kontrol önerilir`,
  reason: () => '',
};

// ---------------------------------------------------------------------------
// THERMAL — çekirdek sıcaklık ≥ 38,5 °C dikkat, ≥ 39,0 °C kritik → zorunlu dinlenme
// ---------------------------------------------------------------------------
const thermal: Rule = {
  type: 'THERMAL',
  scope: 'person',
  action: 'MANDATORY_REST',
  evaluate(c) {
    const s = c.scores['resp.coreTemp_C'];
    if (s.level === 'normal') return null;
    const extra = (['cardio.hr_bpm', 'biochem.sweatLactate_mM', 'biochem.sweatSodium_mM'] as MetricKey[])
      .map((k) => c.scores[k])
      .filter((x) => !isNormal(x));
    return { level: s.level, signals: [s, ...extra], actionable: true, severity: s.value };
  },
  isClear: (c) => isNormal(c.scores['resp.coreTemp_C']),
  title: (ids, worst) => `${names(ids)}: çekirdek sıcaklık yükseliyor (${metricText('resp.coreTemp_C', worst.signals[0].value)})`,
  reason: (ids, worst) => `${names(ids)}: çekirdek sıcaklık ${withBaseline(worst.signals[0])}`,
};

// ---------------------------------------------------------------------------
// FATIGUE — uyku, PVT, PANAS olumlu, BSI-18, HRV: en az 3'ü aynı anda dikkatte → zorunlu dinlenme
// ---------------------------------------------------------------------------
const FATIGUE_WORDS: Partial<Record<MetricKey, string>> = {
  'env.sleepLastNight_h': 'uyku',
  'cog.pvtMeanRt_ms': 'tepki süresi',
  'cog.panasPositive': 'ruh hali',
  'cog.bsi18_gsi': 'sıkıntı skoru',
  'cardio.hrv_rmssd_ms': 'HRV',
};

const fatigue: Rule = {
  type: 'FATIGUE',
  scope: 'person',
  action: 'MANDATORY_REST',
  evaluate(c) {
    const all = FATIGUE_SIGNALS.map((k) => c.scores[k]);
    const hit = all.filter((s) => atLeast(s.level, 'caution'));
    if (hit.length < FATIGUE_MIN_SIGNALS) return null;
    return { level: 'caution', signals: hit.sort(bySeverity(c)), actionable: true, severity: hit.length };
  },
  isClear: (c) => FATIGUE_SIGNALS.every((k) => isNormal(c.scores[k])),
  title(ids, worst) {
    const words = FATIGUE_SIGNALS.filter((k) => worst.signals.some((s) => s.key === k)).map((k) => FATIGUE_WORDS[k]);
    return `${names(ids)}: ${words.join(' + ')} birlikte kötüleşiyor`;
  },
  reason: (ids, worst) => `${names(ids)}: ${worst.signals.length} yorgunluk sinyali aynı anda dikkat seviyesinde`,
};

// ---------------------------------------------------------------------------
// STRESS — GSR + ter kortizolü + PANAS olumsuz üçü de riskZ ≥ 2 → dikkat
// ---------------------------------------------------------------------------
const stress: Rule = {
  type: 'STRESS',
  scope: 'person',
  evaluate(c) {
    const all = STRESS_SIGNALS.map((k) => c.scores[k]);
    if (!all.every((s) => atLeast(s.level, 'caution'))) return null;
    return { level: 'caution', signals: all, actionable: false, severity: all.reduce((a, s) => a + c.riskZ[s.key], 0) };
  },
  isClear: (c) => STRESS_SIGNALS.every((k) => isNormal(c.scores[k])),
  title: (ids) => `${names(ids)}: stres belirtileri birlikte yükseliyor (GSR + ter kortizolü + olumsuz duygu)`,
  reason: () => '',
};

// ---------------------------------------------------------------------------
// MULTI — aynı kişide en az 2 vücut alanı kritik → kritik
// ---------------------------------------------------------------------------
const multi: Rule = {
  type: 'MULTI',
  scope: 'person',
  evaluate(c) {
    const crit = MULTI_DOMAINS.filter((d) => c.domainLevels[d] === 'critical');
    if (crit.length < MULTI_MIN_CRITICAL_DOMAINS) return null;
    const signals = Object.values(c.scores)
      .filter((s) => s.level === 'critical' && MULTI_DOMAINS.includes(s.key.split('.')[0] as Domain))
      .sort(bySeverity(c))
      .slice(0, 5);
    return { level: 'critical', signals, actionable: false, severity: crit.length };
  },
  isClear: (c) => MULTI_DOMAINS.every((d) => c.domainLevels[d] !== 'critical'),
  title(ids, worst) {
    const domains = [...new Set(worst.signals.map((s) => s.key.split('.')[0] as Domain))].map((d) => DOMAIN_LABELS[d]);
    return `${names(ids)}: ${joinTr(domains)} alanlarında aynı anda kritik sapma`;
  },
  reason: () => '',
};

/** Değerlendirme sırası: çevre olayları önce (kayıtta neden-sonuç sırası doğru görünsün). */
export const RULES: Rule[] = [radiation, co2, hypoxia, thermal, cardio, fatigue, stress, multi];
