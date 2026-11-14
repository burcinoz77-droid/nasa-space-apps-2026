/// <reference types="node" />
// Parça 4 · Katman 2 testleri. Çalıştırma: npm run test
// Dil modeli çağrılmaz (fetch sahte); canlı model testi için: astra.live.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/astra';
import { useAstra } from '../store';
import type { CrewStatus, IncidentType } from '../types';
import { askAstra, clearAstraCache } from './client';
import { buildContext, estimateTokens, KEY_METRICS, MAX_CONTEXT_TOKENS } from './context';
import { incidentQuestion, requestExplanation } from './explain';
import { fallbackAnswer } from './fallback';
import { checkAnswer } from './safety';
import { countSentences, EXPECTED, fakeIncident, makeDemoState, QUESTIONS, runSimulation } from './testing';
import { verifyNumbers } from './verify';

type Crew = { ad: string; olcumler: Record<string, unknown> };
const crewOf = (ctx: Record<string, unknown>, ad: string) => (ctx.murettebat as Crew[]).find((c) => c.ad === ad)!;

describe('context.ts · veri özeti', () => {
  it('normal kişiye 8 ana ölçüm, soruda adı geçene tüm ölçümler gönderir', () => {
    const s = runSimulation(3);
    const ctx = buildContext(s, { question: 'Kerem neden kritik?' });
    expect(Object.keys(crewOf(ctx, 'Elif').olcumler)).toHaveLength(KEY_METRICS.length);
    expect(Object.keys(crewOf(ctx, 'Kerem').olcumler).length).toBeGreaterThan(30);
  });

  it('kariyer limiti, CO₂ sınırları ve gecikme sabitlerini içerir', () => {
    const ctx = buildContext(runSimulation(1));
    const json = JSON.stringify(ctx);
    expect(json).toContain('"kariyerDozLimiti_mSv":600');
    expect(json).toContain('"co2KritikSiniri_mmHg":3');
    expect(json).toContain('12 dk 30 sn');
  });

  it(`herkes kritik olsa bile ${MAX_CONTEXT_TOKENS} token altında kalır`, () => {
    const s = runSimulation(3);
    const statuses = Object.fromEntries(
      Object.entries(s.statuses).map(([id, st]) => [id, { ...st, level: 'critical' } as CrewStatus]),
    );
    useAstra.setState({ statuses });
    const ctx = buildContext(useAstra.getState(), { question: 'Herkes nasıl?' });
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
  it('veride olan sayıları (Türkçe biçimle) kabul eder', () => {
    expect(verifyNumbers("Elif'in nabzı 68 bpm, sıcaklığı 37,4 °C, CO₂ 3,4 mmHg.", ctx)).toBe(true);
  });
  it('uydurma sayıyı yakalar', () => {
    expect(verifyNumbers("Elif'in nabzı 120 bpm.", ctx)).toBe(false);
  });
  it('soruda geçen sayıyı uydurma saymaz', () => {
    expect(verifyNumbers('Son 3 günde değer değişmedi: 68 bpm.', ctx, 'Son 3 günde nabız?')).toBe(true);
  });
});

describe('safety.ts · güvenlik süzgeci', () => {
  it.each([
    "Elif'e 400 mg ibuprofen verin.",
    'Kerem için ağrı kesici ilaç kullanılmalı.',
    "Mert'te aritmi var, hemen müdahale edin.",
    'Bu tablo kalp krizi teşhisi ile uyumlu.',
    'Dozu alın ve dinlenin.',
  ])('engeller: %s', (text) => expect(checkAnswer(text).safe).toBe(false));

  it.each([
    'Teşhis koyamam; Mert\'in nabzı 155 bpm ve çekirdek sıcaklığı 39,2 °C. Medikal kontrol önerilir.',
    'İlaç ya da doz öneremem; bu karar uçuş doktorunundur. Bu konuda uçuş doktoruna danışmayı öneririm.',
    'Kokpit doz hızı 76,7 µSv/sa, toplam doz 331 mSv; kariyer limiti 600 mSv.',
    "EKG'de düzensiz atımlar görülüyor, medikal kontrol önerilir.",
    'Kortizol 40 ng/mL, CO₂ 3,4 mmHg.',
  ])('geçirir: %s', (text) => expect(checkAnswer(text).safe).toBe(true));
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
    expect(fallbackAnswer({ mode: 'chat', question: QUESTIONS[0], context: {} }).text).toMatch(/zorunlu dinlenme verdi: Elif/);
  });

  it('Elif\'in nabzı ekrandakiyle aynı sayı', () => {
    const hr = Math.round(useAstra.getState().telemetry.elif!.cardio.hr_bpm);
    expect(fallbackAnswer({ mode: 'chat', question: QUESTIONS[2], context: {} }).text).toContain(`${hr} bpm`);
  });

  it('Kerem neden kritik: gerçek CO₂ değeri ve otonom adım', () => {
    const t = fallbackAnswer({ mode: 'chat', question: QUESTIONS[1], context: {} }).text;
    expect(t).toContain('3,4 mmHg');
    expect(t).toMatch(/havalandırma/i);
  });

  it('telemetri yokken de cevap verir', () => {
    useAstra.getState().clearAll();
    expect(fallbackAnswer({ mode: 'chat', question: 'Elif nasıl?', context: {} }).text).toMatch(/telemetri/);
  });
});

describe('fallback.ts · olay açıklama şablonları', () => {
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

  it('olay bulunamazsa genel güvenli metin döner', () => {
    expect(fallbackAnswer({ mode: 'incident', question: 'x', context: { olayId: 'yok' } }).text).toMatch(/Katman 1/);
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

  it('model cevabını kaynak ve doğrulama rozetiyle döndürür', async () => {
    const hr = Math.round(useAstra.getState().telemetry.elif!.cardio.hr_bpm);
    vi.stubGlobal('fetch', reply({ text: `Elif'in kalp atış hızı ${hr} bpm; kişisel normaline yakın.`, source: 'gemini' }));
    const a = await askAstra(req());
    expect(a.source).toBe('gemini');
    expect(a.verified).toBe(true);
  });

  it('uydurma sayıda "kontrol et" rozeti verir', async () => {
    vi.stubGlobal('fetch', reply({ text: "Elif'in nabzı 187 bpm.", source: 'gemini' }));
    expect((await askAstra(req())).verified).toBe(false);
  });

  it('ilaç öneren cevabı göstermez, yedek cevaba geçer', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', reply({ text: "Elif'e 200 mg ibuprofen verin.", source: 'gemini' }));
    const a = await askAstra(req());
    expect(a.source).toBe('fallback');
    expect(a.text).not.toMatch(/ibuprofen/);
  });

  it('sunucu hatasında ve bağlantı yokken yedek moda geçer', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', reply({ error: 'x' }, 503));
    expect((await askAstra(req())).source).toBe('fallback');
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    expect((await askAstra({ ...req(), question: 'Kerem nasıl?' })).source).toBe('fallback');
  });

  it('aynı soru 60 sn içinde önbellekten gelir', async () => {
    const f = reply({ text: 'Merhaba, ben ASTRA.', source: 'gemini' });
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
    const f = vi.fn(async () => Response.json({ text: 'Kabin CO₂ kısmi basıncı 3,4 mmHg; havalandırma artırıldı.', source: 'gemini' }));
    vi.stubGlobal('fetch', f);
    requestExplanation(id);
    requestExplanation(id); // ikinci ekran aynı olayı gösteriyor
    await vi.waitFor(() => expect(useAstra.getState().explanations[id]).toBeDefined());
    expect(f).toHaveBeenCalledTimes(1);
    expect(useAstra.getState().explanations[id]).toMatchObject({ source: 'gemini', verified: true });
  });

  it('olay sorusu sinyalleri değer ve kişisel normalle verir', () => {
    const s = makeDemoState();
    expect(incidentQuestion(s.incidents[0])).toContain('3,4 mmHg (kişisel normal 1,9 mmHg)');
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
    expect((await handler.fetch(post({ mode: 'chat', question: 'Merhaba', context: {} }))).status).toBe(503);
    expect(f).not.toHaveBeenCalled();
  });

  it('Gemini: sistem talimatına veriyi koyar, düşünce parçalarını atar', async () => {
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

  it('Gemini: model yoğunsa (503) yedek modele geçer', async () => {
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
    expect(f.mock.calls[1][0]).toContain('gemini-3.7-flash');
  });

  it('Gemini: tüm modeller yoğunsa 502 döner (istemci yedek moda geçer); anahtar hatasında yedek model denenmez', async () => {
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

  it('Claude: "thinking" alanı reddedilirse onsuz tekrar dener', async () => {
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
