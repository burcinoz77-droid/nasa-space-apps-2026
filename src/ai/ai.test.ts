/// <reference types="node" />
// Part 4 · Layer 2 tests. Run with: npm run test
// The language model is not called (fetch is mocked); for a live model test see astra.live.test.ts
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

describe('context.ts · data summary', () => {
  it('sends 8 key metrics for a nominal person and all metrics for anyone named in the question', () => {
    const s = runSimulation(3);
    const ctx = buildContext(s, { question: 'Kerem neden kritik?' });
    expect(Object.keys(crewOf(ctx, 'Elif').olcumler)).toHaveLength(KEY_METRICS.length);
    expect(Object.keys(crewOf(ctx, 'Kerem').olcumler).length).toBeGreaterThan(30);
  });

  it('includes the career limit, CO₂ limits and delay constants', () => {
    const ctx = buildContext(runSimulation(1));
    const json = JSON.stringify(ctx);
    expect(json).toContain('"kariyerDozLimiti_mSv":600');
    expect(json).toContain('"co2KritikSiniri_mmHg":3');
    expect(json).toContain('12 min 30 s');
    expect(json).toContain('"gurultuSiniri_dBA":{"calisma16sa":72,"uyku8sa":62}');
    expect(json).toContain('6–9% (NASA: 1–1.5% per month; an estimate, not a measurement)');
  });

  it(`stays under ${MAX_CONTEXT_TOKENS} tokens even if everyone is at Warning`, () => {
    const s = runSimulation(3);
    const statuses = Object.fromEntries(
      Object.entries(s.statuses).map(([id, st]) => [id, { ...st, level: 'critical' } as CrewStatus]),
    );
    useAstra.setState({ statuses });
    const ctx = buildContext(useAstra.getState(), { question: 'Herkes nasıl?' });
    expect(estimateTokens(ctx)).toBeLessThan(MAX_CONTEXT_TOKENS);
  });

  it('an incident explanation adds all metrics of the people in the incident and the incident itself', () => {
    const s = makeDemoState();
    const ctx = buildContext(s, { incident: s.incidents[0] });
    expect(ctx.olayId).toBe(s.incidents[0].id);
    expect(Object.keys(crewOf(ctx, 'Zeynep').olcumler).length).toBeGreaterThan(30);
  });
});

describe('verify.ts · number verification', () => {
  const ctx = { nabiz: 68, sicaklik: 37.4, co2: 3.4 };
  it('accepts numbers present in the data (also in Turkish format)', () => {
    expect(verifyNumbers("Elif'in nabzı 68 bpm, sıcaklığı 37,4 °C, CO₂ 3,4 mmHg.", ctx)).toBe(true);
  });
  it('catches a made-up number', () => {
    expect(verifyNumbers("Elif'in nabzı 120 bpm.", ctx)).toBe(false);
  });
  it('does not count a number from the question as made up', () => {
    expect(verifyNumbers('Son 3 günde değer değişmedi: 68 bpm.', ctx, 'Son 3 günde nabız?')).toBe(true);
  });
});

describe('safety.ts · safety filter', () => {
  // Realistic ASTRA answers: none should be blocked. If a new false block shows up, add it here.
  const SHOULD_PASS = [
    // Live Gemini answer from 14 November 23:15; the old filter blocked it by mistake because of the word "diagnosis"
    "Elif ve Kerem'in CO₂ kısmi basıncı 2,6 mmHg ile kişisel normali olan 1,9 mmHg'nin üzerine çıkmıştır; bu durum CO₂ birikmesine bağlı etkilenme (hiperkapni) olasılığını düşündürmektedir. Zeynep'in CO₂ kısmi basıncı ise 2,5 mmHg olup kişisel normalinin üzerindedir ve benzer bir etki açısından düşük olasılık taşımaktadır. Bu değerlendirmeler kesin bir teşhis olmayıp, medikal kontrol ve uçuş doktoru değerlendirmesi gereklidir. Diğer mürettebat üyelerinin verilerinde belirgin bir sapma görünmemektedir.",
    "Kesin bir teşhis koyamam; ancak Mert'in çekirdek sıcaklığı 38,3 °C ile kişisel normali olan 37,9 °C'nin üzerine çıkmıştır. Bu değişiklikler ısı stresi ve aşırı eforla uyumlu olabilir. Bu bir olasılıktır, kesin değildir; medikal kontrol önerilir.",
    'İlaç öneremem; bu karar uçuş doktorunundur. Bu konuda uçuş doktoruna danışmayı öneririm.',
    'İlaç ya da doz önerisi için uçuş doktoruna danışmanız gerekir.',
    'Bu verilerle kalp krizi geçirip geçirmediğini söyleyemem; göğüs ağrısı gibi bir belirti varsa hemen uçuş doktoruna bildirin.',
    "Mert'in kalp krizi geçirip geçirmediğini bu verilerle doğrulayamam.",
    "EKG'de düzensiz atımlar görülmektedir; bu durum kalp ritim düzensizliği olasılığını düşündürebilir, medikal kontrol önerilir.",
    'Kokpit doz hızı 76,7 µSv/sa, toplam doz 331 mSv; kariyer limiti 600 mSv.',
    'Kortizol 40 ng/mL, CO₂ 3,4 mmHg.',
    'Elif için dinlenme önerilir; kritik görevlerin devredilmesi uygun olur.',
    'Bu bir teşhis değildir; yalnızca verilerdeki değişikliklere dayanan bir değerlendirmedir.',
    'Hipoksi belirtisi görünmüyor; SpO₂ %98.',
    'Sıvı alımının artırılması ve eforun azaltılması önerilir.',
    "Kerem'in ortamındaki CO₂ kısmi basıncı 3,4 mmHg olup hiperkapni riski taşımaktadır; havalandırma artırılmıştır.",
    'Bu tablo dehidratasyon eğilimini düşündürüyor, ancak kesin değildir.',
    'İlacın etkisini değerlendirmek uçuş doktorunun işidir.',
    'Teşhis yerine geçmez; medikal kontrol için uçuş doktoruna danışın.',
    'Bu öneri ilaç için değil, kabin havası içindir.',
    'Merhaba, ben ASTRA; ARES-1 mürettebatının sağlık karar destek asistanıyım.',
  ];
  // Genuinely dangerous: all must be blocked.
  const SHOULD_BLOCK = [
    "Elif'e 400 mg ibuprofen verin.",
    'Kerem ağrı kesici alsın ve dinlensin.',
    "Mert'e ateş düşürücü verilmeli.",
    "Kerem'e antibiyotik başlanmalı.",
    'Dozu alın ve dinlenin.',
    "Kerem'de hipoksi var.",
    'Mert kesinlikle kalp krizi geçiriyor.',
    'Endişelenmeyin, bu kalp krizi değil.',
    "Elif'te aritmi yok, rahat olabilirsiniz.",
    "Mert'te dehidratasyon var, hemen su içsin.",
  ];

  it.each(SHOULD_PASS)('geçmeli: %s', (text) => expect(checkAnswer(text)).toEqual({ safe: true }));
  it.each(SHOULD_BLOCK)('engellemeli: %s', (text) => expect(checkAnswer(text).safe).toBe(false));

  it('all offline-mode answers pass the filter', () => {
    makeDemoState();
    for (const q of [...QUESTIONS, "Mert'te ne olabilir?", 'Kerem hasta mı?', 'Elif kalp krizi mi geçiriyor?']) {
      expect(checkAnswer(fallbackAnswer({ mode: 'chat', question: q, context: {} }).text)).toEqual({ safe: true });
    }
  });
});

describe('fallback.ts · offline mode, 10 test questions', () => {
  beforeEach(() => makeDemoState());

  it.each(QUESTIONS.map((q, i) => [i + 1, q] as const))('soru %i: %s', (i, q) => {
    const a = fallbackAnswer({ mode: 'chat', question: q, context: {} });
    expect(a.source).toBe('fallback');
    expect(a.text.length).toBeGreaterThan(10);
    expect(countSentences(a.text)).toBeLessThanOrEqual(4);
    expect(checkAnswer(a.text).safe).toBe(true);
    expect(a.text).toMatch(EXPECTED[i - 1].check);
  });

  it('who should rest: Elif, placed on mandatory crew rest, comes first', () => {
    expect(fallbackAnswer({ mode: 'chat', question: QUESTIONS[0], context: {} }).text).toMatch(/Layer 1 has applied mandatory crew rest: Elif/);
  });

  it('Elif\'s heart rate is the same number as on screen', () => {
    const hr = Math.round(useAstra.getState().telemetry.elif!.cardio.hr_bpm);
    expect(fallbackAnswer({ mode: 'chat', question: QUESTIONS[2], context: {} }).text).toContain(`${hr} bpm`);
  });

  it('why Kerem is at Warning: the real CO₂ value and the autonomous action', () => {
    const t = fallbackAnswer({ mode: 'chat', question: QUESTIONS[1], context: {} }).text;
    expect(t).toContain('3.4 mmHg');
    expect(t).toMatch(/ventilation/i);
  });

  it('replies to a greeting with a formal introduction, without listing data', () => {
    const t = fallbackAnswer({ mode: 'chat', question: 'Hello', context: {} }).text;
    expect(t).toMatch(/^Hello, I am ASTRA/);
    expect(t).not.toMatch(/\d+ (bpm|mmHg|°C)/);
  });

  it('understands "And Kerem?" as Kerem\'s status', () => {
    expect(fallbackAnswer({ mode: 'chat', question: 'And Kerem?', context: {} }).text).toMatch(/^Kerem's status is warning/);
  });

  it('answers even without telemetry', () => {
    useAstra.getState().clearAll();
    expect(fallbackAnswer({ mode: 'chat', question: 'How is Elif?', context: {} }).text).toMatch(/telemetry/);
  });
});

describe('fallback.ts · incident explanation templates', () => {
  const types: IncidentType[] = ['RADIATION', 'CO2', 'CARDIO', 'HYPOXIA', 'THERMAL', 'FATIGUE', 'STRESS', 'MULTI'];
  it.each(types)('%s', (type) => {
    runSimulation(3);
    const inc = fakeIncident(type, ['mert'], [], type === 'RADIATION' ? ['RADIATION_SHELTER'] : []);
    useAstra.setState({ incidents: [inc] });
    const a = fallbackAnswer({ mode: 'incident', question: 'Olay', context: { olayId: inc.id } });
    expect(a.text).toContain('Mert');
    expect(countSentences(a.text)).toBeLessThanOrEqual(4);
    expect(checkAnswer(a.text).safe).toBe(true);
  });

  it('returns a general safe text if the incident is not found', () => {
    expect(fallbackAnswer({ mode: 'incident', question: 'x', context: { olayId: 'yok' } }).text).toMatch(/Layer 1/);
  });
});

describe('client.ts · askAstra', () => {
  beforeEach(() => {
    makeDemoState();
    clearAstraCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  const req = () => {
    const question = "Elif'in nabzı kaç?";
    return { mode: 'chat' as const, question, context: buildContext(useAstra.getState(), { question }) };
  };
  const reply = (body: unknown, status = 200) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

  it('returns the model answer with the source and verification badge', async () => {
    const hr = Math.round(useAstra.getState().telemetry.elif!.cardio.hr_bpm);
    vi.stubGlobal('fetch', reply({ text: `Elif'in kalp atış hızı ${hr} bpm; kişisel normaline yakın.`, source: 'gemini' }));
    const a = await askAstra(req());
    expect(a.source).toBe('gemini');
    expect(a.verified).toBe(true);
  });

  it('gives a "check" badge for a made-up number', async () => {
    vi.stubGlobal('fetch', reply({ text: "Elif'in nabzı 187 bpm.", source: 'gemini' }));
    expect((await askAstra(req())).verified).toBe(false);
  });

  it('does not show an answer that recommends medication, switches to the offline answer and marks the reason as "safety"', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', reply({ text: "Elif'e 200 mg ibuprofen verin.", source: 'gemini' }));
    const a = await askAstra(req());
    expect(a.source).toBe('fallback');
    expect(a.fallbackReason).toBe('safety');
    expect(a.text).not.toMatch(/ibuprofen/);
  });

  it('does not block a good answer worded as a possibility', async () => {
    vi.stubGlobal(
      'fetch',
      reply({ text: 'Bu değişiklikler hiperkapni olasılığını düşündürmektedir; bu değerlendirme kesin bir teşhis olmayıp medikal kontrol gereklidir.', source: 'gemini' }),
    );
    const a = await askAstra(req());
    expect(a.source).toBe('gemini');
    expect(a.fallbackReason).toBeUndefined();
  });

  it('switches to offline mode on a server error and with no connection', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', reply({ error: 'x' }, 503));
    const a = await askAstra(req());
    expect(a.source).toBe('fallback');
    expect(a.fallbackReason).toBe('connection');
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    expect((await askAstra({ ...req(), question: 'Kerem nasıl?' })).source).toBe('fallback');
  });

  it('sends the latest chat messages to the server (for follow-up questions)', async () => {
    const { addChat } = useAstra.getState();
    addChat({ id: '1', role: 'user', text: "Elif'in nabzı kaç?", at: 1 });
    addChat({ id: '2', role: 'astra', text: "Elif'in kalp atış hızı 69 bpm.", at: 2 });
    addChat({ id: '3', role: 'user', text: 'Peki Kerem?', at: 3 });
    const f = reply({ text: "Kerem'in kalp atış hızı 82 bpm.", source: 'gemini' });
    vi.stubGlobal('fetch', f);
    await askAstra({ mode: 'chat', question: 'Peki Kerem?', context: {} });
    const body = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.history).toEqual([
      { role: 'user', text: "Elif'in nabzı kaç?" },
      { role: 'astra', text: "Elif'in kalp atış hızı 69 bpm." },
    ]);
  });

  it('shows the tools used with English labels; counts a number read by a tool as verified', async () => {
    vi.stubGlobal(
      'fetch',
      reply({
        text: 'Kariyer limiti 600 mSv; toplam doz 480 mSv olunca dikkat olayı açılır.',
        source: 'gemini',
        tools: [{ ad: 'lookup_reference', girdi: { konu: 'radyasyon' } }],
        toolOutput: '[{"bilgi":"Kariyer radyasyon limiti 600 mSv. ... 480 mSv ..."}]',
      }),
    );
    const a = await askAstra({ mode: 'chat', question: 'Radyasyon limiti ne?', context: {} });
    expect(a.tools).toEqual(['Reference lookup · radyasyon']);
    expect(a.verified).toBe(true);
    expect(a.sources?.[0]).toMatchObject({ ad: expect.stringMatching(/NASA-STD-3001/), url: expect.stringMatching(/^https:\/\//) });
  });

  it('offline answers also come with source links', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ağ yok')));
    const a = await askAstra({ mode: 'chat', question: 'CO₂ güvenli mi?', context: {} });
    expect(a.source).toBe('fallback');
    expect(a.sources?.map((x) => x.ad)).toContain('OCHMO-TB-004 CO₂');
  });

  it('sends the tool data with the chat request', async () => {
    const f = reply({ text: 'Tamam.', source: 'gemini' });
    vi.stubGlobal('fetch', f);
    await askAstra({ mode: 'chat', question: 'Mert nasıl?', context: {} });
    const body = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(Object.keys(body.toolData.murettebat)).toHaveLength(6);
    expect(body.toolData.bilgi.length).toBeGreaterThan(5);
  });

  it('the same question within 60 s comes from the cache', async () => {
    const f = reply({ text: 'Merhaba, ben ASTRA.', source: 'gemini' });
    vi.stubGlobal('fetch', f);
    const r = req();
    await askAstra(r);
    expect((await askAstra(r)).source).toBe('cache');
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe('explain.ts · incident explanation', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks the model once for the same incident and writes to the explanations field', async () => {
    const s = makeDemoState();
    clearAstraCache();
    const id = s.incidents[0].id;
    const f = vi.fn(async () => Response.json({ text: 'Kabin CO₂ kısmi basıncı 3,4 mmHg; havalandırma artırıldı.', source: 'gemini' }));
    vi.stubGlobal('fetch', f);
    requestExplanation(id);
    requestExplanation(id); // the second screen shows the same incident
    await vi.waitFor(() => expect(useAstra.getState().explanations[id]).toBeDefined());
    expect(f).toHaveBeenCalledTimes(1);
    expect(useAstra.getState().explanations[id]).toMatchObject({ source: 'gemini', verified: true });
  });

  it('the incident question gives the signals with value and personal baseline', () => {
    const s = makeDemoState();
    expect(incidentQuestion(s.incidents[0])).toContain('3.4 mmHg (personal baseline 1.9 mmHg)');
  });
});

describe('Tools (tool calling) · read-only tools', () => {
  const data = () => {
    const s = makeDemoState();
    // While Layer 1 is still building its 30-reading baseline the history can be short; the tool must still answer.
    return JSON.parse(JSON.stringify(buildToolData(s)));
  };

  it('10 tools are defined and each has a description', () => {
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

  it('get_crew_member: recognizes the name flexibly, returns all metrics and open incidents', () => {
    const r = runTool('get_crew_member', { ad: "Kerem'in" }, data()) as { ad: string; olcumler: unknown[]; acikOlaylar: unknown[] };
    expect(r.ad).toBe('Kerem');
    expect(r.olcumler.length).toBe(METRICS.length);
    expect(r.acikOlaylar.length).toBe(1);
    expect(runTool('get_crew_member', { ad: 'Kenji' }, data())).toMatchObject({ hata: expect.stringMatching(/No astronaut/) });
  });

  it('get_metric_trend: finds the right metric from a Turkish metric name', () => {
    runSimulation(40);
    const td = JSON.parse(JSON.stringify(buildToolData(useAstra.getState())));
    const r = runTool('get_metric_trend', { ad: 'Elif', olcum: 'nabız' }, td) as {
      olcum: string;
      kisiselNormal: number;
      yakinDonem: { degerler: number[]; yon: string };
      uzunDonem: { degerler: number[]; kapsam_saat: number };
    };
    expect(r.olcum).toBe('Heart rate');
    expect(r.kisiselNormal).toBeGreaterThan(40);
    expect(r.yakinDonem.degerler.length).toBeGreaterThan(2);
    expect(['rising', 'falling', 'stable']).toContain(r.yakinDonem.yon);
    expect(r.uzunDonem.degerler.length).toBeGreaterThan(2);
    expect(r.uzunDonem.kapsam_saat).toBeGreaterThan(0);
    expect((runTool('get_metric_trend', { ad: 'Elif', olcum: 'toplam doz' }, td) as { olcum: string }).olcum).toBe('Cumulative radiation dose');
    expect((runTool('get_metric_trend', { ad: 'Elif', olcum: 'CO₂' }, td) as { olcum: string }).olcum).toBe('CO₂ partial pressure');
  });

  it('get_metric_trend: says "not in the data" for a metric that is not in the data', () => {
    expect(runTool('get_metric_trend', { ad: 'Deniz', olcum: 'kemik yoğunluğu' }, data())).toMatchObject({ hata: 'This metric is not in the data.' });
  });

  it('list_incidents, get_event_log, lookup_reference', () => {
    const d = data();
    expect((runTool('list_incidents', {}, d) as { olaylar: unknown[] }).olaylar).toHaveLength(1);
    expect(runTool('get_event_log', { adet: 3 }, d)).toHaveProperty('kayit');
    const ref = runTool('lookup_reference', { konu: 'CO2' }, d) as { konu: string; bilgiler: { kaynak: string }[] };
    expect(ref.konu).toBe('co2');
    expect(ref.bilgiler.some((b) => /OCHMO/.test(b.kaynak))).toBe(true);
    expect((runTool('lookup_reference', { konu: 'radyasyon' }, d) as { bilgiler: { bilgi: string }[] }).bilgiler[0].bilgi).toMatch(/600 mSv/);
  });
});

describe('Source links (sources.ts)', () => {
  it('picks the right sources for the topic of the question, does not add unrelated ones', () => {
    const noise = answerSources('Kabin gürültüsü normal mi?', 'Ortam gürültüsü: Elif 55 dBA. Tüm değerler resmi normal aralıkta (en fazla 72 dBA).');
    expect(noise.map((x) => x.ad).join(' ')).toMatch(/Acoustics/);
    expect(noise.map((x) => x.ad).join(' ')).not.toMatch(/NIH|Pulse/);
    expect(answerSources('Kemik kaybı ne durumda?', 'Kemik yoğunluğu ölçülmüyor. Bu konuda uçuş doktoruna danışmayı öneririm.').map((x) => x.ad)).toEqual([
      'NASA HRP, risk of bone changes',
    ]);
    // the "nem" (humidity) inside the Turkish word "önemli" must not trigger the environment topic
    expect(answerSources('Bu önemli mi?', 'Merhaba.')).toEqual([]);
    for (const x of answerSources('Radyasyon durumu nasıl?', 'Kariyer limiti 600 mSv.')) expect(x.url).toMatch(/^https:\/\//);
  });
});

describe('New metrics (environment) and topics the system does not measure', () => {
  it('ambient temperature, humidity and noise are in every astronaut\'s data and within the NASA range', () => {
    const s = runSimulation(40);
    for (const t of Object.values(s.telemetry)) {
      expect(t.env.ambientTemp_C).toBeGreaterThanOrEqual(20);
      expect(t.env.ambientTemp_C).toBeLessThanOrEqual(25);
      expect(t.env.humidity_pct).toBeGreaterThanOrEqual(30);
      expect(t.env.humidity_pct).toBeLessThanOrEqual(60);
      expect(t.env.noise_dBA).toBeLessThan(62);
    }
  });

  it('the tools find the new metrics by their Turkish names', () => {
    runSimulation(40);
    const td = JSON.parse(JSON.stringify(buildToolData(useAstra.getState())));
    expect((runTool('get_metric_trend', { ad: 'Elif', olcum: 'gürültü' }, td) as { olcum: string }).olcum).toBe('Ambient noise');
    expect((runTool('get_metric_trend', { ad: 'Elif', olcum: 'kabin sıcaklığı' }, td) as { olcum: string }).olcum).toBe('Ambient temperature');
    expect((runTool('get_metric_trend', { ad: 'Elif', olcum: 'vücut ısısı' }, td) as { olcum: string }).olcum).toBe('Core temperature');
    expect((runTool('lookup_reference', { konu: 'kemik' }, td) as { konu: string }).konu).toBe('kemik');
    expect((runTool('lookup_reference', { konu: 'gürültü' }, td) as { konu: string }).konu).toBe('ortam');
    expect((runTool('lookup_reference', { konu: 'SANS' }, td) as { konu: string }).konu).toBe('goz');
  });

  it('the bone loss estimate is computed from the mission day', () => {
    expect(boneLossEstimate(180)).toBe('6–9%');
    expect(boneLossEstimate(30)).toBe('1%');
  });

  it('offline mode: does not make things up on unmeasured topics, says they are not measured and gives NASA information', () => {
    makeDemoState();
    const ask = (q: string) => fallbackAnswer({ mode: 'chat', question: q, context: {} }).text;
    const bone = ask("How is Kerem's bone loss?");
    expect(bone).toMatch(/not measured/);
    expect(bone).toContain('1–1.5%');
    expect(bone).toContain('6–9%');
    expect(ask('How is the immune system?')).toMatch(/not measured/);
    expect(ask('How is team cohesion?')).toMatch(/not measured/);
    expect(ask('Is there a SANS risk?')).toMatch(/not measured/);
    expect(ask("How is Mert's electrolyte balance?")).not.toMatch(/vestibular/);
    expect(ask('What is the noise in the cockpit?')).toMatch(/dBA/);
    expect(ask('Is cabin noise normal?')).toMatch(/within the reference range \(up to 72 dBA\)/);
    for (const q of ["How is Kerem's bone loss?", 'Is there a SANS risk?', 'What is the noise in the cockpit?']) {
      expect(checkAnswer(ask(q))).toEqual({ safe: true });
    }
  });
});

describe('conditions.ts · possible conditions (not a definitive diagnosis)', () => {
  it('on a nominal day no possible condition comes up for anyone over 200 readings (no false alarm)', () => {
    const s = runSimulation(40, 'NORMAL', 160);
    for (const id of ['elif', 'kerem', 'zeynep', 'emir', 'deniz', 'mert'] as const) expect(possibleConditions(s, id)).toEqual([]);
  });

  it('hypercapnia possibility for Kerem in the CO₂ failure, heat stress possibility for Mert in EVA overexertion', () => {
    let s = runSimulation(40, 'CO2_SCRUBBER_FAIL', 30);
    expect(possibleConditions(s, 'kerem')[0].durum).toMatch(/hypercapni/);
    s = runSimulation(40, 'EVA_OVEREXERTION', 30);
    const mert = possibleConditions(s, 'mert');
    expect(mert[0].durum).toMatch(/Heat stress/);
    expect(mert[0].dayanak.join(' ')).toMatch(/Core temperature .* \(personal baseline/);
    expect(['low', 'medium']).toContain(mert[0].olasilik);
  });

  it('the assess_possible_conditions tool returns possible conditions and the "not definitive" notice', () => {
    runSimulation(40, 'EVA_OVEREXERTION', 30);
    const td = JSON.parse(JSON.stringify(buildToolData(useAstra.getState())));
    const r = runTool('assess_possible_conditions', { ad: 'Mert' }, td) as { olasiDurumlar: { durum: string }[]; uyari: string };
    expect(r.olasiDurumlar[0].durum).toMatch(/Heat stress/);
    expect(r.uyari).toMatch(/not certain/);
    expect(toolLabel({ ad: 'assess_possible_conditions', girdi: { ad: 'Mert' } })).toBe('Possible conditions · Mert');
  });

  it('in offline mode answers an illness question with the changed values + possibility wording', () => {
    runSimulation(40, 'EVA_OVEREXERTION', 30);
    const t = fallbackAnswer({ mode: 'chat', question: "Mert'te ne olabilir?", context: {} }).text;
    expect(t).toMatch(/^I cannot give a definitive diagnosis; however, for Mert the readings are core temperature/);
    expect(t).toMatch(/may be consistent with heat stress and overexertion/);
    expect(t).toMatch(/not a certainty/);
    expect(checkAnswer(t).safe).toBe(true);
    expect(countSentences(t)).toBeLessThanOrEqual(4);
  });
});

describe('memory.ts · long-term memory', () => {
  it('builds the personal baseline over the first 30 readings and remembers further back than the short history on screen', () => {
    runSimulation(200);
    expect(baselineReady()).toBe(true);
    expect(personalNormal('elif', 'cardio.hr_bpm')!.mean).toBeGreaterThan(40);
    expect(longHistory('elif', 'cardio.hr_bpm').length).toBeGreaterThan(30); // 200 readings / 5
    expect(longHistorySpanHours()).toBeGreaterThan(20); // 120-reading screen history = 20 hours
  });

  it('"Reset simulation" also resets the memory', () => {
    runSimulation(40);
    useAstra.getState().clearAll();
    expect(baselineReady()).toBe(false);
    expect(longHistory('elif', 'cardio.hr_bpm')).toEqual([]);
  });
});

describe('chatStore.ts · reset chat', () => {
  it('clears the chat', () => {
    useAstra.getState().addChat({ id: 'x', role: 'user', text: 'Merhaba', at: 1 });
    resetChat();
    expect(useAstra.getState().chat).toEqual([]);
  });
});

describe('api/astra.ts · server function', () => {
  const post = (body: unknown) =>
    new Request('http://localhost/api/astra', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    vi.unstubAllGlobals();
  });

  it('GET is rejected, an empty question is rejected', async () => {
    expect((await handler.fetch(new Request('http://localhost/api/astra'))).status).toBe(405);
    expect((await handler.fetch(post({ mode: 'chat', question: ' ', context: {} }))).status).toBe(400);
  });

  it('returns 503 without calling the model if there is no key', async () => {
    process.env.ASTRA_PROVIDER = 'gemini';
    delete process.env.GEMINI_API_KEY;
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect((await handler.fetch(post({ mode: 'chat', question: 'Merhaba', context: {} }))).status).toBe(503);
    expect(f).not.toHaveBeenCalled();
  });

  it('Gemini: puts the data in the system instruction, drops thought parts', async () => {
    process.env.ASTRA_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test';
    const f = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({ candidates: [{ content: { parts: [{ text: 'düşünce', thought: true }, { text: 'Merhaba, ben ASTRA.' }] } }] }),
    );
    vi.stubGlobal('fetch', f);
    const res = await handler.fetch(post({ mode: 'chat', question: 'Merhaba', context: { gorevGunu: 180 } }));
    const data = (await res.json()) as { text: string; source: string };
    expect(data).toMatchObject({ text: 'Merhaba, ben ASTRA.', source: 'gemini' });
    const sent = JSON.parse(String(f.mock.calls[0][1].body));
    expect(sent.systemInstruction.parts[0].text).toContain('"gorevGunu":180');
  });

  it('Gemini: switches to the backup model if the model is overloaded (503)', async () => {
    process.env.ASTRA_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test';
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_FALLBACK_MODELS;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = vi
      .fn(async (_url: string, _init: RequestInit) => Response.json({ candidates: [{ content: { parts: [{ text: 'Yedek modelden cevap.' }] } }] }))
      .mockImplementationOnce(async () => new Response('{"error":{"code":503,"message":"high demand"}}', { status: 503 }));
    vi.stubGlobal('fetch', f);
    const res = await handler.fetch(post({ mode: 'chat', question: 'Merhaba', context: {} }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { text: string }).text).toBe('Yedek modelden cevap.');
    expect(f.mock.calls[0][0]).toContain('gemini-3.8-flash');
    expect(f.mock.calls[1][0]).toContain('gemini-3.5-flash-lite');
  });

  it('Gemini: if the model never answers, moves to the next model when the timeout expires', async () => {
    process.env.ASTRA_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test';
    process.env.GEMINI_MODEL_TIMEOUT_MS = '50';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = vi
      .fn(async (_url: string, _init: RequestInit) => Response.json({ candidates: [{ content: { parts: [{ text: 'Hızlı modelden cevap.' }] } }] }))
      .mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
      );
    vi.stubGlobal('fetch', f);
    const res = await handler.fetch(post({ mode: 'chat', question: 'Merhaba', context: {} }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { text: string }).text).toBe('Hızlı modelden cevap.');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('Gemini: returns 502 if all models are overloaded (the client switches to offline mode); no backup model is tried on a key error', async () => {
    process.env.ASTRA_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const busy = vi.fn(async (_url: string, _init: RequestInit) => new Response('{"error":{"code":503}}', { status: 503 }));
    vi.stubGlobal('fetch', busy);
    expect((await handler.fetch(post({ mode: 'chat', question: 'Merhaba', context: {} }))).status).toBe(502);
    expect(busy).toHaveBeenCalledTimes(3);

    const badKey = vi.fn(async (_url: string, _init: RequestInit) => new Response('{"error":{"code":400,"message":"API key not valid"}}', { status: 400 }));
    vi.stubGlobal('fetch', badKey);
    expect((await handler.fetch(post({ mode: 'chat', question: 'Merhaba', context: {} }))).status).toBe(502);
    expect(badKey).toHaveBeenCalledTimes(1);
  });

  it('passes the previous conversation to the model in order; ignores a corrupt history', async () => {
    process.env.ASTRA_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test';
    const f = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ candidates: [{ content: { parts: [{ text: 'Tamam.' }] } }] }));
    vi.stubGlobal('fetch', f);
    const history = [
      { role: 'astra', text: 'başta asistan mesajı atılır' },
      { role: 'user', text: "Elif'in nabzı kaç?" },
      { role: 'astra', text: '69 bpm.' },
      42,
    ];
    await handler.fetch(post({ mode: 'chat', question: 'Peki Kerem?', context: {}, history }));
    const sent = JSON.parse(String(f.mock.calls[0][1].body));
    expect(sent.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user']);
    expect(sent.contents[2].parts[0].text).toBe('Peki Kerem?');

    process.env.ASTRA_PROVIDER = 'claude';
    process.env.ANTHROPIC_API_KEY = 'test';
    const c = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ content: [{ type: 'text', text: 'Tamam.' }] }));
    vi.stubGlobal('fetch', c);
    await handler.fetch(post({ mode: 'chat', question: 'Peki Kerem?', context: {}, history }));
    expect(JSON.parse(String(c.mock.calls[0][1].body)).messages.map((m: { role: string }) => m.role)).toEqual(['user', 'assistant', 'user']);
  });

  it('Gemini tool loop: runs the tool, gives the result to the model, reports the tool used', async () => {
    process.env.ASTRA_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test';
    const toolData = JSON.parse(JSON.stringify(buildToolData(makeDemoState())));
    const f = vi
      .fn(async (_url: string, _init: RequestInit) => Response.json({ candidates: [{ content: { parts: [{ text: "Kerem'in CO₂ kısmi basıncı 3,4 mmHg." }] } }] }))
      .mockImplementationOnce(async () =>
        Response.json({ candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'get_crew_member', args: { ad: 'Kerem' } }, thoughtSignature: 'imza' }] } }] }),
      );
    vi.stubGlobal('fetch', f);
    const res = await handler.fetch(post({ mode: 'chat', question: 'Kerem neden kritik?', context: {}, toolData }));
    const out = (await res.json()) as { text: string; tools: { ad: string; girdi: Record<string, unknown> }[]; toolOutput: string };
    expect(out.text).toContain('3,4 mmHg');
    expect(out.tools).toEqual([{ ad: 'get_crew_member', girdi: { ad: 'Kerem' } }]);
    expect(out.toolOutput).toContain('Kerem');
    const first = JSON.parse(String(f.mock.calls[0][1].body));
    expect(first.tools[0].functionDeclarations).toHaveLength(TOOLS.length);
    expect(first.systemInstruction.parts[0].text).toContain('get_metric_trend');
    const second = JSON.parse(String(f.mock.calls[1][1].body));
    expect(second.contents.at(-2).parts[0].thoughtSignature).toBe('imza'); // the signature is sent back unchanged
    expect(second.contents.at(-1).parts[0].functionResponse.name).toBe('get_crew_member');
  });

  it('if Gemini rejects the tool definitions, asks again without tools and with detailed data', async () => {
    process.env.ASTRA_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const toolData = JSON.parse(JSON.stringify(buildToolData(makeDemoState())));
    const f = vi
      .fn(async (_url: string, _init: RequestInit) => Response.json({ candidates: [{ content: { parts: [{ text: 'Cevap.' }] } }] }))
      .mockImplementationOnce(async () => new Response('{"error":{"message":"Invalid function declaration"}}', { status: 400 }));
    vi.stubGlobal('fetch', f);
    const res = await handler.fetch(post({ mode: 'chat', question: 'Kerem nasıl?', context: { ozet: 1 }, toolData }));
    expect(res.status).toBe(200);
    const retry = JSON.parse(String(f.mock.calls[1][1].body));
    expect(retry.tools).toBeUndefined();
    expect(retry.systemInstruction.parts[0].text).toContain('"ayrinti"');
  });

  it('Claude tool loop: tool_use -> tool_result -> text', async () => {
    process.env.ASTRA_PROVIDER = 'claude';
    process.env.ANTHROPIC_API_KEY = 'test';
    const toolData = JSON.parse(JSON.stringify(buildToolData(makeDemoState())));
    const c = vi
      .fn(async (_url: string, _init: RequestInit) => Response.json({ content: [{ type: 'text', text: 'Kariyer limiti 600 mSv.' }] }))
      .mockImplementationOnce(async () =>
        Response.json({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'lookup_reference', input: { konu: 'radyasyon' } }] }),
      );
    vi.stubGlobal('fetch', c);
    const res = await handler.fetch(post({ mode: 'chat', question: 'Radyasyon limiti ne?', context: {}, toolData }));
    const out = (await res.json()) as { text: string; tools: { ad: string }[] };
    expect(out.text).toContain('600 mSv');
    expect(out.tools[0].ad).toBe('lookup_reference');
    const first = JSON.parse(String(c.mock.calls[0][1].body));
    expect(first.tools).toHaveLength(TOOLS.length);
    const second = JSON.parse(String(c.mock.calls[1][1].body));
    expect(second.messages.at(-1).content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 't1' });
  });

  it('no tools are used in an incident explanation (single step for speed)', async () => {
    process.env.ASTRA_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test';
    const f = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ candidates: [{ content: { parts: [{ text: 'Açıklama.' }] } }] }));
    vi.stubGlobal('fetch', f);
    await handler.fetch(post({ mode: 'incident', question: 'Olay', context: {}, toolData: { murettebat: {} } }));
    expect(JSON.parse(String(f.mock.calls[0][1].body)).tools).toBeUndefined();
  });

  it('Claude: retries without the "thinking" field if it is rejected', async () => {
    process.env.ASTRA_PROVIDER = 'claude';
    process.env.ANTHROPIC_API_KEY = 'test';
    const f = vi
      .fn(async (_url: string, _init: RequestInit) => Response.json({ content: [{ type: 'text', text: 'Merhaba.' }] }))
      .mockImplementationOnce(async () => new Response('{"error":{"message":"thinking: unsupported"}}', { status: 400 }));
    vi.stubGlobal('fetch', f);
    const res = await handler.fetch(post({ mode: 'chat', question: 'Merhaba', context: {} }));
    expect(((await res.json()) as { source: string }).source).toBe('claude');
    expect(f).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(f.mock.calls[1][1].body)).thinking).toBeUndefined();
  });
});

describe('safety.ts · English answers', () => {
  const BLOCK = ['Give Kerem 400 mg ibuprofen.', 'Mert should take a painkiller and rest.', 'Start antibiotics for Kerem.', 'Mert is definitely having a heart attack.', 'Do not worry, this is not a heart attack.', 'Mert has dehydration.'];
  const PASS = [
    'I cannot recommend medication; that decision belongs to the flight surgeon.',
    'These changes may be consistent with heat stress and overexertion. This is a possibility, not a certainty.',
    'I cannot confirm a life-threatening condition from this data; if there are symptoms, report them to the flight surgeon immediately.',
    'Increasing ventilation is recommended; re-check the value after a few readings.',
    'Layer 1 has applied mandatory crew rest: Elif (cognitive score 61%, sleep 6.6 h, PVT 260 ms).',
  ];
  it.each(BLOCK)('blocks: %s', (text) => expect(checkAnswer(text).safe).toBe(false));
  it.each(PASS)('passes: %s', (text) => expect(checkAnswer(text)).toEqual({ safe: true }));
});
