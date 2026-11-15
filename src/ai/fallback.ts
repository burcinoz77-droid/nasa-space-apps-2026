// Parça 4 · Yedek mod: internet ya da model yoksa, veriden kural tabanlı Türkçe cevap üretir.
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

const DOCTOR = 'Bu konuda uçuş doktoruna danışmayı öneririm.';

export function fallbackAnswer(req: AstraRequest, s: AstraState = useAstra.getState()): AstraAnswer {
  let text: string;
  try {
    text = req.mode === 'incident' ? incidentText(req, s) : chatText(req.question, s);
  } catch (err) {
    // Şablon bir veri eksikliğine takılırsa yine de güvenli bir cevap ver.
    console.warn('[ASTRA] Yedek şablon hatası:', err);
    text = GENERIC[req.mode];
  }
  return { text, source: 'fallback', verified: true, latencyMs: 0 };
}

const GENERIC = {
  incident: `Bağlantı yok; olay Katman 1 tarafından açıldı ve kayda geçti. Olay kartındaki değerleri kontrol edin ve önerilen güvenli adımı uygulayın. ${DOCTOR}`,
  chat: `Şu an dil modeline ulaşılamıyor; yedek moddayım. Ekrandaki Katman 1 uyarıları güncel ve geçerli. ${DOCTOR}`,
};

// ---------------------------------------------------------------- yardımcılar

function param(key: string, fallback: number): number {
  return (PARAMS as Record<string, { value: number } | undefined>)[key]?.value ?? fallback;
}

/** "a", "a ve b", "a, b ve c" */
function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ve ${items[items.length - 1]}`;
}

/** Cümle içinde etiketin ilk harfini küçültür (kısaltmalar hariç: "CO₂", "PVT"). */
function lcFirst(label: string): string {
  return label.length > 1 && label[1] === label[1].toLocaleLowerCase('tr-TR')
    ? label.charAt(0).toLocaleLowerCase('tr-TR') + label.slice(1)
    : label;
}

function label(key: MetricKey): string {
  return lcFirst(METRIC_BY_KEY[key]?.label ?? key);
}

/** "kalp atış hızı 155 bpm (kişisel normal 92 bpm)" */
function signalText(sig: MetricScore): string {
  return `${label(sig.key)} ${valueText(sig.key, sig.value)} (kişisel normal ${valueText(sig.key, sig.mean)})`;
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
          ? `Toplam doz, ${fmt(param('careerDoseLimit', 600))} mSv kariyer limitine yaklaştıkça uzun vadeli risk artar.`
          : 'Güneş parçacık olayı sırasında doz hızı kısa sürede yükselebilir.',
        `${step('Radyasyon sığınağına geçiş önerilir')}doz hızını izlemeye devam edin.`,
      );
    }
    case 'CO2':
      return sentences(
        `${who}: ${sig}; kritik sınır ${fmt(param('co2CriticalLimit', 3.0), 1)} mmHg.`,
        'Yüksek CO₂ baş ağrısı ve dikkat kaybına yol açabilir; CO₂ temizleyici kontrol edilmeli.',
        `${step('Havalandırmanın artırılması önerilir')}değeri birkaç ölçüm sonra tekrar kontrol edin.`,
      );
    case 'FATIGUE':
      return sentences(
        `${who}: ${sig}.`,
        'Uyku eksikliği tepki süresini uzatıp ruh hâlini bozabilir.',
        `${step('Dinlenme önerilir')}kritik görevlerin başka ekip üyesine devredilmesi önerilir.`,
      );
    case 'THERMAL':
      return sentences(
        `${who}: ${sig}.`,
        'Yoğun efor ve giysi içinde ısı birikmesi çekirdek sıcaklığı yükseltebilir.',
        `${step('Eforun azaltılması önerilir')}soğutma sisteminin kontrolü ve medikal kontrol önerilir.`,
      );
    case 'HYPOXIA':
      return sentences(
        `${who}: ${sig}.`,
        'Düşük oksijen doygunluğu dikkat ve performansı hızla bozabilir.',
        'Oksijen beslemesi ve basıncın kontrolü ile medikal kontrol önerilir; kararı mürettebat verir.',
      );
    case 'CARDIO':
      return sentences(
        `${who}: EKG'de düzensiz atımlar görülüyor; ${sig}.`,
        'Bu değişiklik yorgunluk, stres ya da efordan etkilenebilir.',
        'Eforun azaltılması ve medikal kontrol önerilir.',
      );
    case 'STRESS':
      return sentences(
        `${who}: ${sig}.`,
        'Bu sinyallerin birlikte yükselmesi stres yükünün arttığını gösteriyor.',
        `Kısa bir mola ve ekip içi görüşme önerilir; durum sürerse ${DOCTOR.charAt(0).toLocaleLowerCase('tr-TR')}${DOCTOR.slice(1)}`,
      );
    case 'MULTI':
      return sentences(
        `${who}: birden fazla alanda kritik sapma var; ${sig}.`,
        'Durum tek bir nedenle açıklanamayabilir.',
        `Medikal kontrol önerilir. ${DOCTOR}`,
      );
    default:
      return sentences(`${inc.title}.`, `${sig}.`, DOCTOR);
  }
}

// ---------------------------------------------------------------- sohbet

/** Soru kelimesi -> ölçümler. İlk eşleşen kullanılır. */
const METRIC_WORDS: [RegExp, MetricKey[]][] = [
  [/hrv|değişkenli/, ['cardio.hrv_rmssd_ms']],
  [/nabz|nabız|kalp atış|kalp hız/, ['cardio.hr_bpm']],
  [/spo|doygun|satürasyon|oksijen/, ['cardio.spo2_pct']],
  [/tansiyon|kan basın/, ['cardio.bp_sys_mmHg', 'cardio.bp_dia_mmHg']],
  [/ekg|ritim|ritm|düzensiz atım/, ['cardio.ecg_ectopic_per_min']],
  [/etco|soluk sonu/, ['resp.etco2_mmHg']],
  [/solunum|nefes/, ['resp.rr_bpm']],
  [/kabin sıcaklı|ortam sıcaklı|oda sıcaklı|hava sıcaklı/, ['env.ambientTemp_C']],
  [/bağıl nem|nem oran|rutubet|ortam nem|kabin nem/, ['env.humidity_pct']],
  [/gürültü|ses düzey|ses seviye|desibel|dba/, ['env.noise_dBA']],
  [/sıcaklı|ateş/, ['resp.coreTemp_C']],
  [/kortizol|stres|gsr/, ['biochem.sweatCortisol_ng_mL', 'resp.gsr_uS']],
  [/laktat/, ['biochem.sweatLactate_mM']],
  [/sodyum|elektrolit/, ['biochem.sweatSodium_mM']],
  [/uyku|uyu(?!m)/, ['env.sleepLastNight_h', 'env.remPct', 'env.swsPct']],
  [/pvt|tepki|reaksiyon/, ['cog.pvtMeanRt_ms', 'cog.pvtLapses']],
  [/ruh hal|ruh hâl|duygu|panas|moral/, ['cog.panasPositive', 'cog.panasNegative']],
  [/göz bebe|pupil/, ['cog.pupilDiameter_mm', 'cog.pupilLatency_ms']],
  [/kabin basın|giysi basın/, ['env.pressure_kPa']],
];

/** Sistemde ölçülmeyen konular için kaynaklı, kesin olmayan cevap. */
function unmeasuredText(s: AstraState, has: (re: RegExp) => boolean): string | undefined {
  if (has(/kemik|osteopor/)) {
    const day = s.ship?.missionDay ?? 180;
    return sentences(
      'Kemik yoğunluğu bu sistemde ölçülmüyor; NASA bunu uçuş öncesi ve sonrası kemik taramalarıyla izliyor.',
      `NASA'ya göre 4–6 aylık görevlerde ağırlık taşıyan kemikler ayda ortalama %1–1,5 yoğunluk kaybeder; ${day} günlük görev süresi için bu kabaca ${boneLossEstimate(day)} eder ve kişisel bir ölçüm değil, genel bir tahmindir.`,
      DOCTOR,
    );
  }
  if (has(/bağışıklı|bagisikli|immün/)) return sentences('Bağışıklık sistemi bu sistemde ölçülmüyor; değerlendirilmesi için kan ya da tükürük tahlili gerekir.', DOCTOR);
  if (has(/denge|vestibül/)) return sentences('Denge (vestibüler sistem) bu sistemde ölçülmüyor; NASA bunu dönüş sonrası denge testleriyle izliyor.', DOCTOR);
  if (has(/ekip uyum|takım uyum|ekip içi|takım çalışma/)) {
    return sentences('Ekip uyumu bu sistemde doğrudan ölçülmüyor; stres ve ruh hali ölçümleri (BSI-18, PANAS) dolaylı bilgi veriyor.');
  }
  if (has(/mikrop|bakteri|mantar/)) return sentences('Kabin mikropları bu sistemde ölçülmüyor; bunun için yüzeylerden örnek alınıp laboratuvarda incelenmesi gerekir.');
  if (has(/optik disk|göz yapı|göz değişim|sans(?![a-zçğıöşü])/)) {
    return sentences(
      'Göz yapısındaki değişimler (SANS) bu sistemde doğrudan ölçülmüyor; göz bebeği ölçümleri yalnızca dolaylı bir göstergedir.',
      'Kesin değerlendirme göz taramasıyla (OCT) yapılır.',
      DOCTOR,
    );
  }
  return undefined;
}

function statusSentence(s: AstraState, id: CrewId, withName = true): string {
  const st = s.statuses[id];
  if (!st) return `${shortName(id)} için henüz durum hesaplanmadı.`;
  return `${withName ? `${shortName(id)}'in durumu` : 'Durumu'} ${LEVEL_TR[st.level]}, sağlık skoru %${fmt(st.healthScore)}.`;
}

function topSignalsSentence(s: AstraState, id: CrewId): string | undefined {
  const st = s.statuses[id];
  if (!st?.topSignals.length) return undefined;
  if (st.level === 'normal') return 'Ölçümleri kişisel normaline yakın.';
  return `En çok sapan ölçümleri: ${list(st.topSignals.slice(0, 3).map(signalText))}.`;
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
    askedCritical && st && st.level !== 'critical' && `${shortName(id)} şu an kritik değil.`,
    statusSentence(s, id),
    topSignalsSentence(s, id),
    inc && `Açık olay: ${inc.title}${inc.autoActions.length ? `; ${actionsText(inc).toLocaleLowerCase('tr-TR')}` : ''}.`,
    st && st.level !== 'normal' && !inc && 'Medikal kontrol önerilir; kararı mürettebat verir.',
  );
}

/** Olası durum cevabı: önce değişen değerler, sonra "... ile uyumlu olabilir", sonra kesin olmadığı. */
function conditionText(s: AstraState, id: CrewId | undefined, urgent: boolean): string {
  const lifeThreat = urgent && 'Bu verilerle hayati bir durumu doğrulayamam; belirti varsa hemen uçuş doktoruna bildirin.';
  if (!id) return sentences('Kesin bir teşhis koyamam.', lifeThreat, DOCTOR);
  if (!baselineReady()) {
    return sentences(
      'Kesin bir teşhis koyamam.',
      'Kişisel normal değerler henüz öğreniliyor; ilk 30 ölçümden sonra daha anlamlı bir değerlendirme yapabilirim.',
      lifeThreat,
      DOCTOR,
    );
  }
  const found = possibleConditions(s, id);
  if (!found.length) {
    return sentences(
      'Kesin bir teşhis koyamam.',
      `${shortName(id)}'in ölçümlerinde kişisel normaline göre belirgin bir sapma görünmüyor.`,
      lifeThreat,
      DOCTOR,
    );
  }
  const name = (d: string) => lcFirst(d.replace(/ (olasılığı|şüphesi)$/, ''));
  const [top, second] = found;
  return sentences(
    `Kesin bir teşhis koyamam; ancak ${shortName(id)} için ${list(top.dayanak.slice(0, 3).map(lcFirst))} olarak ölçüldü.`,
    `Bu değişiklikler ${name(top.durum)} ile uyumlu olabilir${second ? `; ${name(second.durum)} olasılığı da düşünülebilir` : ''}.`,
    lifeThreat,
    `Bu bir olasılıktır, kesin değildir; önerilen: ${top.oneri.charAt(0).toLocaleLowerCase('tr-TR')}${top.oneri.slice(1)} ve medikal kontrol.`,
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
    `${shortName(id)} (bilişsel skor %${fmt(cog(id))}, uyku ${valueText('env.sleepLastNight_h', metricNow(s, id, 'env.sleepLastNight_h') ?? 0)}, PVT ${valueText('cog.pvtMeanRt_ms', pvt(id))})`;
  return sentences(
    rest.length
      ? `Katman 1 zorunlu dinlenme verdi: ${list(rest.map(detail))}.`
      : 'Şu an zorunlu dinlenme verilen kimse yok.',
    lowest.length > 0 && `${rest.length ? 'Ayrıca bilişsel' : 'Bilişsel'} skoru en düşük olanlar: ${list(lowest.map(detail))}.`,
    'Dinlenme kararını mürettebat verir.',
  );
}

// ---------------------------------------------------------------- psikolojik testler

const TEST_NAME: Record<TestKind, string> = { SP: 'yorgunluk (Samn-Perelli)', TLX: 'iş yükü (NASA-TLX)', PVT: 'PVT-B tepki testi' };

function dueSentence(id: CrewId, s: AstraState): string | undefined {
  const due = dueTests(id, s);
  if (!due.length) return undefined;
  const first = due[0];
  return `${shortName(id)} için önerilen: ${list(due.map((d) => TEST_NAME[d.kind]))}${first.oncelik === 'öncelikli' ? `; öncelik nedeni: ${lcFirst(first.neden.split('. ')[0].replace(/\.$/, ''))}` : ''}.`;
}

function resultsSentence(id: CrewId): string | undefined {
  const sp = resultsOf(id, 'SP')[0];
  const tlx = resultsOf(id, 'TLX')[0];
  const pvt = resultsOf(id, 'PVT')[0];
  const parts = [
    sp && `yorgunluk ${sp.puan}/7 (${lcFirst(spLabel(sp.puan))})`,
    tlx && `iş yükü ${fmt(tlx.raw, 1)}/100 (en yüksek alt ölçek: ${lcFirst(tlxHighest(tlx.ratings).ad)})`,
    pvt && `PVT-B ortalama ${pvt.meanRt_ms} ms ve ${pvt.lapses} dikkat kaybı`,
  ].filter((p): p is string => !!p);
  return parts.length ? `${shortName(id)} son testler: ${list(parts)}.` : undefined;
}

function testText(s: AstraState, crew: CrewId[], has: (re: RegExp) => boolean): string {
  // Karşılaştırma
  if (has(/en yorgun|karşılaştır|kıyasla|ekip|kim daha|sırala/) && !crew.length) {
    const c = crewComparison(CREW_IDS);
    if (!c.yorgunluk.length && !c.isYuku.length && !c.tepki.length) return 'Son 4 görev gününde kimse test yapmadı; karşılaştırma için önce testlerin yapılması gerekir. Testler astronot ekranındaki Testler sekmesinden yapılır.';
    return sentences(
      c.yorgunluk.length > 0 && `En yüksek yorgunluk: ${shortName(c.yorgunluk[0].id)} (${c.yorgunluk[0].puan}/7).`,
      c.isYuku.length > 0 && `En yüksek iş yükü: ${shortName(c.isYuku[0].id)} (${fmt(c.isYuku[0].puan, 1)}/100).`,
      c.tepki.length > 0 && `En yavaş PVT-B: ${shortName(c.tepki[0].id)} (ortalama ${c.tepki[0].ortalama_ms} ms).`,
      c.testYapmayanlar.length > 0 && `Test yapmayanlar: ${list(c.testYapmayanlar.map(shortName))}.`,
    );
  }
  // Plan: kim, hangi testi yapmalı
  if (has(/kim|hangi|yapmalı|zamanı|bekleyen|plan|öneri/) && !crew.length) {
    const due = CREW_IDS.map((id) => ({ id, d: dueTests(id, s) })).filter((x) => x.d.length);
    const urgent = due.filter((x) => x.d.some((d) => d.oncelik === 'öncelikli'));
    if (!due.length) return 'Şu an bekleyen test yok; tüm mürettebatın testleri güncel. Testler astronot ekranındaki Testler sekmesinden yapılır.';
    return sentences(
      urgent.length ? `Öncelikli test önerilenler: ${list(urgent.map((x) => shortName(x.id)))}.` : 'Öncelikli test önerisi yok.',
      ...urgent.slice(0, 2).map((x) => dueSentence(x.id, s)),
      'Rutin plan her test için 4 görev gününde birdir (ISS Reaction Self Test sıklığı); testler astronot ekranındaki Testler sekmesinden yapılır.',
    );
  }
  // Bir kişi ya da genel durum
  const ids = crew.length ? crew.slice(0, 1) : CREW_IDS.filter((id) => resultsSentence(id));
  if (!ids.length) {
    return sentences(
      'Henüz kimse psikolojik test yapmadı.',
      'Mevcut testler NASA-TLX (iş yükü), Samn-Perelli (yorgunluk) ve PVT-B (3 dakikalık tepki testi); astronot ekranındaki Testler sekmesinden yapılır.',
      'Öz bildirim testleri teşhis değildir.',
    );
  }
  const id = ids[0];
  const ps = psychState(id, s);
  return sentences(
    resultsSentence(id) ?? `${shortName(id)} için henüz test sonucu yok.`,
    ps.ozet,
    dueSentence(id, s),
    crew.length ? 'Öz bildirim testleri teşhis değildir; gerekirse uçuş doktoruna danışın.' : ids.length > 1 && `Test yapan diğer kişiler: ${list(ids.slice(1).map(shortName))}.`,
  );
}

function radiationText(s: AstraState, crew: CrewId[]): string {
  const limit = param('careerDoseLimit', 600);
  const inc = openIncidents(s, (i) => i.type === 'RADIATION')[0];
  const incSentence = inc
    ? `Açık radyasyon olayı var; ${inc.autoActions.includes('RADIATION_SHELTER') ? 'radyasyon sığınağına geçiş otomatik başlatıldı' : 'radyasyon sığınağına geçiş önerilir'}.`
    : 'Açık radyasyon olayı yok; değerler izleniyor.';
  const pct = (cum: number) => Math.round((cum / limit) * 100);

  if (crew.length) {
    const id = crew[0];
    const rate = metricNow(s, id, 'env.doseRate_uSv_h') ?? 0;
    const cum = metricNow(s, id, 'env.doseCumulative_mSv') ?? 0;
    return sentences(
      `${shortName(id)}'in radyasyon doz hızı ${valueText('env.doseRate_uSv_h', rate)}, toplam dozu ${valueText('env.doseCumulative_mSv', cum)}.`,
      `Kariyer limiti ${fmt(limit)} mSv; bu, limitin %${pct(cum)}'i.`,
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
    `Radyasyon doz hızı ortalaması Kokpit ekibinde ${valueText('env.doseRate_uSv_h', kok ?? 0)}, yüzeydeki Gezegen ekibinde ${valueText('env.doseRate_uSv_h', gez ?? 0)}.`,
    top && `En yüksek toplam doz: ${shortName(top)}, ${valueText('env.doseCumulative_mSv', cum)}; kariyer limiti ${fmt(limit)} mSv, yani limitin %${pct(cum)}'i.`,
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
    `Kokpit kabininde CO₂ kısmi basıncı ${valueText('env.ppCO2_mmHg', v)}; dikkat sınırı ${fmt(caution, 1)}, kritik sınır ${fmt(critical, 1)} mmHg.`,
    v <= caution
      ? 'Değer güvenli aralıkta.'
      : v <= critical
        ? 'Değer dikkat sınırının üzerinde; CO₂ temizleyici ve havalandırma kontrol edilmeli.'
        : ventilated
          ? 'Değer kritik sınırın üzerinde; havalandırma otomatik artırıldı, değer birkaç ölçüm içinde düşmeli.'
          : 'Değer kritik sınırın üzerinde; havalandırmanın artırılması önerilir.',
    v > caution && sensitive && `${shortName(sensitive.id)} yüksek CO₂'ye duyarlı; solunumu yakından izlenmeli.`,
    gez !== undefined && `Gezegen ekibinin giysi içi değeri ortalama ${valueText('env.ppCO2_mmHg', gez)}.`,
  );
}

function delayAnswer(s: AstraState): string {
  const d = s.ship?.commDelayOneWay_s;
  if (d === undefined) return 'Gemi verisi henüz gelmedi; birkaç saniye sonra tekrar sorun.';
  return sentences(
    `Dünya ile tek yön gecikme ${delayText(d)}; bir mesajın gidip cevabının dönmesi yaklaşık ${fmt((d * 2) / 60)} dakika.`,
    'Bu sürede acil adımları Katman 1 ve mürettebat atar; ASTRA veriyi açıklar.',
  );
}

function metricText(s: AstraState, crew: CrewId[], keys: MetricKey[]): string {
  if (crew.length) {
    const id = crew[0];
    const parts = keys.map((k) => `${label(k)} ${valueText(k, metricNow(s, id, k) ?? NaN)}`);
    return sentences(
      `${shortName(id)} için ${list(parts)}.`,
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
  const rangeText = r[0] === 0 ? `en fazla ${valueText(key, r[1])}` : `${fmt(r[0], Number.isInteger(r[0]) ? 0 : 1)}–${valueText(key, r[1])}`;
  if (!outside.length) {
    const who = withRange.length === 1 ? 'Değer' : 'Tüm değerler';
    return `${who} resmi normal aralıkta (${rangeText}); bu aralıkta uyarı gerekmez.`;
  }
  return `${list(outside.map(shortName))} resmi normal aralığın (${rangeText}) dışında; kişisel normalden sapma izleniyor.`;
}

function summaryText(s: AstraState): string {
  const counts = { normal: 0, caution: 0, critical: 0 };
  for (const id of CREW_IDS) if (s.statuses[id]) counts[s.statuses[id]!.level]++;
  const parts = (['critical', 'caution', 'normal'] as const).filter((l) => counts[l]).map((l) => `${counts[l]} kişi ${LEVEL_TR[l]}`);
  const open = openIncidents(s);
  const worst = mostSevere(s);
  return sentences(
    `Genel durum: ${list(parts)}.`,
    open.length ? `Açık olaylar: ${list(open.slice(0, 2).map((i) => i.title))}.` : 'Açık olay yok.',
    worst && `En düşük sağlık skoru: ${shortName(worst)}, %${fmt(s.statuses[worst]!.healthScore)}.`,
    'Yedek moddayım; bir astronot adı ya da ölçümle sorarsanız doğrudan veriden cevaplarım.',
  );
}

function chatText(question: string, s: AstraState): string {
  const q = question.toLocaleLowerCase('tr-TR');
  const crew = crewInText(question);
  const has = (re: RegExp) => re.test(q);

  if (Object.keys(s.telemetry).length === 0) return 'Henüz telemetri gelmedi; birkaç saniye sonra tekrar sorun.';

  // 0) Selamlama, teşekkür, "kimsin"
  if (has(/^(merhaba|selam|günaydın|iyi akşamlar|iyi geceler|iyi günler|hey|teşekkür|sağ ol|kimsin|sen kimsin|nasılsın)/) && q.length < 40) {
    if (has(/^(teşekkür|sağ ol)/)) return 'Rica ederim. Başka bir sorunuz olursa yardımcı olmaktan memnuniyet duyarım.';
    return 'Merhaba, ben ASTRA; ARES-1 mürettebatının sağlık karar destek asistanıyım. Mürettebatın sağlık ve ortam verileriyle ilgili sorularınızı yanıtlayabilirim; örneğin "Bugün kim dinlenmeli?" diye sorabilirsiniz.';
  }
  // 1) Rol dışı istekler
  if (has(/talimat|unut|şiir|hikaye|hikâye|şarkı|masal|fıkra|kod yaz|rol yap|rolünden/)) {
    return 'Ben ASTRA\'yım; yalnızca ARES-1 mürettebatının sağlık ve ortam verisi hakkında yardımcı olurum. Örneğin "Bugün kim dinlenmeli?" ya da "Radyasyon durumu nasıl?" diye sorabilirsiniz.';
  }
  // 2) Komut: uyarı açma, sistem kapatma
  if (has(/(uyarı|alarm|olay)[a-zçğıöşü]*\s+(aç|oluştur|başlat)(?![ıi])|kapat|devre dışı|sustur/)) {
    const co2 = Math.max(...crewAt(s, 'KOKPIT').map((id) => metricNow(s, id, 'env.ppCO2_mmHg') ?? 0), 0);
    return sentences(
      'Uyarı açamam; gemi sistemlerini çalıştıramam ya da kapatamam.',
      'Uyarıları Katman 1 açar, havalandırma gibi sistem kararlarını mürettebat verir.',
      has(/havalandır|co2|co₂/) && `Bilgi için: Kokpit CO₂ kısmi basıncı şu an ${valueText('env.ppCO2_mmHg', co2)}.`,
    );
  }
  // 3) İlaç ve doz
  if (has(/ilaç|ilac|tablet|kapsül|hap(?![a-zçğıöşü])|doz ver|ağrı kesici|antibiyotik|(^|\s)mg(\s|$)/)) {
    return sentences(
      'İlaç ya da doz öneremem; bu karar uçuş doktorunundur.',
      crew[0] && statusSentence(s, crew[0]),
      crew[0] && topSignalsSentence(s, crew[0]),
      DOCTOR,
    );
  }
  // 4) Hastalık, teşhis, "ne olabilir?": veriye dayalı olası durum, ihtimal diliyle
  if (has(/kriz|teşhis|tanı(?![a-zçğıöşü])|hastalı|hasta mı|enfarktüs|inme geçir|felç|ne olabilir|rahatsız|sorun ne/)) {
    return conditionText(s, crew[0] ?? mostSevere(s), has(/kriz|enfarktüs|inme|felç/));
  }
  // 5) Kim dinlenmeli
  if (has(/dinlen/)) return restText(s);
  // 5b) Psikolojik testler (Samn-Perelli, NASA-TLX, PVT-B): sonuçlar, plan, karşılaştırma
  if (has(/test|tlx|samn|perelli|iş yük|is yuk|psikoloj|anket/)) return testText(s, crew, has);
  // 6) Neden kritik / neden dikkat
  if (has(/neden|niye|sebep/) && (crew.length || has(/kritik|dikkat/))) {
    const id = crew[0] ?? mostSevere(s);
    if (id) return whyText(s, id, has(/kritik/));
  }
  // 7) Konular
  if (has(/radyasyon|doz|sievert|msv|güneş fırtına/)) return radiationText(s, crew);
  if (has(/co2|co₂|karbondioksit|karbon dioksit|havalandır|hava kalite/)) return co2Text(s);
  if (has(/gecikme|dünya|iletişim|mesaj/)) return delayAnswer(s);
  // 8) Belirli bir ölçüm
  const match = METRIC_WORDS.find(([re]) => re.test(q));
  if (match) return metricText(s, crew, match[1]);
  // 8b) Sistemde ölçülmeyen konular: uydurmadan söyle, varsa NASA'nın genel bilgisini ver
  const unmeasured = unmeasuredText(s, has);
  if (unmeasured) return unmeasured;
  // 9) Bir kişinin durumu
  if (crew.length && has(/nasıl|durum|iyi mi|ne durumda|kritik|dikkat|skor/)) return whyText(s, crew[0], false);
  // 10) Sadece bir ad ("Peki Kerem?"): o kişinin durumu
  const FILLER = new Set(['peki', 'ya', 'ne', 'için', 've', 'mi', 'mı', 'olacak', 'bakalım', 'şimdi']);
  const rest = q
    .replace(/[^a-zçğıöşü\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w) && !crew.some((id) => w.startsWith(id)));
  if (crew.length && rest.length === 0) return whyText(s, crew[0], false);
  // 11) Kişi adı geçiyor ama ölçüm tanınmadı: uydurma
  if (crew.length) {
    return sentences(
      'Bu ölçüm veride yok; tahmin yürütmem.',
      `${shortName(crew[0])} için izlenen ölçümler beş veri grubunda: ${Object.values(GROUP_NAMES)
        .map((g) => g.toLocaleLowerCase('tr-TR'))
        .join('; ')}.`,
      DOCTOR,
    );
  }
  // 12) Genel özet
  return summaryText(s);
}
