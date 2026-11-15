// Part 4 · Offline mode: with no internet or model, produces a rule-based English answer from the data.
// Instead of fixed text it uses templates filled with current values, so the offline answer also
// contains correct numbers. Same rules as the model: at most 4 sentences, no diagnosis, no medication,
// no raising alerts, no numbers that are not in the data.
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

const DOCTOR = 'I recommend consulting the flight surgeon on this.';

export function fallbackAnswer(req: AstraRequest, s: AstraState = useAstra.getState()): AstraAnswer {
  let text: string;
  try {
    text = req.mode === 'incident' ? incidentText(req, s) : chatText(req.question, s);
  } catch (err) {
    // If a template trips over missing data, still give a safe answer.
    console.warn('[ASTRA] Fallback template error:', err);
    text = GENERIC[req.mode];
  }
  return { text, source: 'fallback', verified: true, latencyMs: 0 };
}

const GENERIC = {
  incident: `No connection; Layer 1 raised and logged this incident. Check the values on the incident card and apply the recommended safe action. ${DOCTOR}`,
  chat: `The language model is unreachable right now; I am in offline mode. The Layer 1 alerts on screen are current and valid. ${DOCTOR}`,
};

// ---------------------------------------------------------------- helpers

function param(key: string, fallback: number): number {
  return (PARAMS as Record<string, { value: number } | undefined>)[key]?.value ?? fallback;
}

/** "a", "a and b", "a, b and c" */
function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Lower-cases the first letter of a label inside a sentence (except abbreviations: "CO₂", "PVT"). */
function lcFirst(label: string): string {
  return label.length > 1 && label[1] === label[1].toLowerCase()
    ? label.charAt(0).toLowerCase() + label.slice(1)
    : label;
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

// ---------------------------------------------------------------- incident explanation

/** Metrics read from live data if the incident has no signals. */
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
    // If the same metric came from more than one person, write it once.
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
          ? `Long-term risk grows as cumulative dose approaches the ${fmt(param('careerDoseLimit', 600))} mSv career limit.`
          : 'During a solar particle event the dose rate can rise quickly.',
        `${step('Moving to the storm shelter is recommended')}keep monitoring the dose rate.`,
      );
    }
    case 'CO2':
      return sentences(
        `${who}: ${sig}; warning limit ${fmt(param('co2CriticalLimit', 3.0), 1)} mmHg.`,
        'High CO₂ can cause headache and loss of concentration; the CO₂ scrubber should be checked.',
        `${step('Increasing ventilation is recommended')}re-check the value after a few readings.`,
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
        'Heavy exertion and heat build-up inside the suit can raise core temperature.',
        `${step('Reducing exertion is recommended')}checking the cooling system and a medical check are recommended.`,
      );
    case 'HYPOXIA':
      return sentences(
        `${who}: ${sig}.`,
        'Low oxygen saturation can quickly impair attention and performance.',
        'Checking oxygen supply and pressure plus a medical check are recommended; the crew decides.',
      );
    case 'CARDIO':
      return sentences(
        `${who}: irregular beats on the ECG; ${sig}.`,
        'This change can be influenced by fatigue, stress or exertion.',
        'Reducing exertion and a medical check are recommended.',
      );
    case 'STRESS':
      return sentences(
        `${who}: ${sig}.`,
        'These signals rising together indicate an increased stress load.',
        `A short break and a team check-in are recommended; if it persists, ${DOCTOR.charAt(0).toLowerCase()}${DOCTOR.slice(1)}`,
      );
    case 'MULTI':
      return sentences(
        `${who}: warning-level deviation in more than one domain; ${sig}.`,
        'The situation may not have a single cause.',
        `A medical check is recommended. ${DOCTOR}`,
      );
    default:
      return sentences(`${inc.title}.`, `${sig}.`, DOCTOR);
  }
}

// ---------------------------------------------------------------- chat

/** Question word -> metrics. The first match is used. */
const METRIC_WORDS: [RegExp, MetricKey[]][] = [
  [/hrv|variabilit|değişkenli/, ['cardio.hrv_rmssd_ms']],
  [/heart rate|pulse|heartbeat|nabz|nabız|kalp atış|kalp hız/, ['cardio.hr_bpm']],
  [/spo|saturation|oxygen|doygun|satürasyon|oksijen/, ['cardio.spo2_pct']],
  [/blood pressure|tansiyon|kan basın/, ['cardio.bp_sys_mmHg', 'cardio.bp_dia_mmHg']],
  [/ecg|ekg|rhythm|ectopic|ritim|ritm|düzensiz atım/, ['cardio.ecg_ectopic_per_min']],
  [/etco|end-tidal|soluk sonu/, ['resp.etco2_mmHg']],
  [/breath|respirat|solunum|nefes/, ['resp.rr_bpm']],
  [/cabin temp|ambient temp|room temp|kabin sıcaklı|ortam sıcaklı|oda sıcaklı|hava sıcaklı/, ['env.ambientTemp_C']],
  [/humidity|bağıl nem|nem oran|rutubet|ortam nem|kabin nem/, ['env.humidity_pct']],
  [/noise|sound level|decibel|gürültü|ses düzey|ses seviye|desibel|dba/, ['env.noise_dBA']],
  [/temperature|fever|sıcaklı|ateş/, ['resp.coreTemp_C']],
  [/cortisol|stress|gsr|kortizol|stres/, ['biochem.sweatCortisol_ng_mL', 'resp.gsr_uS']],
  [/lactate|laktat/, ['biochem.sweatLactate_mM']],
  [/sodium|electrolyte|sodyum|elektrolit/, ['biochem.sweatSodium_mM']],
  [/sleep|uyku|uyu(?!m)/, ['env.sleepLastNight_h', 'env.remPct', 'env.swsPct']],
  [/pvt|reaction|tepki|reaksiyon/, ['cog.pvtMeanRt_ms', 'cog.pvtLapses']],
  [/mood|affect|panas|morale|ruh hal|ruh hâl|duygu|moral/, ['cog.panasPositive', 'cog.panasNegative']],
  [/pupil|göz bebe/, ['cog.pupilDiameter_mm', 'cog.pupilLatency_ms']],
  [/cabin pressure|suit pressure|kabin basın|giysi basın/, ['env.pressure_kPa']],
];

/** Sourced, non-definitive answer for topics the system does not measure. */
function unmeasuredText(s: AstraState, has: (re: RegExp) => boolean): string | undefined {
  if (has(/bone|osteopor|kemik/)) {
    const day = s.ship?.missionDay ?? 180;
    return sentences(
      'Bone density is not measured by this system; NASA tracks it with pre- and post-flight bone scans.',
      `According to NASA, weight-bearing bones lose on average 1–1.5% density per month on 4–6 month missions; for ${day} mission days that is roughly ${boneLossEstimate(day)}, a general estimate rather than a personal measurement.`,
      DOCTOR,
    );
  }
  if (has(/immun|bağışıklı|bagisikli|immün/)) return sentences('The immune system is not measured by this system; assessing it requires blood or saliva tests.', DOCTOR);
  if (has(/balance|vestibul|denge|vestibül/)) return sentences('Balance (the vestibular system) is not measured by this system; NASA tracks it with post-flight balance tests.', DOCTOR);
  if (has(/team cohesion|crew cohesion|teamwork|ekip uyum|takım uyum|ekip içi|takım çalışma/)) {
    return sentences('Team cohesion is not measured directly by this system; stress and mood measures (BSI-18, PANAS) give indirect information.');
  }
  if (has(/microb|bacteri|fung|mikrop|bakteri|mantar/)) return sentences('Cabin microbes are not measured by this system; that requires surface sampling and lab analysis.');
  if (has(/optic disc|eye change|eye structure|vision change|optik disk|göz yapı|göz değişim|sans(?![a-zçğıöşü])/)) {
    return sentences(
      'Changes in eye structure (SANS) are not measured directly by this system; pupil measures are only an indirect indicator.',
      'A definitive assessment requires eye imaging (OCT).',
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
  if (st.level === 'normal') return 'Readings are close to personal baseline.';
  return `Most deviating readings: ${list(st.topSignals.slice(0, 3).map(signalText))}.`;
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
    askedCritical && st && st.level !== 'critical' && `${shortName(id)} is not at Warning level right now.`,
    statusSentence(s, id),
    topSignalsSentence(s, id),
    inc && `Open incident: ${inc.title}${inc.autoActions.length ? `; ${actionsText(inc).toLowerCase()}` : ''}.`,
    st && st.level !== 'normal' && !inc && 'A medical check is recommended; the crew decides.',
  );
}

/** Possible-condition answer: first the changed values, then "... may be consistent with", then that it is not definitive. */
function conditionText(s: AstraState, id: CrewId | undefined, urgent: boolean): string {
  const lifeThreat = urgent && 'I cannot confirm a life-threatening condition from this data; if there are symptoms, report them to the flight surgeon immediately.';
  if (!id) return sentences('I cannot give a definitive diagnosis.', lifeThreat, DOCTOR);
  if (!baselineReady()) {
    return sentences(
      'I cannot give a definitive diagnosis.',
      'Personal baselines are still being learned; after the first 30 readings I can give a more meaningful assessment.',
      lifeThreat,
      DOCTOR,
    );
  }
  const found = possibleConditions(s, id);
  if (!found.length) {
    return sentences(
      'I cannot give a definitive diagnosis.',
      `${shortName(id)}'s readings show no clear deviation from personal baseline.`,
      lifeThreat,
      DOCTOR,
    );
  }
  const name = (d: string) => lcFirst(d.replace(/^(Possible|Suspected) /, ''));
  const [top, second] = found;
  return sentences(
    `I cannot give a definitive diagnosis; however, for ${shortName(id)} the readings are ${list(top.dayanak.slice(0, 3).map(lcFirst))}.`,
    `These changes may be consistent with ${name(top.durum)}${second ? `; ${name(second.durum)} is also possible` : ''}.`,
    lifeThreat,
    `This is a possibility, not a certainty; recommended: ${top.oneri.charAt(0).toLowerCase()}${top.oneri.slice(1)}, and a medical check.`,
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
    rest.length
      ? `Layer 1 has applied mandatory crew rest: ${list(rest.map(detail))}.`
      : 'Nobody is on mandatory crew rest right now.',
    lowest.length > 0 && `${rest.length ? 'Also, lowest' : 'Lowest'} cognitive scores: ${list(lowest.map(detail))}.`,
    'The crew decides on rest.',
  );
}

// ---------------------------------------------------------------- psychological tests

const TEST_NAME: Record<TestKind, string> = { SP: 'fatigue (Samn-Perelli)', TLX: 'workload (NASA-TLX)', PVT: 'PVT-B reaction test' };

function dueSentence(id: CrewId, s: AstraState): string | undefined {
  const due = dueTests(id, s);
  if (!due.length) return undefined;
  const first = due[0];
  return `Recommended for ${shortName(id)}: ${list(due.map((d) => TEST_NAME[d.kind]))}${first.oncelik === 'öncelikli' ? `; priority because: ${lcFirst(first.neden.split('. ')[0].replace(/\.$/, ''))}` : ''}.`;
}

function resultsSentence(id: CrewId): string | undefined {
  const sp = resultsOf(id, 'SP')[0];
  const tlx = resultsOf(id, 'TLX')[0];
  const pvt = resultsOf(id, 'PVT')[0];
  const parts = [
    sp && `fatigue ${sp.puan}/7 (${lcFirst(spLabel(sp.puan))})`,
    tlx && `workload ${fmt(tlx.raw, 1)}/100 (highest subscale: ${lcFirst(tlxHighest(tlx.ratings).ad)})`,
    pvt && `PVT-B mean ${pvt.meanRt_ms} ms and ${pvt.lapses} lapses`,
  ].filter((p): p is string => !!p);
  return parts.length ? `${shortName(id)} latest tests: ${list(parts)}.` : undefined;
}

function testText(s: AstraState, crew: CrewId[], has: (re: RegExp) => boolean): string {
  // Comparison
  if (has(/most tired|compare|comparison|rank|who is more|crew|team|en yorgun|karşılaştır|kıyasla|ekip|kim daha|sırala/) && !crew.length) {
    const c = crewComparison(CREW_IDS);
    if (!c.yorgunluk.length && !c.isYuku.length && !c.tepki.length) return 'Nobody has taken a test in the last 4 mission days; tests are needed before comparing. Tests are taken from the Tests tab on the Astronaut View.';
    return sentences(
      c.yorgunluk.length > 0 && `Highest fatigue: ${shortName(c.yorgunluk[0].id)} (${c.yorgunluk[0].puan}/7).`,
      c.isYuku.length > 0 && `Highest workload: ${shortName(c.isYuku[0].id)} (${fmt(c.isYuku[0].puan, 1)}/100).`,
      c.tepki.length > 0 && `Slowest PVT-B: ${shortName(c.tepki[0].id)} (mean ${c.tepki[0].ortalama_ms} ms).`,
      c.testYapmayanlar.length > 0 && `Not tested: ${list(c.testYapmayanlar.map(shortName))}.`,
    );
  }
  // Plan: who should take which test
  if (has(/who|which|should|when|pending|schedule|plan|recommend|kim|hangi|yapmalı|zamanı|bekleyen|öneri/) && !crew.length) {
    const due = CREW_IDS.map((id) => ({ id, d: dueTests(id, s) })).filter((x) => x.d.length);
    const urgent = due.filter((x) => x.d.some((d) => d.oncelik === 'öncelikli'));
    if (!due.length) return 'No tests are pending; all crew tests are up to date. Tests are taken from the Tests tab on the Astronaut View.';
    return sentences(
      urgent.length ? `Priority tests recommended for: ${list(urgent.map((x) => shortName(x.id)))}.` : 'No priority test recommendations.',
      ...urgent.slice(0, 2).map((x) => dueSentence(x.id, s)),
      'The routine plan is each test every 4 mission days (ISS Reaction Self Test frequency); tests are taken from the Tests tab on the Astronaut View.',
    );
  }
  // One person or the overall status
  const ids = crew.length ? crew.slice(0, 1) : CREW_IDS.filter((id) => resultsSentence(id));
  if (!ids.length) {
    return sentences(
      'Nobody has taken a psychological test yet.',
      'Available tests are NASA-TLX (workload), Samn-Perelli (fatigue) and PVT-B (a 3-minute reaction test); they are taken from the Tests tab on the Astronaut View.',
      'Self-report tests are not a diagnosis.',
    );
  }
  const id = ids[0];
  const ps = psychState(id, s);
  return sentences(
    resultsSentence(id) ?? `No test results for ${shortName(id)} yet.`,
    ps.ozet,
    dueSentence(id, s),
    crew.length ? 'Self-report tests are not a diagnosis; consult the flight surgeon if needed.' : ids.length > 1 && `Others who took tests: ${list(ids.slice(1).map(shortName))}.`,
  );
}

function radiationText(s: AstraState, crew: CrewId[]): string {
  const limit = param('careerDoseLimit', 600);
  const inc = openIncidents(s, (i) => i.type === 'RADIATION')[0];
  const incSentence = inc
    ? `There is an open radiation incident; ${inc.autoActions.includes('RADIATION_SHELTER') ? 'storm shelter ingress started automatically' : 'moving to the storm shelter is recommended'}.`
    : 'No open radiation incident; values are being monitored.';
  const pct = (cum: number) => Math.round((cum / limit) * 100);

  if (crew.length) {
    const id = crew[0];
    const rate = metricNow(s, id, 'env.doseRate_uSv_h') ?? 0;
    const cum = metricNow(s, id, 'env.doseCumulative_mSv') ?? 0;
    return sentences(
      `${shortName(id)}'s radiation dose rate is ${valueText('env.doseRate_uSv_h', rate)} and cumulative dose ${valueText('env.doseCumulative_mSv', cum)}.`,
      `The career limit is ${fmt(limit)} mSv; this is ${pct(cum)}% of it.`,
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
    `Average radiation dose rate is ${valueText('env.doseRate_uSv_h', kok ?? 0)} for the orbit crew and ${valueText('env.doseRate_uSv_h', gez ?? 0)} for the surface crew.`,
    top && `Highest cumulative dose: ${shortName(top)}, ${valueText('env.doseCumulative_mSv', cum)}; that is ${pct(cum)}% of the ${fmt(limit)} mSv career limit.`,
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
    `Spacecraft cabin CO₂ partial pressure is ${valueText('env.ppCO2_mmHg', v)}; caution limit ${fmt(caution, 1)}, warning limit ${fmt(critical, 1)} mmHg.`,
    v <= caution
      ? 'The value is in the safe range.'
      : v <= critical
        ? 'The value is above the caution limit; the CO₂ scrubber and ventilation should be checked.'
        : ventilated
          ? 'The value is above the warning limit; ventilation was increased automatically and the value should fall within a few readings.'
          : 'The value is above the warning limit; increasing ventilation is recommended.',
    v > caution && sensitive && `${shortName(sensitive.id)} is sensitive to high CO₂; his breathing should be watched closely.`,
    gez !== undefined && `The surface crew's in-suit average is ${valueText('env.ppCO2_mmHg', gez)}.`,
  );
}

function delayAnswer(s: AstraState): string {
  const d = s.ship?.commDelayOneWay_s;
  if (d === undefined) return 'Vehicle data has not arrived yet; please ask again in a few seconds.';
  return sentences(
    `The one-way delay to Earth is ${delayText(d)}; a message and its reply take about ${fmt((d * 2) / 60)} minutes.`,
    'During that time Layer 1 and the crew take the urgent steps; ASTRA explains the data.',
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

/** For a metric with an official reference range: says so if everyone is within it, otherwise names those outside it. */
function rangeSentence(s: AstraState, ids: CrewId[], key: MetricKey): string | undefined {
  const withRange = ids.filter((id) => normalRangeFor(key, CREW_BY_ID[id].location));
  if (!withRange.length) return undefined;
  const outside = withRange.filter((id) => {
    const r = normalRangeFor(key, CREW_BY_ID[id].location)!;
    const v = metricNow(s, id, key);
    return v !== undefined && (v < r[0] || v > r[1]);
  });
  const r = normalRangeFor(key, CREW_BY_ID[withRange[0]].location)!;
  const rangeText = r[0] === 0 ? `up to ${valueText(key, r[1])}` : `${fmt(r[0], Number.isInteger(r[0]) ? 0 : 1)}–${valueText(key, r[1])}`;
  if (!outside.length) {
    const who = withRange.length === 1 ? 'The value is' : 'All values are';
    return `${who} within the reference range (${rangeText}); no alert is needed in this range.`;
  }
  return `${list(outside.map(shortName))} outside the reference range (${rangeText}); deviation from personal baseline is being monitored.`;
}

function summaryText(s: AstraState): string {
  const counts = { normal: 0, caution: 0, critical: 0 };
  for (const id of CREW_IDS) if (s.statuses[id]) counts[s.statuses[id]!.level]++;
  const parts = (['critical', 'caution', 'normal'] as const).filter((l) => counts[l]).map((l) => `${counts[l]} ${LEVEL_TR[l]}`);
  const open = openIncidents(s);
  const worst = mostSevere(s);
  return sentences(
    `Overall status: ${list(parts)}.`,
    open.length ? `Open incidents: ${list(open.slice(0, 2).map((i) => i.title))}.` : 'No open incidents.',
    worst && `Lowest health score: ${shortName(worst)}, ${fmt(s.statuses[worst]!.healthScore)}%.`,
    'I am in offline mode; ask with an astronaut name or a metric and I will answer directly from the data.',
  );
}

function chatText(question: string, s: AstraState): string {
  const q = question.toLowerCase();
  const crew = crewInText(question);
  const has = (re: RegExp) => re.test(q);

  if (Object.keys(s.telemetry).length === 0) return 'No telemetry has arrived yet; please ask again in a few seconds.';

  // 0) Greeting, thanks, "who are you"
  if (has(/^(hello|hi|hey|good (morning|evening|afternoon)|thanks|thank you|who are you|how are you|merhaba|selam|günaydın|iyi akşamlar|iyi geceler|iyi günler|teşekkür|sağ ol|kimsin|sen kimsin|nasılsın)/) && q.length < 40) {
    if (has(/^(thanks|thank you|teşekkür|sağ ol)/)) return 'You are welcome. I am glad to help with any other question.';
    return 'Hello, I am ASTRA, the health decision-support assistant for the ARES-1 crew. I can answer questions about the crew\'s health and environment data; for example, you can ask "Who should rest today?"';
  }
  // 1) Out-of-role requests
  if (has(/instruction|forget|poem|story|song|joke|write code|role ?play|pretend|talimat|unut|şiir|hikaye|hikâye|şarkı|masal|fıkra|kod yaz|rol yap|rolünden/)) {
    return 'I am ASTRA; I only help with the ARES-1 crew\'s health and environment data. For example, you can ask "Who should rest today?" or "How is the radiation situation?"';
  }
  // 2) Commands: raising alerts, shutting down systems
  if (has(/(raise|create|open|trigger|start) (an? )?(alert|alarm|incident)|turn off|shut down|disable|silence|mute|(uyarı|alarm|olay)[a-zçğıöşü]*\s+(aç|oluştur|başlat)(?![ıi])|kapat|devre dışı|sustur/)) {
    const co2 = Math.max(...crewAt(s, 'KOKPIT').map((id) => metricNow(s, id, 'env.ppCO2_mmHg') ?? 0), 0);
    return sentences(
      'I cannot raise alerts or operate or shut down vehicle systems.',
      'Layer 1 raises alerts; the crew makes system decisions such as ventilation.',
      has(/ventilat|co2|co₂|havalandır/) && `For reference: Cabin CO₂ partial pressure is currently ${valueText('env.ppCO2_mmHg', co2)}.`,
    );
  }
  // 3) Medication and dose
  if (has(/medication|medicine|drug|pill|tablet|capsule|painkiller|antibiotic|ibuprofen|aspirin|paracetamol|give (a )?dose|ilaç|ilac|kapsül|hap(?![a-zçğıöşü])|doz ver|ağrı kesici|antibiyotik|(^|\s)mg(\s|$)/)) {
    return sentences(
      'I cannot recommend medication or doses; that decision belongs to the flight surgeon.',
      crew[0] && statusSentence(s, crew[0]),
      crew[0] && topSignalsSentence(s, crew[0]),
      DOCTOR,
    );
  }
  // 4) Illness, diagnosis, "what could it be?": data-based possible condition, worded as a possibility
  if (has(/heart attack|attack|diagnos|disease|illness|is (he|she) sick|ill\b|stroke|infarction|what could|going on with|wrong with|unwell|what is the problem|kriz|teşhis|tanı(?![a-zçğıöşü])|hastalı|hasta mı|enfarktüs|inme geçir|felç|ne olabilir|rahatsız|sorun ne/)) {
    return conditionText(s, crew[0] ?? mostSevere(s), has(/heart attack|stroke|infarction|kriz|enfarktüs|inme|felç/));
  }
  // 5) Who should rest
  if (has(/rest|dinlen/)) return restText(s);
  // 5b) Psychological tests (Samn-Perelli, NASA-TLX, PVT-B): results, plan, comparison
  if (has(/test|tlx|samn|perelli|workload|psycholog|questionnaire|iş yük|is yuk|psikoloj|anket/)) return testText(s, crew, has);
  // 6) Why Warning / why Caution
  if (has(/why|reason|cause|neden|niye|sebep/) && (crew.length || has(/critical|caution|warning|kritik|dikkat/))) {
    const id = crew[0] ?? mostSevere(s);
    if (id) return whyText(s, id, has(/critical|warning|kritik/));
  }
  // 7) Topics
  if (has(/radiation|dose|sievert|msv|solar storm|radyasyon|doz|güneş fırtına/)) return radiationText(s, crew);
  if (has(/co2|co₂|carbon dioxide|ventilat|air quality|karbondioksit|karbon dioksit|havalandır|hava kalite/)) return co2Text(s);
  if (has(/delay|earth|communicat|message|gecikme|dünya|iletişim|mesaj/)) return delayAnswer(s);
  // 8) A specific metric
  const match = METRIC_WORDS.find(([re]) => re.test(q));
  if (match) return metricText(s, crew, match[1]);
  // 8b) Topics the system does not measure: say so without making things up, give NASA's general information if available
  const unmeasured = unmeasuredText(s, has);
  if (unmeasured) return unmeasured;
  // 9) One person's status
  if (crew.length && has(/how|status|ok\b|okay|doing|critical|caution|warning|nominal|score|nasıl|durum|iyi mi|ne durumda|kritik|dikkat|skor/)) return whyText(s, crew[0], false);
  // 10) Only a name ("And Kerem?"): that person's status
  const FILLER = new Set(['and', 'what', 'about', 'how', 'now', 'then', 'so', 'peki', 'ya', 'ne', 'için', 've', 'mi', 'mı', 'olacak', 'bakalım', 'şimdi']);
  const rest = q
    .replace(/[^a-zçğıöşü\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w) && !crew.some((id) => w.startsWith(id)));
  if (crew.length && rest.length === 0) return whyText(s, crew[0], false);
  // 11) A name is mentioned but no metric was recognized: do not make things up
  if (crew.length) {
    return sentences(
      'This metric is not in the data; I will not guess.',
      `For ${shortName(crew[0])}, monitored metrics fall into five data groups: ${Object.values(GROUP_NAMES)
        .map((g) => g.toLowerCase())
        .join('; ')}.`,
      DOCTOR,
    );
  }
  // 12) General summary
  return summaryText(s);
}
