// Parça 4 · Yedek mod: internet ya da model yoksa, veriden kural tabanlı İngilizce cevap üretir.
// Sabit metin yerine güncel değerlerle doldurulan şablonlar kullanılır; böylece yedek cevap da
// doğru sayılar içerir. Kurallar modelinkiyle aynı: en fazla 4 cümle, teşhis yok, ilaç yok,
// uyarı açmak yok, veride olmayan sayı yok.
import { CREW, CREW_BY_ID, CREW_IDS } from '../crew';
import { GROUP_NAMES, METRIC_BY_KEY, readMetric, type MetricKey } from '../metrics';
import { normalRangeFor, PARAMS } from '../sim/parameters';
import { useAstra, type AstraState } from '../store';
import type { AstraAnswer, AstraRequest, CrewId, CrewLocation, Incident, IncidentType, MetricScore } from '../types';
import { fmt } from '../ui/theme';
import { possibleConditions } from './conditions';
import { boneLossEstimate } from './knowledge';
import { ACTION_DONE_TR, crewInText, delayText, LEVEL_TR, shortName, valueText } from './labels';
import { baselineReady } from './memory';
import { crewComparison, dueTests, psychState } from '../psych/analysis';
import { LICENSED_NOTE, LICENSED_SIM_KEYS, type TestKind } from '../psych/instruments';
import { spLabel, tlxHighest } from '../psych/scoring';
import { resultsOf } from '../psych/store';

const DOCTOR = 'I recommend consulting the Flight Surgeon on this.';

export function fallbackAnswer(req: AstraRequest, s: AstraState = useAstra.getState()): AstraAnswer {
  let text: string;
  try {
    text = req.mode === 'incident' ? incidentText(req, s) : chatText(req.question, s);
  } catch (err) {
    // Şablon bir veri eksikliğine takılırsa yine de güvenli bir cevap ver.
    console.warn('[ASTRA] Fallback template error:', err);
    text = GENERIC[req.mode];
  }
  return { text, source: 'fallback', verified: true, latencyMs: 0 };
}

const GENERIC = {
  incident: `No link to the language model; the event was opened by Layer 1 and logged. Check the values on the event card and apply the recommended safing action. ${DOCTOR}`,
  chat: `The language model is unreachable right now; I am in offline mode. The Layer 1 alerts on screen are current and valid. ${DOCTOR}`,
};

// ---------------------------------------------------------------- yardımcılar

function param(key: string, fallback: number): number {
  return (PARAMS as Record<string, { value: number } | undefined>)[key]?.value ?? fallback;
}

/** "a", "a and b", "a, b and c" */
function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Cümle içinde etiketin ilk harfini küçültür (kısaltmalar hariç: "CO₂", "PVT"). */
function lcFirst(label: string): string {
  return label.length > 1 && label[1] === label[1].toLocaleLowerCase('en-US') ? label.charAt(0).toLocaleLowerCase('en-US') + label.slice(1) : label;
}

function label(key: MetricKey): string {
  return lcFirst(METRIC_BY_KEY[key]?.label ?? key);
}

/** "heart rate 155 bpm (personal baseline 92 bpm)" */
function signalText(sig: MetricScore): string {
  return `${label(sig.key)} ${valueText(sig.key, sig.value)} (personal baseline ${valueText(sig.key, sig.mean)})`;
}

function metricNow(s: AstraState, id: CrewId, key: MetricKey): number | undefined {
  const t = s.telemetry[id];
  return t ? readMetric(t, key) : undefined;
}

function crewAt(s: AstraState, loc: CrewLocation): CrewId[] {
  return CREW.filter((c) => c.location === loc && s.telemetry[c.id]).map((c) => c.id);
}

function avg(s: AstraState, ids: CrewId[], key: MetricKey): number | undefined {
  const values = ids.map((id) => metricNow(s, id, key)).filter((v): v is number => v !== undefined);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
}

function openIncidents(s: AstraState, filter?: (i: Incident) => boolean): Incident[] {
  return s.incidents.filter((i) => i.status !== 'resolved' && (!filter || filter(i)));
}

function actionsText(inc: Incident): string {
  return inc.autoActions.map((a) => ACTION_DONE_TR[a]).join('; ');
}

function sentences(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).slice(0, 4).join(' ');
}

// ---------------------------------------------------------------- olay açıklaması

/** Olayda sinyal yoksa canlı veriden okunacak ölçümler. */
const TYPE_KEYS: Record<IncidentType, MetricKey[]> = {
  RADIATION: ['env.doseRate_uSv_h', 'env.doseCumulative_mSv'],
  CO2: ['env.ppCO2_mmHg', 'resp.rr_bpm'],
  CARDIO: ['cardio.ecg_ectopic_per_min', 'cardio.hr_bpm'],
  HYPOXIA: ['cardio.spo2_pct', 'env.o2_pct'],
  THERMAL: ['resp.coreTemp_C', 'cardio.hr_bpm'],
  FATIGUE: ['env.sleepLastNight_h', 'cog.pvtMeanRt_ms', 'cog.panasPositive'],
  STRESS: ['resp.gsr_uS', 'biochem.sweatCortisol_ng_mL', 'cog.panasNegative'],
  MULTI: [],
};

function incidentSignals(inc: Incident, s: AstraState): string {
  if (inc.signals.length) {
    // Aynı ölçüm birden fazla kişiden geldiyse bir kez yaz.
    const seen = new Set<MetricKey>();
    const uniq = inc.signals.filter((x) => (seen.has(x.key) ? false : (seen.add(x.key), true)));
    return list(uniq.slice(0, 3).map(signalText));
  }
  const id = inc.crewIds[0];
  const parts = TYPE_KEYS[inc.type]
    .map((key) => {
      const v = id ? metricNow(s, id, key) : undefined;
      return v === undefined ? '' : `${label(key)} ${valueText(key, v)}`;
    })
    .filter(Boolean);
  return parts.length ? list(parts) : inc.title;
}

function incidentText(req: AstraRequest, s: AstraState): string {
  const id = (req.context as { olayId?: unknown } | undefined)?.olayId;
  const inc = s.incidents.find((i) => i.id === id);
  if (!inc) return GENERIC.incident;

  const who = list(inc.crewIds.map(shortName));
  const sig = incidentSignals(inc, s);
  const done = actionsText(inc);
  const step = (fallbackStep: string) => (done ? `${done}; ` : `${fallbackStep}; `);

  switch (inc.type) {
    case 'RADIATION': {
      const cumulative = inc.signals.some((x) => x.key === 'env.doseCumulative_mSv');
      return sentences(
        `${who}: ${sig}.`,
        cumulative
          ? `Long-term risk grows as the cumulative dose approaches the ${fmt(param('careerDoseLimit', 600))} mSv career limit.`
          : 'During a solar particle event the dose rate can rise within a short time.',
        `${step('Storm shelter ingress is recommended')}keep monitoring the dose rate.`,
      );
    }
    case 'CO2':
      return sentences(
        `${who}: ${sig}; warning limit ${fmt(param('co2CriticalLimit', 3.0), 1)} mmHg.`,
        'High CO₂ can cause headache and loss of attention; the CO₂ scrubber should be checked.',
        `${step('Increasing ventilation is recommended')}recheck the value after a few samples.`,
      );
    case 'FATIGUE':
      return sentences(
        `${who}: ${sig}.`,
        'Sleep loss can lengthen reaction time and lower mood.',
        `${step('Rest is recommended')}handing critical tasks to another crew member is recommended.`,
      );
    case 'THERMAL':
      return sentences(
        `${who}: ${sig}.`,
        'Heavy effort and heat build-up inside the suit can raise core temperature.',
        `${step('Reducing effort is recommended')}a cooling system check and a medical check are recommended.`,
      );
    case 'HYPOXIA':
      return sentences(
        `${who}: ${sig}.`,
        'Low oxygen saturation can quickly impair attention and performance.',
        'Checking oxygen supply and pressure plus a medical check is recommended; the crew decides.',
      );
    case 'CARDIO':
      return sentences(
        `${who}: irregular beats seen on the ECG; ${sig}.`,
        'This change can be affected by fatigue, stress or effort.',
        'Reducing effort and a medical check are recommended.',
      );
    case 'STRESS':
      return sentences(
        `${who}: ${sig}.`,
        'These signals rising together indicate a growing stress load.',
        `A short break and a crew talk are recommended; if it persists, ${DOCTOR.charAt(0).toLocaleLowerCase('en-US')}${DOCTOR.slice(1)}`,
      );
    case 'MULTI':
      return sentences(
        `${who}: warning-level deviations in more than one domain; ${sig}.`,
        'A single cause may not explain this.',
        `A medical check is recommended. ${DOCTOR}`,
      );
    default:
      return sentences(`${inc.title}.`, `${sig}.`, DOCTOR);
  }
}

// ---------------------------------------------------------------- sohbet

/** Soru kelimesi -> ölçümler. İlk eşleşen kullanılır. */
const METRIC_WORDS: [RegExp, MetricKey[]][] = [
  [/hrv|variability/, ['cardio.hrv_rmssd_ms']],
  [/heart rate|pulse|heartbeat|\bhr\b/, ['cardio.hr_bpm']],
  [/spo|saturation|oxygen/, ['cardio.spo2_pct']],
  [/blood pressure|\bbp\b/, ['cardio.bp_sys_mmHg', 'cardio.bp_dia_mmHg']],
  [/ecg|ekg|rhythm|ectopic|irregular beat/, ['cardio.ecg_ectopic_per_min']],
  [/etco|end-tidal|end tidal/, ['resp.etco2_mmHg']],
  [/respirat|breathing|breath rate/, ['resp.rr_bpm']],
  [/cabin temp|ambient temp|room temp|air temp/, ['env.ambientTemp_C']],
  [/humidity/, ['env.humidity_pct']],
  [/noise|sound level|decibel|dba/, ['env.noise_dBA']],
  [/temperature|fever/, ['resp.coreTemp_C']],
  [/cortisol|stress|gsr/, ['biochem.sweatCortisol_ng_mL', 'resp.gsr_uS']],
  [/lactate/, ['biochem.sweatLactate_mM']],
  [/sodium|electrolyte/, ['biochem.sweatSodium_mM']],
  [/sleep|slept/, ['env.sleepLastNight_h', 'env.remPct', 'env.swsPct']],
  [/pvt|reaction/, ['cog.pvtMeanRt_ms', 'cog.pvtLapses']],
  [/mood|affect|panas|morale/, ['cog.panasPositive', 'cog.panasNegative']],
  [/pupil/, ['cog.pupilDiameter_mm', 'cog.pupilLatency_ms']],
  [/cabin pressure|suit pressure|pressure/, ['env.pressure_kPa']],
];

/** Sistemde ölçülmeyen konular için kaynaklı, kesin olmayan cevap. */
function unmeasuredText(s: AstraState, has: (re: RegExp) => boolean): string | undefined {
  if (has(/bone|osteopor/)) {
    const day = s.ship?.missionDay ?? 180;
    return sentences(
      'Bone density is not measured by this system; NASA tracks it with pre- and post-flight bone scans.',
      `According to NASA, weight-bearing bones lose on average 1–1.5% density per month on 4–6 month missions; for a ${day}-day mission that is roughly ${boneLossEstimate(day)}, a general estimate rather than a personal measurement.`,
      DOCTOR,
    );
  }
  if (has(/immun/)) return sentences('The immune system is not measured by this system; assessing it requires a blood or saliva test.', DOCTOR);
  if (has(/balance|vestibular/))
    return sentences('Balance (the vestibular system) is not measured by this system; NASA tracks it with post-flight balance tests.', DOCTOR);
  if (has(/team cohesion|crew cohesion|teamwork|team dynamics/)) {
    return sentences('Crew cohesion is not measured directly; the stress and mood measures (BSI-18, PANAS) give indirect information.');
  }
  if (has(/microb|bacteri|fung|mold/)) return sentences('Cabin microbes are not measured by this system; that requires surface samples analyzed in a lab.');
  if (has(/optic disc|eye structure|eye change|\bsans\b/)) {
    return sentences(
      'Structural eye changes (SANS) are not measured directly by this system; the pupil measures are only an indirect indicator.',
      'A definitive assessment is made with an eye scan (OCT).',
      DOCTOR,
    );
  }
  return undefined;
}

function statusSentence(s: AstraState, id: CrewId, withName = true): string {
  const st = s.statuses[id];
  if (!st) return `No status has been computed for ${shortName(id)} yet.`;
  return `${withName ? `${shortName(id)}'s status is` : 'Status is'} ${LEVEL_TR[st.level]}, health score ${fmt(st.healthScore)}%.`;
}

function topSignalsSentence(s: AstraState, id: CrewId): string | undefined {
  const st = s.statuses[id];
  if (!st?.topSignals.length) return undefined;
  if (st.level === 'normal') return 'Measurements are close to the personal baseline.';
  return `Largest deviations: ${list(st.topSignals.slice(0, 3).map(signalText))}.`;
}

function mostSevere(s: AstraState): CrewId | undefined {
  const rank = { critical: 0, caution: 1, normal: 2 } as const;
  return [...CREW_IDS]
    .filter((id) => s.statuses[id])
    .sort((a, b) => rank[s.statuses[a]!.level] - rank[s.statuses[b]!.level] || s.statuses[a]!.healthScore - s.statuses[b]!.healthScore)[0];
}

function whyText(s: AstraState, id: CrewId, askedCritical: boolean): string {
  const st = s.statuses[id];
  const inc = openIncidents(s, (i) => i.crewIds.includes(id))[0];
  return sentences(
    askedCritical && st && st.level !== 'critical' && `${shortName(id)} is not at warning level right now.`,
    statusSentence(s, id),
    topSignalsSentence(s, id),
    inc && `Open event: ${inc.title}${inc.autoActions.length ? `; ${actionsText(inc).toLocaleLowerCase('en-US')}` : ''}.`,
    st && st.level !== 'normal' && !inc && 'A medical check is recommended; the crew decides.',
  );
}

/** Olası durum cevabı: önce değişen değerler, sonra "may be consistent with", sonra kesin olmadığı. */
function conditionText(s: AstraState, id: CrewId | undefined, urgent: boolean): string {
  const lifeThreat =
    urgent && 'I cannot confirm a life-threatening condition from this data; if there are symptoms, report them to the Flight Surgeon immediately.';
  if (!id) return sentences('I cannot make a definitive diagnosis.', lifeThreat, DOCTOR);
  if (!baselineReady()) {
    return sentences(
      'I cannot make a definitive diagnosis.',
      'Personal baselines are still being learned; after the first 30 samples I can give a more meaningful assessment.',
      lifeThreat,
      DOCTOR,
    );
  }
  const found = possibleConditions(s, id);
  if (!found.length) {
    return sentences(
      'I cannot make a definitive diagnosis.',
      `${shortName(id)}'s measurements show no clear deviation from the personal baseline.`,
      lifeThreat,
      DOCTOR,
    );
  }
  const name = (d: string) => lcFirst(d);
  const [top, second] = found;
  return sentences(
    `I cannot make a definitive diagnosis; however, ${shortName(id)}'s readings show ${list(top.dayanak.slice(0, 3).map(lcFirst))}.`,
    `These changes may be consistent with ${name(top.durum)}${second ? `; ${name(second.durum)} is also possible` : ''}.`,
    lifeThreat,
    `This is a possibility, not a certainty; recommended: ${top.oneri.charAt(0).toLocaleLowerCase('en-US')}${top.oneri.slice(1)}, and a medical check.`,
  );
}

function restText(s: AstraState): string {
  const cog = (id: CrewId) => s.statuses[id]?.domainScores.cog ?? 100;
  const pvt = (id: CrewId) => metricNow(s, id, 'cog.pvtMeanRt_ms') ?? 0;
  const rest = CREW_IDS.filter((id) => s.statuses[id]?.restRequired);
  const lowest = CREW_IDS.filter((id) => s.statuses[id] && !rest.includes(id))
    .sort((a, b) => cog(a) - cog(b) || pvt(b) - pvt(a))
    .slice(0, 2);
  const detail = (id: CrewId) =>
    `${shortName(id)} (cognitive score ${fmt(cog(id))}%, sleep ${valueText('env.sleepLastNight_h', metricNow(s, id, 'env.sleepLastNight_h') ?? 0)}, PVT ${valueText('cog.pvtMeanRt_ms', pvt(id))})`;
  return sentences(
    rest.length ? `Layer 1 ordered mandatory crew rest for ${list(rest.map(detail))}.` : 'Nobody is on mandatory crew rest right now.',
    lowest.length > 0 && `${rest.length ? 'Also, the lowest' : 'The lowest'} cognitive scores: ${list(lowest.map(detail))}.`,
    'The crew decides on rest.',
  );
}

// ---------------------------------------------------------------- psikolojik testler

const TEST_NAME: Record<TestKind, string> = { SP: 'fatigue (Samn-Perelli)', TLX: 'workload (NASA-TLX)', PVT: 'PVT-B reaction test' };

function dueSentence(id: CrewId, s: AstraState): string | undefined {
  const due = dueTests(id, s);
  if (!due.length) return undefined;
  const first = due[0];
  return `Recommended for ${shortName(id)}: ${list(due.map((d) => TEST_NAME[d.kind]))}${first.oncelik === 'öncelikli' ? `; priority reason: ${lcFirst(first.neden.split('. ')[0].replace(/\.$/, ''))}` : ''}.`;
}

function resultsSentence(id: CrewId): string | undefined {
  const sp = resultsOf(id, 'SP')[0];
  const tlx = resultsOf(id, 'TLX')[0];
  const pvt = resultsOf(id, 'PVT')[0];
  const parts = [
    sp && `fatigue ${sp.puan}/7 (${lcFirst(spLabel(sp.puan))})`,
    tlx && `workload ${fmt(tlx.raw, 1)}/100 (highest subscale: ${lcFirst(tlxHighest(tlx.ratings).ad)})`,
    pvt && `PVT-B mean ${pvt.meanRt_ms} ms with ${pvt.lapses} lapses`,
  ].filter((p): p is string => !!p);
  return parts.length ? `${shortName(id)}'s latest tests: ${list(parts)}.` : undefined;
}

function testText(s: AstraState, crew: CrewId[], has: (re: RegExp) => boolean): string {
  // Karşılaştırma
  if (has(/most tired|compare|comparison|crew|who is more|rank/) && !crew.length) {
    const c = crewComparison(CREW_IDS);
    if (!c.yorgunluk.length && !c.isYuku.length && !c.tepki.length)
      return 'Nobody has taken a test in the last 4 mission days; tests are needed before a comparison. Tests are run from the Tests window of the selected astronaut.';
    return sentences(
      c.yorgunluk.length > 0 && `Highest fatigue: ${shortName(c.yorgunluk[0].id)} (${c.yorgunluk[0].puan}/7).`,
      c.isYuku.length > 0 && `Highest workload: ${shortName(c.isYuku[0].id)} (${fmt(c.isYuku[0].puan, 1)}/100).`,
      c.tepki.length > 0 && `Slowest PVT-B: ${shortName(c.tepki[0].id)} (mean ${c.tepki[0].ortalama_ms} ms).`,
      c.testYapmayanlar.length > 0 && `Not tested: ${list(c.testYapmayanlar.map(shortName))}.`,
    );
  }
  // Plan: kim, hangi testi yapmalı
  if (has(/who|which|should|due|pending|schedule|plan|recommend/) && !crew.length) {
    const due = CREW_IDS.map((id) => ({ id, d: dueTests(id, s) })).filter((x) => x.d.length);
    const urgent = due.filter((x) => x.d.some((d) => d.oncelik === 'öncelikli'));
    if (!due.length) return 'No tests are pending; all crew tests are current. Tests are run from the Tests window of the selected astronaut.';
    return sentences(
      urgent.length ? `Priority tests recommended for: ${list(urgent.map((x) => shortName(x.id)))}.` : 'No priority test recommendations.',
      ...urgent.slice(0, 2).map((x) => dueSentence(x.id, s)),
      'The routine plan is each test once every 4 mission days (ISS Reaction Self Test frequency); tests are run from the Tests window.',
    );
  }
  // Bir kişi ya da genel durum
  const ids = crew.length ? crew.slice(0, 1) : CREW_IDS.filter((id) => resultsSentence(id));
  if (!ids.length) {
    return sentences(
      'Nobody has taken a psychological test yet.',
      'Available tests are NASA-TLX (workload), Samn-Perelli (fatigue) and PVT-B (3-minute reaction test); they are run from the Tests window.',
      'Self-report tests are not a diagnosis.',
    );
  }
  const id = ids[0];
  const ps = psychState(id, s);
  return sentences(
    resultsSentence(id) ?? `No test results for ${shortName(id)} yet.`,
    ps.ozet,
    dueSentence(id, s),
    crew.length
      ? 'Self-report tests are not a diagnosis; consult the Flight Surgeon if needed.'
      : ids.length > 1 && `Others who took tests: ${list(ids.slice(1).map(shortName))}.`,
  );
}

function radiationText(s: AstraState, crew: CrewId[]): string {
  const limit = param('careerDoseLimit', 600);
  const inc = openIncidents(s, (i) => i.type === 'RADIATION')[0];
  const incSentence = inc
    ? `There is an open radiation event; ${inc.autoActions.includes('RADIATION_SHELTER') ? 'storm shelter ingress was started automatically' : 'storm shelter ingress is recommended'}.`
    : 'No open radiation event; values are being monitored.';
  const pct = (cum: number) => Math.round((cum / limit) * 100);

  if (crew.length) {
    const id = crew[0];
    const rate = metricNow(s, id, 'env.doseRate_uSv_h') ?? 0;
    const cum = metricNow(s, id, 'env.doseCumulative_mSv') ?? 0;
    return sentences(
      `${shortName(id)}'s radiation dose rate is ${valueText('env.doseRate_uSv_h', rate)}, cumulative dose ${valueText('env.doseCumulative_mSv', cum)}.`,
      `The career limit is ${fmt(limit)} mSv; this is ${pct(cum)}% of the limit.`,
      incSentence,
    );
  }
  const kok = avg(s, crewAt(s, 'KOKPIT'), 'env.doseRate_uSv_h');
  const gez = avg(s, crewAt(s, 'GEZEGEN'), 'env.doseRate_uSv_h');
  const top = [...CREW_IDS]
    .filter((id) => s.telemetry[id])
    .sort((a, b) => (metricNow(s, b, 'env.doseCumulative_mSv') ?? 0) - (metricNow(s, a, 'env.doseCumulative_mSv') ?? 0))[0];
  const cum = top ? (metricNow(s, top, 'env.doseCumulative_mSv') ?? 0) : 0;
  return sentences(
    `Mean radiation dose rate is ${valueText('env.doseRate_uSv_h', kok ?? 0)} for the orbit crew and ${valueText('env.doseRate_uSv_h', gez ?? 0)} for the surface crew.`,
    top &&
      `Highest cumulative dose: ${shortName(top)}, ${valueText('env.doseCumulative_mSv', cum)}; the career limit is ${fmt(limit)} mSv, so ${pct(cum)}% of the limit.`,
    incSentence,
  );
}

function co2Text(s: AstraState): string {
  const kokIds = crewAt(s, 'KOKPIT');
  const v = Math.max(...kokIds.map((id) => metricNow(s, id, 'env.ppCO2_mmHg') ?? 0), 0);
  const caution = param('co2CautionLimit', 2.3);
  const critical = param('co2CriticalLimit', 3.0);
  const inc = openIncidents(s, (i) => i.type === 'CO2')[0];
  const ventilated = inc?.autoActions.includes('INCREASE_VENTILATION');
  const sensitive = CREW.find((c) => /CO₂|CO2/.test(c.sensitivity));
  const gez = avg(s, crewAt(s, 'GEZEGEN'), 'env.ppCO2_mmHg');
  return sentences(
    `Vehicle cabin CO₂ partial pressure is ${valueText('env.ppCO2_mmHg', v)}; caution limit ${fmt(caution, 1)}, warning limit ${fmt(critical, 1)} mmHg.`,
    v <= caution
      ? 'The value is in the safe range.'
      : v <= critical
        ? 'The value is above the caution limit; the CO₂ scrubber and ventilation should be checked.'
        : ventilated
          ? 'The value is above the warning limit; ventilation was increased automatically and the value should fall within a few samples.'
          : 'The value is above the warning limit; increasing ventilation is recommended.',
    v > caution && sensitive && `${shortName(sensitive.id)} is sensitive to high CO₂; their breathing should be watched closely.`,
    gez !== undefined && `The surface crew's in-suit value averages ${valueText('env.ppCO2_mmHg', gez)}.`,
  );
}

function delayAnswer(s: AstraState): string {
  const d = s.ship?.commDelayOneWay_s;
  if (d === undefined) return 'No vehicle data yet; ask again in a few seconds.';
  return sentences(
    `One-way light time to Earth is ${delayText(d)}; a message and its reply take about ${fmt((d * 2) / 60)} minutes round trip.`,
    'Meanwhile Layer 1 and the crew take urgent actions; ASTRA explains the data.',
  );
}

function metricText(s: AstraState, crew: CrewId[], keys: MetricKey[]): string {
  if (crew.length) {
    const id = crew[0];
    const parts = keys.map((k) => `${label(k)} ${valueText(k, metricNow(s, id, k) ?? NaN)}`);
    return sentences(
      `For ${shortName(id)}: ${list(parts)}.`,
      keys.some((k) => LICENSED_SIM_KEYS.includes(k)) && LICENSED_NOTE,
      rangeSentence(s, [id], keys[0]),
      statusSentence(s, id, false),
    );
  }
  const key = keys[0];
  const ids = CREW_IDS.filter((id) => s.telemetry[id]);
  const parts = ids.map((id) => `${shortName(id)} ${valueText(key, metricNow(s, id, key) ?? NaN)}`);
  return sentences(`${METRIC_BY_KEY[key].label}: ${list(parts)}.`, LICENSED_SIM_KEYS.includes(key) && LICENSED_NOTE, rangeSentence(s, ids, key));
}

/** Resmi normal aralığı olan ölçümde: herkes aralıktaysa bunu, değilse aralık dışındakileri söyler. */
function rangeSentence(s: AstraState, ids: CrewId[], key: MetricKey): string | undefined {
  const withRange = ids.filter((id) => normalRangeFor(key, CREW_BY_ID[id].location));
  if (!withRange.length) return undefined;
  const outside = withRange.filter((id) => {
    const r = normalRangeFor(key, CREW_BY_ID[id].location)!;
    const v = metricNow(s, id, key);
    return v !== undefined && (v < r[0] || v > r[1]);
  });
  const r = normalRangeFor(key, CREW_BY_ID[withRange[0]].location)!;
  const rangeText = r[0] === 0 ? `at most ${valueText(key, r[1])}` : `${fmt(r[0], Number.isInteger(r[0]) ? 0 : 1)}–${valueText(key, r[1])}`;
  if (!outside.length) {
    const who = withRange.length === 1 ? 'The value is' : 'All values are';
    return `${who} within the reference range (${rangeText}); no alert is needed in this range.`;
  }
  return `${list(outside.map(shortName))} outside the reference range (${rangeText}); deviation from the personal baseline is being monitored.`;
}

function summaryText(s: AstraState): string {
  const counts = { normal: 0, caution: 0, critical: 0 };
  for (const id of CREW_IDS) if (s.statuses[id]) counts[s.statuses[id]!.level]++;
  const parts = (['critical', 'caution', 'normal'] as const).filter((l) => counts[l]).map((l) => `${counts[l]} ${LEVEL_TR[l]}`);
  const open = openIncidents(s);
  const worst = mostSevere(s);
  return sentences(
    `Overall status: ${list(parts)}.`,
    open.length ? `Open events: ${list(open.slice(0, 2).map((i) => i.title))}.` : 'No open events.',
    worst && `Lowest health score: ${shortName(worst)}, ${fmt(s.statuses[worst]!.healthScore)}%.`,
    'I am in offline mode; ask with an astronaut name or a measurement and I will answer directly from the data.',
  );
}

function chatText(question: string, s: AstraState): string {
  const q = question.toLocaleLowerCase('en-US');
  const crew = crewInText(question);
  const has = (re: RegExp) => re.test(q);

  if (Object.keys(s.telemetry).length === 0) return 'No telemetry yet; ask again in a few seconds.';

  // 0) Selamlama, teşekkür, "kimsin"
  if (has(/^(hello|hi|hey|good morning|good evening|good night|good afternoon|thank|thanks|who are you|how are you)\b/) && q.length < 40) {
    if (has(/^(thank|thanks)/)) return 'You are welcome. I am glad to help with any other question.';
    return 'Hello, I am ASTRA, the health decision-support assistant for the ARES-1 crew. I can answer questions about the crew\'s health and environment data; for example, ask "Who should rest today?"';
  }
  // 1) Rol dışı istekler
  if (has(/instruction|ignore previous|forget|poem|story|song|fairy tale|joke|write code|role ?play|out of your role/)) {
    return 'I am ASTRA; I only help with the ARES-1 crew\'s health and environment data. For example, ask "Who should rest today?" or "What is the radiation status?"';
  }
  // 2) Komut: uyarı açma, sistem kapatma
  if (has(/\b(open|create|raise|trigger|start)\s+(an?\s+|the\s+)?(alert|alarm|event|warning)|turn off|shut ?down|switch off|disable|silence|mute/)) {
    const co2 = Math.max(...crewAt(s, 'KOKPIT').map((id) => metricNow(s, id, 'env.ppCO2_mmHg') ?? 0), 0);
    return sentences(
      'I cannot open alerts, and I cannot operate or shut down vehicle systems.',
      'Layer 1 opens alerts; the crew makes system decisions such as ventilation.',
      has(/ventilat|co2|co₂/) && `For information: vehicle cabin ppCO₂ is ${valueText('env.ppCO2_mmHg', co2)} right now.`,
    );
  }
  // 3) İlaç ve doz
  if (
    has(
      /medication|medicine|\bdrugs?\b|tablet|pill|capsule|\bdose\b|dosage|painkiller|pain reliever|antibiotic|ibuprofen|paracetamol|acetaminophen|aspirin|\bmg\b/,
    )
  ) {
    return sentences(
      'I cannot recommend medication or doses; that decision belongs to the Flight Surgeon.',
      crew[0] && statusSentence(s, crew[0]),
      crew[0] && topSignalsSentence(s, crew[0]),
      DOCTOR,
    );
  }
  // 4) Hastalık, teşhis, "ne olabilir?": veriye dayalı olası durum, ihtimal diliyle
  if (has(/heart attack|cardiac arrest|diagnos|disease|illness|\bsick\b|infarct|stroke|seizure|what could|what might|what is wrong|what's wrong|condition/)) {
    return conditionText(s, crew[0] ?? mostSevere(s), has(/heart attack|cardiac arrest|infarct|stroke|seizure/));
  }
  // 5) Kim dinlenmeli
  if (has(/\brest\b|resting|sleep shift|day off/)) return restText(s);
  // 5b) Psikolojik testler (Samn-Perelli, NASA-TLX, PVT-B): sonuçlar, plan, karşılaştırma
  if (has(/\btests?\b|tlx|samn|perelli|workload|psycholog|questionnaire|survey/)) return testText(s, crew, has);
  // 6) Neden kritik / neden dikkat
  if (has(/\bwhy\b|reason|cause/) && (crew.length || has(/warning|critical|caution/))) {
    const id = crew[0] ?? mostSevere(s);
    if (id) return whyText(s, id, has(/warning|critical/));
  }
  // 7) Konular
  if (has(/radiation|\bdose|sievert|msv|solar storm|solar particle|\bspe\b|flare/)) return radiationText(s, crew);
  if (has(/co2|co₂|carbon dioxide|ventilat|air quality|scrubber|cdra/)) return co2Text(s);
  if (has(/delay|earth|communication|light time|owlt|message|ground|houston/)) return delayAnswer(s);
  // 8) Belirli bir ölçüm
  const match = METRIC_WORDS.find(([re]) => re.test(q));
  if (match) return metricText(s, crew, match[1]);
  // 8b) Sistemde ölçülmeyen konular: uydurmadan söyle, varsa NASA'nın genel bilgisini ver
  const unmeasured = unmeasuredText(s, has);
  if (unmeasured) return unmeasured;
  // 9) Bir kişinin durumu
  if (crew.length && has(/how|status|ok\b|okay|doing|warning|critical|caution|score/)) return whyText(s, crew[0], false);
  // 10) Sadece bir ad ("What about Kerem?"): o kişinin durumu
  const FILLER = new Set(['and', 'what', 'about', 'how', 'now', 'then', 'so', 'ok', 'okay', 'is', 'the']);
  const rest = q
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w) && !crew.some((id) => w.startsWith(id)));
  if (crew.length && rest.length === 0) return whyText(s, crew[0], false);
  // 11) Kişi adı geçiyor ama ölçüm tanınmadı: uydurma
  if (crew.length) {
    return sentences(
      'That measurement is not in the data; I will not guess.',
      `Measurements monitored for ${shortName(crew[0])} fall into five data groups: ${Object.values(GROUP_NAMES)
        .map((g) => g.toLocaleLowerCase('en-US'))
        .join('; ')}.`,
      DOCTOR,
    );
  }
  // 12) Genel özet
  return summaryText(s);
}
