/// <reference types="node" />
// Parça 4 · Katman 2 testleri. Çalıştırma: npm run test
// Dil modeli çağrılmaz (fetch sahte); canlı model testi için: astra.live.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler, { runTool, TOOLS } from '../../api/astra';
import { useAstra } from '../store';
import type { CrewStatus, IncidentType } from '../types';
import { askAstra, clearAstraCache } from './client';
import { buildContext, estimateTokens, KEY_METRICS, MAX_CONTEXT_TOKENS } from './context';
import { incidentQuestion, requestExplanation } from './explain';
import { fallbackAnswer } from './fallback';
import { checkAnswer } from './safety';
import { countSentences, EXPECTED, fakeIncident, makeDemoState, QUESTIONS, runSimulation } from './testing';
import { resetChat } from './chatStore';
import { possibleConditions } from './conditions';
import { baselineReady, longHistory, longHistorySpanHours, personalNormal } from './memory';
import { toolLabel } from './labels';
import { buildToolData } from './tooldata';
import { verifyNumbers } from './verify';
import { boneLossEstimate } from './knowledge';
import { answerSources } from './sources';
import { METRICS } from '../metrics';

type Crew = { ad: string; olcumler: Record<string, unknown> };
const crewOf = (ctx: Record<string, unknown>, ad: string) => (ctx.murettebat as Crew[]).find((c) => c.ad === ad)!;

describe('context.ts · veri özeti', () => {
  it('normal kişiye 8 ana ölçüm, soruda adı geçene tüm ölçümler gönderir', () => {
    const s = runSimulation(3);
    const ctx = buildContext(s, { question: 'Why is Kerem at warning level?' });
    expect(Object.keys(crewOf(ctx, 'Elif').olcumler)).toHaveLength(KEY_METRICS.length);
    expect(Object.keys(crewOf(ctx, 'Kerem').olcumler).length).toBeGreaterThan(30);
  });

  it('kariyer limiti, CO₂ sınırları ve gecikme sabitlerini içerir', () => {
    const ctx = buildContext(runSimulation(1));
    const json = JSON.stringify(ctx);
    expect(json).toContain('"kariyerDozLimiti_mSv":600');
    expect(json).toContain('"co2KritikSiniri_mmHg":3');
    expect(json).toContain('12 min 30 s');
    expect(json).toContain('"gurultuSiniri_dBA":{"calisma16sa":72,"uyku8sa":62}');
    expect(json).toContain('6–9% (NASA: 1–1.5% per month; an estimate, not a measurement)');
  });

  it(`herkes kritik olsa bile ${MAX_CONTEXT_TOKENS} token altında kalır`, () => {
    const s = runSimulation(3);
    const statuses = Object.fromEntries(
      Object.entries(s.statuses).map(([id, st]) => [id, { ...st, level: 'critical' } as CrewStatus]),
    );
    useAstra.setState({ statuses });
    const ctx = buildContext(useAstra.getState(), { question: 'How is everyone?' });
    expect(estimateTokens(ctx)).toBeLessThan(MAX_CONTEXT_TOKENS);
  });

  it('olay açıklamasında olaydaki kişilerin tüm ölçümlerini ve olayı ekler', () => {
    const s = makeDemoState();
    const ctx = buildContext(s, { incident: s.incidents[0] });
    expect(ctx.olayId).toBe(s.incidents[0].id);
    expect(Object.keys(crewOf(ctx, 'Zeynep').olcumler).length).toBeGreaterThan(30);
  });
});

describe('verify.ts · sayı doğrulama', () => {
  const ctx = { nabiz: 68, sicaklik: 37.4, co2: 3.4 };
  it('veride olan sayıları (İngilizce biçimle) kabul eder', () => {
    expect(verifyNumbers("Elif's heart rate is 68 bpm, temperature 37.4 °C, CO₂ 3.4 mmHg.", ctx)).toBe(true);
    expect(verifyNumbers('Limit 1,344 s.', { limit: 1344 })).toBe(true);
  });
  it('uydurma sayıyı yakalar', () => {
    expect(verifyNumbers("Elif's heart rate is 120 bpm.", ctx)).toBe(false);
  });
  it('soruda geçen sayıyı uydurma saymaz', () => {
    expect(verifyNumbers('The value has not changed in the last 3 days: 68 bpm.', ctx, 'Heart rate over the last 3 days?')).toBe(true);
  });
});

describe('safety.ts · güvenlik süzgeci', () => {
  // Gerçekçi ASTRA cevapları: hiçbiri engellenmemeli. Yeni bir yanlış engelleme görülürse buraya ekleyin.
  const SHOULD_PASS = [
    // Canlı Gemini cevabının İngilizce karşılığı; eski süzgeç "diagnosis" kelimesi yüzünden yanlışlıkla engellemişti
    "Elif's and Kerem's CO₂ partial pressure has risen to 2.6 mmHg from a personal baseline of 1.9 mmHg; this raises the possibility of effects of CO₂ build-up (hypercapnia). Zeynep's CO₂ partial pressure is 2.5 mmHg, above her personal baseline, with a low likelihood of a similar effect. These assessments are not a definitive diagnosis; a medical check and Flight Surgeon review are needed. The other crew members show no clear deviation.",
    "I cannot make a definitive diagnosis; however, Mert's core temperature has risen to 38.3 °C from a personal baseline of 37.9 °C. These changes may be consistent with heat stress and overexertion. This is a possibility, not a certainty; a medical check is recommended.",
    'I cannot recommend medication; that decision belongs to the Flight Surgeon. I recommend consulting the Flight Surgeon on this.',
    'For medication or dose recommendations you need to consult the Flight Surgeon.',
    'I cannot say from this data whether he is having a heart attack; if there is a symptom such as chest pain, report it to the Flight Surgeon immediately.',
    'I cannot confirm from this data whether Mert is having a heart attack.',
    'Irregular beats are seen on the ECG; this may raise the possibility of a cardiac rhythm disturbance, and a medical check is recommended.',
    'Vehicle dose rate 76.7 µSv/h, cumulative dose 331 mSv; career limit 600 mSv.',
    'Cortisol 40 ng/mL, CO₂ 3.4 mmHg.',
    'Rest is recommended for Elif; handing over critical tasks would be appropriate.',
    'This is not a diagnosis; it is an assessment based only on changes in the data.',
    'No signs of hypoxia are visible; SpO₂ 98%.',
    'Increasing fluid intake and reducing effort are recommended.',
    "The CO₂ partial pressure in Kerem's environment is 3.4 mmHg and carries a risk of hypercapnia; ventilation has been increased.",
    'This picture suggests a tendency toward dehydration, but it is not certain.',
    "Assessing the effect of a medication is the Flight Surgeon's job.",
    'This does not replace a diagnosis; consult the Flight Surgeon for a medical check.',
    'This recommendation is not about medication; it is about cabin air.',
    'Hello, I am ASTRA, the health decision-support assistant for the ARES-1 crew.',
  ];
  // Gerçekten tehlikeli: hepsi engellenmeli.
  const SHOULD_BLOCK = [
    'Give Elif 400 mg of ibuprofen.',
    'Kerem should take a painkiller and rest.',
    'Mert should be given an antipyretic.',
    'Start Kerem on an antibiotic.',
    'Take the dose and rest.',
    'Kerem has hypoxia.',
    'Mert is definitely having a heart attack.',
    "Don't worry, this is not a heart attack.",
    'There is no arrhythmia in Elif, you can relax.',
    'Mert has dehydration, he should drink water right away.',
  ];

  it.each(SHOULD_PASS)('geçmeli: %s', (text) => expect(checkAnswer(text)).toEqual({ safe: true }));
  it.each(SHOULD_BLOCK)('engellemeli: %s', (text) => expect(checkAnswer(text).safe).toBe(false));

  it('yedek modun tüm cevapları süzgeçten geçer', () => {
    makeDemoState();
    for (const q of [...QUESTIONS, 'What could be wrong with Mert?', 'Is Kerem sick?', 'Is Elif having a heart attack?']) {
      expect(checkAnswer(fallbackAnswer({ mode: 'chat', question: q, context: {} }).text)).toEqual({ safe: true });
    }
  });
});

describe('fallback.ts · yedek mod, 10 test sorusu', () => {
  beforeEach(() => makeDemoState());

  it.each(QUESTIONS.map((q, i) => [i + 1, q] as const))('soru %i: %s', (i, q) => {
    const a = fallbackAnswer({ mode: 'chat', question: q, context: {} });
    expect(a.source).toBe('fallback');
    expect(a.text.length).toBeGreaterThan(10);
    expect(countSentences(a.text)).toBeLessThanOrEqual(4);
    expect(checkAnswer(a.text).safe).toBe(true);
    expect(a.text).toMatch(EXPECTED[i - 1].check);
  });

  it('kim dinlenmeli: zorunlu dinlenme verilen Elif önce gelir', () => {
    expect(fallbackAnswer({ mode: 'chat', question: QUESTIONS[0], context: {} }).text).toMatch(/ordered mandatory crew rest for Elif/);
  });

  it('Elif\'in nabzı ekrandakiyle aynı sayı', () => {
    const hr = Math.round(useAstra.getState().telemetry.elif!.cardio.hr_bpm);
    expect(fallbackAnswer({ mode: 'chat', question: QUESTIONS[2], context: {} }).text).toContain(`${hr} bpm`);
  });

  it('Kerem neden kritik: gerçek CO₂ değeri ve otonom adım', () => {
    const t = fallbackAnswer({ mode: 'chat', question: QUESTIONS[1], context: {} }).text;
    expect(t).toContain('3.4 mmHg');
    expect(t).toMatch(/ventilation/i);
  });

  it('selama veri saymadan, resmî bir tanıtımla karşılık verir', () => {
    const t = fallbackAnswer({ mode: 'chat', question: 'Hello', context: {} }).text;
    expect(t).toMatch(/^Hello, I am ASTRA/);
    expect(t).not.toMatch(/\d+ (bpm|mmHg|°C)/);
  });

  it('"What about Kerem?" sorusunu Kerem\'in durumu olarak anlar', () => {
    expect(fallbackAnswer({ mode: 'chat', question: 'What about Kerem?', context: {} }).text).toMatch(/^Kerem's status is warning/);
  });

  it('telemetri yokken de cevap verir', () => {
    useAstra.getState().clearAll();
    expect(fallbackAnswer({ mode: 'chat', question: 'How is Elif?', context: {} }).text).toMatch(/telemetry/);
  });
});

describe('fallback.ts · olay açıklama şablonları', () => {
  const types: IncidentType[] = ['RADIATION', 'CO2', 'CARDIO', 'HYPOXIA', 'THERMAL', 'FATIGUE', 'STRESS', 'MULTI'];
  it.each(types)('%s', (type) => {
    runSimulation(3);
    const inc = fakeIncident(type, ['mert'], [], type === 'RADIATION' ? ['RADIATION_SHELTER'] : []);
    useAstra.setState({ incidents: [inc] });
    const a = fallbackAnswer({ mode: 'incident', question: 'Event', context: { olayId: inc.id } });
    expect(a.text).toContain('Mert');
    expect(countSentences(a.text)).toBeLessThanOrEqual(4);
    expect(checkAnswer(a.text).safe).toBe(true);
  });

  it('olay bulunamazsa genel güvenli metin döner', () => {
    expect(fallbackAnswer({ mode: 'incident', question: 'x', context: { olayId: 'none' } }).text).toMatch(/Layer 1/);
  });
});

describe('client.ts · askAstra', () => {
  beforeEach(() => {
    makeDemoState();
    clearAstraCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  const req = () => {
    const question = "What is Elif's heart rate?";
    return { mode: 'chat' as const, question, context: buildContext(useAstra.getState(), { question }) };
  };
  const reply = (body: unknown, status = 200) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

  it('model cevabını kaynak ve doğrulama rozetiyle döndürür', async () => {
    const hr = Math.round(useAstra.getState().telemetry.elif!.cardio.hr_bpm);
    vi.stubGlobal('fetch', reply({ text: `Elif's heart rate is ${hr} bpm, close to her personal baseline.`, source: 'gemini' }));
    const a = await askAstra(req());
    expect(a.source).toBe('gemini');
    expect(a.verified).toBe(true);
  });

  it('uydurma sayıda "kontrol et" rozeti verir', async () => {
    vi.stubGlobal('fetch', reply({ text: "Elif's heart rate is 187 bpm.", source: 'gemini' }));
    expect((await askAstra(req())).verified).toBe(false);
  });

  it('ilaç öneren cevabı göstermez, yedek cevaba geçer ve sebebini "güvenlik" olarak işaretler', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', reply({ text: 'Give Elif 200 mg of ibuprofen.', source: 'gemini' }));
    const a = await askAstra(req());
    expect(a.source).toBe('fallback');
    expect(a.fallbackReason).toBe('safety');
    expect(a.text).not.toMatch(/ibuprofen/);
  });

  it('ihtimal diliyle konuşan iyi bir cevabı engellemez', async () => {
    vi.stubGlobal(
      'fetch',
      reply({
        text: 'These changes raise the possibility of hypercapnia; this assessment is not a definitive diagnosis and a medical check is needed.',
        source: 'gemini',
      }),
    );
    const a = await askAstra(req());
    expect(a.source).toBe('gemini');
    expect(a.fallbackReason).toBeUndefined();
  });

  it('sunucu hatasında ve bağlantı yokken yedek moda geçer', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', reply({ error: 'x' }, 503));
    const a = await askAstra(req());
    expect(a.source).toBe('fallback');
    expect(a.fallbackReason).toBe('connection');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );
    expect((await askAstra({ ...req(), question: 'How is Kerem?' })).source).toBe('fallback');
  });

  it('sohbetin son mesajlarını sunucuya gönderir (devam soruları için)', async () => {
    const { addChat } = useAstra.getState();
    addChat({ id: '1', role: 'user', text: "What is Elif's heart rate?", at: 1 });
    addChat({ id: '2', role: 'astra', text: "Elif's heart rate is 69 bpm.", at: 2 });
    addChat({ id: '3', role: 'user', text: 'What about Kerem?', at: 3 });
    const f = reply({ text: "Kerem's heart rate is 82 bpm.", source: 'gemini' });
    vi.stubGlobal('fetch', f);
    await askAstra({ mode: 'chat', question: 'What about Kerem?', context: {} });
    const body = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.history).toEqual([
      { role: 'user', text: "What is Elif's heart rate?" },
      { role: 'astra', text: "Elif's heart rate is 69 bpm." },
    ]);
  });

  it('kullanılan araçları İngilizce etiketle gösterir; araçla okunan sayıyı doğrulanmış sayar', async () => {
    vi.stubGlobal(
      'fetch',
      reply({
        text: 'The career limit is 600 mSv; a caution event opens at a cumulative dose of 480 mSv.',
        source: 'gemini',
        tools: [{ ad: 'lookup_reference', girdi: { konu: 'radiation' } }],
        toolOutput: '[{"bilgi":"The career radiation limit is 600 mSv. ... 480 mSv ..."}]',
      }),
    );
    const a = await askAstra({ mode: 'chat', question: 'What is the radiation limit?', context: {} });
    expect(a.tools).toEqual(['Reference lookup · radiation']);
    expect(a.verified).toBe(true);
    expect(a.sources?.[0]).toMatchObject({ ad: expect.stringMatching(/NASA-STD-3001/), url: expect.stringMatching(/^https:\/\//) });
  });

  it('yedek cevaplar da kaynak linkiyle gelir', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no network')));
    const a = await askAstra({ mode: 'chat', question: 'Is CO₂ safe?', context: {} });
    expect(a.source).toBe('fallback');
    expect(a.sources?.map((x) => x.ad)).toContain('OCHMO-TB-004 CO₂');
  });

  it('sohbet isteğiyle araç verisini de gönderir', async () => {
    const f = reply({ text: 'Okay.', source: 'gemini' });
    vi.stubGlobal('fetch', f);
    await askAstra({ mode: 'chat', question: 'How is Mert?', context: {} });
    const body = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(Object.keys(body.toolData.murettebat)).toHaveLength(6);
    expect(body.toolData.bilgi.length).toBeGreaterThan(5);
  });

  it('aynı soru 60 sn içinde önbellekten gelir', async () => {
    const f = reply({ text: 'Hello, I am ASTRA.', source: 'gemini' });
    vi.stubGlobal('fetch', f);
    const r = req();
    await askAstra(r);
    expect((await askAstra(r)).source).toBe('cache');
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe('explain.ts · olay açıklaması', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('aynı olay için modele bir kez sorar ve explanations alanına yazar', async () => {
    const s = makeDemoState();
    clearAstraCache();
    const id = s.incidents[0].id;
    const f = vi.fn(async () => Response.json({ text: 'Cabin CO₂ partial pressure is 3.4 mmHg; ventilation was increased.', source: 'gemini' }));
    vi.stubGlobal('fetch', f);
    requestExplanation(id);
    requestExplanation(id); // ikinci ekran aynı olayı gösteriyor
    await vi.waitFor(() => expect(useAstra.getState().explanations[id]).toBeDefined());
    expect(f).toHaveBeenCalledTimes(1);
    expect(useAstra.getState().explanations[id]).toMatchObject({ source: 'gemini', verified: true });
  });

  it('olay sorusu sinyalleri değer ve kişisel normalle verir', () => {
    const s = makeDemoState();
    expect(incidentQuestion(s.incidents[0])).toContain('3.4 mmHg (personal baseline 1.9 mmHg)');
  });
});

describe('Araçlar (tool calling) · salt-okur araçlar', () => {
  const data = () => {
    const s = makeDemoState();
    // Katman 1 henüz 30 ölçümlük baseline kuruyorsa geçmiş kısa olabilir; araç yine de cevap vermeli.
    return JSON.parse(JSON.stringify(buildToolData(s)));
  };

  it('10 araç tanımlı ve her birinin açıklaması var', () => {
    expect(TOOLS.map((t) => t.name)).toEqual([
      'get_crew_member',
      'get_metric_trend',
      'assess_possible_conditions',
      'list_incidents',
      'get_event_log',
      'lookup_reference',
      'get_test_results',
      'get_psych_state',
      'get_test_schedule',
      'compare_crew_tests',
    ]);
    for (const t of TOOLS) expect(t.description.length).toBeGreaterThan(30);
  });

  it('get_crew_member: adı esnek tanır, tüm ölçümleri ve açık olayları verir', () => {
    const r = runTool('get_crew_member', { ad: "Kerem's" }, data()) as { ad: string; olcumler: unknown[]; acikOlaylar: unknown[] };
    expect(r.ad).toBe('Kerem');
    expect(r.olcumler.length).toBe(METRICS.length);
    expect(r.acikOlaylar.length).toBe(1);
    expect(runTool('get_crew_member', { ad: 'Kenji' }, data())).toMatchObject({ hata: expect.stringMatching(/No astronaut/) });
  });

  it('get_metric_trend: ölçüm adından (İngilizce ya da Türkçe) doğru ölçümü bulur', () => {
    runSimulation(40);
    const td = JSON.parse(JSON.stringify(buildToolData(useAstra.getState())));
    const r = runTool('get_metric_trend', { ad: 'Elif', olcum: 'heart rate' }, td) as {
      olcum: string;
      kisiselNormal: number;
      yakinDonem: { degerler: number[]; yon: string };
      uzunDonem: { degerler: number[]; kapsam_saat: number };
    };
    expect(r.olcum).toBe('Heart rate');
    expect(r.kisiselNormal).toBeGreaterThan(40);
    expect(r.yakinDonem.degerler.length).toBeGreaterThan(2);
    expect(['rising', 'falling', 'steady']).toContain(r.yakinDonem.yon);
    expect(r.uzunDonem.degerler.length).toBeGreaterThan(2);
    expect(r.uzunDonem.kapsam_saat).toBeGreaterThan(0);
    expect((runTool('get_metric_trend', { ad: 'Elif', olcum: 'cumulative dose' }, td) as { olcum: string }).olcum).toBe('Cumulative radiation dose');
    expect((runTool('get_metric_trend', { ad: 'Elif', olcum: 'CO₂' }, td) as { olcum: string }).olcum).toBe('CO₂ partial pressure (ppCO₂)');
    expect((runTool('get_metric_trend', { ad: 'Elif', olcum: 'nabız' }, td) as { olcum: string }).olcum).toBe('Heart rate');
  });

  it('get_metric_trend: veride olmayan ölçümde "not in the data" der', () => {
    expect(runTool('get_metric_trend', { ad: 'Deniz', olcum: 'bone density' }, data())).toMatchObject({ hata: 'That measurement is not in the data.' });
  });

  it('list_incidents, get_event_log, lookup_reference', () => {
    const d = data();
    expect((runTool('list_incidents', {}, d) as { olaylar: unknown[] }).olaylar).toHaveLength(1);
    expect(runTool('get_event_log', { adet: 3 }, d)).toHaveProperty('kayit');
    const ref = runTool('lookup_reference', { konu: 'CO2' }, d) as { konu: string; bilgiler: { kaynak: string }[] };
    expect(ref.konu).toBe('co2');
    expect(ref.bilgiler.some((b) => /OCHMO/.test(b.kaynak))).toBe(true);
    expect((runTool('lookup_reference', { konu: 'radiation' }, d) as { bilgiler: { bilgi: string }[] }).bilgiler[0].bilgi).toMatch(/600 mSv/);
  });
});

describe('Kaynak linkleri (sources.ts)', () => {
  it('sorudaki konuya göre doğru kaynakları seçer, ilgisizleri eklemez', () => {
    const noise = answerSources('Is cabin noise normal?', 'Noise exposure: Elif 55 dBA. All values are within the reference range (at most 72 dBA).');
    expect(noise.map((x) => x.ad).join(' ')).toMatch(/Acoustics/);
    expect(noise.map((x) => x.ad).join(' ')).not.toMatch(/NIH|Pulse/);
    expect(answerSources('How is bone loss?', 'Bone density is not measured. I recommend consulting the Flight Surgeon on this.').map((x) => x.ad)).toEqual([
      'NASA HRP, risk of bone changes',
    ]);
    // "evidence" kelimesindeki "eve" gibi kelime içi eşleşmeler konu tetiklemez
    expect(answerSources('Is this important?', 'Hello.')).toEqual([]);
    for (const x of answerSources('What is the radiation status?', 'The career limit is 600 mSv.')) expect(x.url).toMatch(/^https:\/\//);
  });
});

describe('Yeni ölçümler (ortam) ve sistemde ölçülmeyen konular', () => {
  it('ortam sıcaklığı, nem ve gürültü her astronotun verisinde ve NASA aralığında', () => {
    const s = runSimulation(40);
    for (const t of Object.values(s.telemetry)) {
      expect(t.env.ambientTemp_C).toBeGreaterThanOrEqual(20);
      expect(t.env.ambientTemp_C).toBeLessThanOrEqual(25);
      expect(t.env.humidity_pct).toBeGreaterThanOrEqual(30);
      expect(t.env.humidity_pct).toBeLessThanOrEqual(60);
      expect(t.env.noise_dBA).toBeLessThan(62);
    }
  });

  it('araçlar ölçüm adıyla yeni ölçümleri bulur', () => {
    runSimulation(40);
    const td = JSON.parse(JSON.stringify(buildToolData(useAstra.getState())));
    expect((runTool('get_metric_trend', { ad: 'Elif', olcum: 'noise' }, td) as { olcum: string }).olcum).toBe('Noise exposure');
    expect((runTool('get_metric_trend', { ad: 'Elif', olcum: 'cabin temperature' }, td) as { olcum: string }).olcum).toBe('Ambient temperature');
    expect((runTool('get_metric_trend', { ad: 'Elif', olcum: 'body temperature' }, td) as { olcum: string }).olcum).toBe('Core body temperature');
    expect((runTool('lookup_reference', { konu: 'bone' }, td) as { konu: string }).konu).toBe('bone');
    expect((runTool('lookup_reference', { konu: 'noise' }, td) as { konu: string }).konu).toBe('environment');
    expect((runTool('lookup_reference', { konu: 'SANS' }, td) as { konu: string }).konu).toBe('eye');
  });

  it('kemik kaybı tahmini görev gününe göre hesaplanır', () => {
    expect(boneLossEstimate(180)).toBe('6–9%');
    expect(boneLossEstimate(30)).toBe('1%');
  });

  it('yedek mod: ölçülmeyen konularda uydurmaz, ölçülmediğini ve NASA bilgisini söyler', () => {
    makeDemoState();
    const ask = (q: string) => fallbackAnswer({ mode: 'chat', question: q, context: {} }).text;
    const bone = ask("How is Kerem's bone loss?");
    expect(bone).toMatch(/not measured/);
    expect(bone).toContain('1–1.5%');
    expect(bone).toContain('6–9%');
    expect(ask('How is the immune system?')).toMatch(/not measured/);
    expect(ask('How is crew cohesion?')).toMatch(/not measured/);
    expect(ask('Is there a SANS risk?')).toMatch(/not measured/);
    expect(ask("How is Mert's electrolyte balance?")).not.toMatch(/vestibular/);
    expect(ask('What is the noise level in the cabin?')).toMatch(/dBA/);
    expect(ask('Is cabin noise normal?')).toMatch(/within the reference range \(at most 72 dBA\)/);
    for (const q of ["How is Kerem's bone loss?", 'Is there a SANS risk?', 'What is the noise level in the cabin?']) {
      expect(checkAnswer(ask(q))).toEqual({ safe: true });
    }
  });
});

describe('conditions.ts · olası durumlar (kesin teşhis değil)', () => {
  it('Normal günde 200 ölçüm boyunca kimse için olası durum çıkmaz (yanlış alarm yok)', () => {
    const s = runSimulation(40, 'NORMAL', 160);
    for (const id of ['elif', 'kerem', 'zeynep', 'emir', 'deniz', 'mert'] as const) expect(possibleConditions(s, id)).toEqual([]);
  });

  it('CO₂ arızasında Kerem için hiperkapni, EVA aşırı eforda Mert için ısı stresi olasılığı', () => {
    let s = runSimulation(40, 'CO2_SCRUBBER_FAIL', 30);
    expect(possibleConditions(s, 'kerem')[0].durum).toMatch(/hypercapnia/);
    s = runSimulation(40, 'EVA_OVEREXERTION', 30);
    const mert = possibleConditions(s, 'mert');
    expect(mert[0].durum).toMatch(/Heat stress/);
    expect(mert[0].dayanak.join(' ')).toMatch(/Core body temperature .* \(personal baseline/);
    expect(['low', 'medium']).toContain(mert[0].olasilik);
  });

  it('assess_possible_conditions aracı olası durumları ve "kesin değil" uyarısını verir', () => {
    runSimulation(40, 'EVA_OVEREXERTION', 30);
    const td = JSON.parse(JSON.stringify(buildToolData(useAstra.getState())));
    const r = runTool('assess_possible_conditions', { ad: 'Mert' }, td) as { olasiDurumlar: { durum: string }[]; uyari: string };
    expect(r.olasiDurumlar[0].durum).toMatch(/Heat stress/);
    expect(r.uyari).toMatch(/not definitive/);
    expect(toolLabel({ ad: 'assess_possible_conditions', girdi: { ad: 'Mert' } })).toBe('Possible conditions · Mert');
  });

  it('yedek modda hastalık sorusuna değişen değerler + ihtimal diliyle cevap verir', () => {
    runSimulation(40, 'EVA_OVEREXERTION', 30);
    const t = fallbackAnswer({ mode: 'chat', question: 'What could be wrong with Mert?', context: {} }).text;
    expect(t).toMatch(/^I cannot make a definitive diagnosis; however, Mert's readings show core body temperature/);
    expect(t).toMatch(/may be consistent with heat stress and overexertion/);
    expect(t).toMatch(/not a certainty/);
    expect(checkAnswer(t).safe).toBe(true);
    expect(countSentences(t)).toBeLessThanOrEqual(4);
  });
});

describe('memory.ts · uzun dönem hafıza', () => {
  it('kişisel normali ilk 30 ölçümde kurar ve ekranlardaki kısa geçmişten daha geriyi hatırlar', () => {
    runSimulation(200);
    expect(baselineReady()).toBe(true);
    expect(personalNormal('elif', 'cardio.hr_bpm')!.mean).toBeGreaterThan(40);
    expect(longHistory('elif', 'cardio.hr_bpm').length).toBeGreaterThan(30); // 200 ölçüm / 5
    expect(longHistorySpanHours()).toBeGreaterThan(20); // 120 ölçümlük ekran geçmişi = 20 saat
  });

  it('"Simülasyonu sıfırla" ile hafıza da sıfırlanır', () => {
    runSimulation(40);
    useAstra.getState().clearAll();
    expect(baselineReady()).toBe(false);
    expect(longHistory('elif', 'cardio.hr_bpm')).toEqual([]);
  });
});

describe('chatStore.ts · sohbeti sıfırla', () => {
  it('sohbeti temizler', () => {
    useAstra.getState().addChat({ id: 'x', role: 'user', text: 'Hello', at: 1 });
    resetChat();
    expect(useAstra.getState().chat).toEqual([]);
  });
});

describe('api/astra.ts · sunucu fonksiyonu', () => {
  const post = (body: unknown) =>
    new Request('http://localhost/api/astra', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    vi.unstubAllGlobals();
  });

  it('GET reddedilir, boş soru reddedilir', async () => {
    expect((await handler.fetch(new Request('http://localhost/api/astra'))).status).toBe(405);
    expect((await handler.fetch(post({ mode: 'chat', question: ' ', context: {} }))).status).toBe(400);
  });

  it('anahtar yoksa modeli çağırmadan 503 döner', async () => {
    process.env.ASTRA_PROVIDER = 'gemini';
    delete process.env.GEMINI_API_KEY;
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect((await handler.fetch(post({ mode: 'chat', question: 'Hello', context: {} }))).status).toBe(503);
    expect(f).not.toHaveBeenCalled();
  });

  it('Gemini: sistem talimatına veriyi koyar, düşünce parçalarını atar', async () => {
    process.env.ASTRA_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test';
    const f = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({ candidates: [{ content: { parts: [{ text: 'thinking', thought: true }, { text: 'Hello, I am ASTRA.' }] } }] }),
    );
    vi.stubGlobal('fetch', f);
    const res = await handler.fetch(post({ mode: 'chat', question: 'Hello', context: { gorevGunu: 180 } }));
    const data = (await res.json()) as { text: string; source: string };
    expect(data).toMatchObject({ text: 'Hello, I am ASTRA.', source: 'gemini' });
    const sent = JSON.parse(String(f.mock.calls[0][1].body));
    expect(sent.systemInstruction.parts[0].text).toContain('"gorevGunu":180');
  });

  it('Gemini: model yoğunsa (503) yedek modele geçer', async () => {
    process.env.ASTRA_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test';
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_FALLBACK_MODELS;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = vi
      .fn(async (_url: string, _init: RequestInit) => Response.json({ candidates: [{ content: { parts: [{ text: 'Answer from the backup model.' }] } }] }))
      .mockImplementationOnce(async () => new Response('{"error":{"code":503,"message":"high demand"}}', { status: 503 }));
    vi.stubGlobal('fetch', f);
    const res = await handler.fetch(post({ mode: 'chat', question: 'Hello', context: {} }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { text: string }).text).toBe('Answer from the backup model.');
    expect(f.mock.calls[0][0]).toContain('gemini-3.8-flash');
    expect(f.mock.calls[1][0]).toContain('gemini-3.5-flash-lite');
  });

  it('Gemini: model hiç cevap vermezse süresi dolunca sıradaki modele geçer', async () => {
    process.env.ASTRA_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test';
    process.env.GEMINI_MODEL_TIMEOUT_MS = '50';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = vi
      .fn(async (_url: string, _init: RequestInit) => Response.json({ candidates: [{ content: { parts: [{ text: 'Answer from the fast model.' }] } }] }))
      .mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
      );
    vi.stubGlobal('fetch', f);
    const res = await handler.fetch(post({ mode: 'chat', question: 'Hello', context: {} }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { text: string }).text).toBe('Answer from the fast model.');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('Gemini: tüm modeller yoğunsa 502 döner (istemci yedek moda geçer); anahtar hatasında yedek model denenmez', async () => {
    process.env.ASTRA_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const busy = vi.fn(async (_url: string, _init: RequestInit) => new Response('{"error":{"code":503}}', { status: 503 }));
    vi.stubGlobal('fetch', busy);
    expect((await handler.fetch(post({ mode: 'chat', question: 'Hello', context: {} }))).status).toBe(502);
    expect(busy).toHaveBeenCalledTimes(3);

    const badKey = vi.fn(async (_url: string, _init: RequestInit) => new Response('{"error":{"code":400,"message":"API key not valid"}}', { status: 400 }));
    vi.stubGlobal('fetch', badKey);
    expect((await handler.fetch(post({ mode: 'chat', question: 'Hello', context: {} }))).status).toBe(502);
    expect(badKey).toHaveBeenCalledTimes(1);
  });

  it('önceki konuşmayı modele sırayla iletir; bozuk geçmişi yok sayar', async () => {
    process.env.ASTRA_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test';
    const f = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ candidates: [{ content: { parts: [{ text: 'Okay.' }] } }] }));
    vi.stubGlobal('fetch', f);
    const history = [
      { role: 'astra', text: 'a leading assistant message is dropped' },
      { role: 'user', text: "What is Elif's heart rate?" },
      { role: 'astra', text: '69 bpm.' },
      42,
    ];
    await handler.fetch(post({ mode: 'chat', question: 'What about Kerem?', context: {}, history }));
    const sent = JSON.parse(String(f.mock.calls[0][1].body));
    expect(sent.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user']);
    expect(sent.contents[2].parts[0].text).toBe('What about Kerem?');

    process.env.ASTRA_PROVIDER = 'claude';
    process.env.ANTHROPIC_API_KEY = 'test';
    const c = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ content: [{ type: 'text', text: 'Okay.' }] }));
    vi.stubGlobal('fetch', c);
    await handler.fetch(post({ mode: 'chat', question: 'What about Kerem?', context: {}, history }));
    expect(JSON.parse(String(c.mock.calls[0][1].body)).messages.map((m: { role: string }) => m.role)).toEqual(['user', 'assistant', 'user']);
  });

  it('Gemini araç döngüsü: aracı çalıştırır, sonucu modele verir, kullanılan aracı bildirir', async () => {
    process.env.ASTRA_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test';
    const toolData = JSON.parse(JSON.stringify(buildToolData(makeDemoState())));
    const f = vi
      .fn(async (_url: string, _init: RequestInit) =>
        Response.json({ candidates: [{ content: { parts: [{ text: "Kerem's CO₂ partial pressure is 3.4 mmHg." }] } }] }),
      )
      .mockImplementationOnce(async () =>
        Response.json({ candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'get_crew_member', args: { ad: 'Kerem' } }, thoughtSignature: 'imza' }] } }] }),
      );
    vi.stubGlobal('fetch', f);
    const res = await handler.fetch(post({ mode: 'chat', question: 'Why is Kerem at warning level?', context: {}, toolData }));
    const out = (await res.json()) as { text: string; tools: { ad: string; girdi: Record<string, unknown> }[]; toolOutput: string };
    expect(out.text).toContain('3.4 mmHg');
    expect(out.tools).toEqual([{ ad: 'get_crew_member', girdi: { ad: 'Kerem' } }]);
    expect(out.toolOutput).toContain('Kerem');
    const first = JSON.parse(String(f.mock.calls[0][1].body));
    expect(first.tools[0].functionDeclarations).toHaveLength(TOOLS.length);
    expect(first.systemInstruction.parts[0].text).toContain('get_metric_trend');
    const second = JSON.parse(String(f.mock.calls[1][1].body));
    expect(second.contents.at(-2).parts[0].thoughtSignature).toBe('imza'); // imza aynen geri gider
    expect(second.contents.at(-1).parts[0].functionResponse.name).toBe('get_crew_member');
  });

  it('Gemini araç tanımlarını reddederse araçsız ve ayrıntılı veriyle tekrar sorar', async () => {
    process.env.ASTRA_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const toolData = JSON.parse(JSON.stringify(buildToolData(makeDemoState())));
    const f = vi
      .fn(async (_url: string, _init: RequestInit) => Response.json({ candidates: [{ content: { parts: [{ text: 'Answer.' }] } }] }))
      .mockImplementationOnce(async () => new Response('{"error":{"message":"Invalid function declaration"}}', { status: 400 }));
    vi.stubGlobal('fetch', f);
    const res = await handler.fetch(post({ mode: 'chat', question: 'How is Kerem?', context: { ozet: 1 }, toolData }));
    expect(res.status).toBe(200);
    const retry = JSON.parse(String(f.mock.calls[1][1].body));
    expect(retry.tools).toBeUndefined();
    expect(retry.systemInstruction.parts[0].text).toContain('"ayrinti"');
  });

  it('Claude araç döngüsü: tool_use -> tool_result -> metin', async () => {
    process.env.ASTRA_PROVIDER = 'claude';
    process.env.ANTHROPIC_API_KEY = 'test';
    const toolData = JSON.parse(JSON.stringify(buildToolData(makeDemoState())));
    const c = vi
      .fn(async (_url: string, _init: RequestInit) => Response.json({ content: [{ type: 'text', text: 'The career limit is 600 mSv.' }] }))
      .mockImplementationOnce(async () =>
        Response.json({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'lookup_reference', input: { konu: 'radyasyon' } }] }),
      );
    vi.stubGlobal('fetch', c);
    const res = await handler.fetch(post({ mode: 'chat', question: 'What is the radiation limit?', context: {}, toolData }));
    const out = (await res.json()) as { text: string; tools: { ad: string }[] };
    expect(out.text).toContain('600 mSv');
    expect(out.tools[0].ad).toBe('lookup_reference');
    const first = JSON.parse(String(c.mock.calls[0][1].body));
    expect(first.tools).toHaveLength(TOOLS.length);
    const second = JSON.parse(String(c.mock.calls[1][1].body));
    expect(second.messages.at(-1).content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 't1' });
  });

  it('olay açıklamasında araç kullanılmaz (hız için tek adım)', async () => {
    process.env.ASTRA_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test';
    const f = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ candidates: [{ content: { parts: [{ text: 'Explanation.' }] } }] }));
    vi.stubGlobal('fetch', f);
    await handler.fetch(post({ mode: 'incident', question: 'Event', context: {}, toolData: { murettebat: {} } }));
    expect(JSON.parse(String(f.mock.calls[0][1].body)).tools).toBeUndefined();
  });

  it('Claude: "thinking" alanı reddedilirse onsuz tekrar dener', async () => {
    process.env.ASTRA_PROVIDER = 'claude';
    process.env.ANTHROPIC_API_KEY = 'test';
    const f = vi
      .fn(async (_url: string, _init: RequestInit) => Response.json({ content: [{ type: 'text', text: 'Hello.' }] }))
      .mockImplementationOnce(async () => new Response('{"error":{"message":"thinking: unsupported"}}', { status: 400 }));
    vi.stubGlobal('fetch', f);
    const res = await handler.fetch(post({ mode: 'chat', question: 'Hello', context: {} }));
    expect(((await res.json()) as { source: string }).source).toBe('claude');
    expect(f).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(f.mock.calls[1][1].body)).thinking).toBeUndefined();
  });
});
