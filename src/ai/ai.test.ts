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
    expect(json).toContain('"gurultuSiniri_dBA":{"calisma16sa":72,"uyku8sa":62}');
    expect(json).toContain('%6–9 (NASA: ayda %1–1,5; ölçüm değil, tahmin)');
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
  // Gerçekçi ASTRA cevapları: hiçbiri engellenmemeli. Yeni bir yanlış engelleme görülürse buraya ekleyin.
  const SHOULD_PASS = [
    // 14 Kasım 23.15'te canlı Gemini cevabı; eski süzgeç "teşhis" kelimesi yüzünden yanlışlıkla engellemişti
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
  // Gerçekten tehlikeli: hepsi engellenmeli.
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

  it('yedek modun tüm cevapları süzgeçten geçer', () => {
    makeDemoState();
    for (const q of [...QUESTIONS, "Mert'te ne olabilir?", 'Kerem hasta mı?', 'Elif kalp krizi mi geçiriyor?']) {
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

  it('selama veri saymadan, resmî bir tanıtımla karşılık verir', () => {
    const t = fallbackAnswer({ mode: 'chat', question: 'Merhaba', context: {} }).text;
    expect(t).toMatch(/^Merhaba, ben ASTRA/);
    expect(t).not.toMatch(/\d+ (bpm|mmHg|°C)/);
  });

  it('"Peki Kerem?" sorusunu Kerem\'in durumu olarak anlar', () => {
    expect(fallbackAnswer({ mode: 'chat', question: 'Peki Kerem?', context: {} }).text).toMatch(/^Kerem'in durumu kritik/);
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

  it('ilaç öneren cevabı göstermez, yedek cevaba geçer ve sebebini "güvenlik" olarak işaretler', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', reply({ text: "Elif'e 200 mg ibuprofen verin.", source: 'gemini' }));
    const a = await askAstra(req());
    expect(a.source).toBe('fallback');
    expect(a.fallbackReason).toBe('safety');
    expect(a.text).not.toMatch(/ibuprofen/);
  });

  it('ihtimal diliyle konuşan iyi bir cevabı engellemez', async () => {
    vi.stubGlobal(
      'fetch',
      reply({ text: 'Bu değişiklikler hiperkapni olasılığını düşündürmektedir; bu değerlendirme kesin bir teşhis olmayıp medikal kontrol gereklidir.', source: 'gemini' }),
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
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    expect((await askAstra({ ...req(), question: 'Kerem nasıl?' })).source).toBe('fallback');
  });

  it('sohbetin son mesajlarını sunucuya gönderir (devam soruları için)', async () => {
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

  it('kullanılan araçları Türkçe etiketle gösterir; araçla okunan sayıyı doğrulanmış sayar', async () => {
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
    expect(a.tools).toEqual(['Kaynak bilgisi · radyasyon']);
    expect(a.verified).toBe(true);
    expect(a.sources?.[0]).toMatchObject({ ad: expect.stringMatching(/NASA-STD-3001/), url: expect.stringMatching(/^https:\/\//) });
  });

  it('yedek cevaplar da kaynak linkiyle gelir', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ağ yok')));
    const a = await askAstra({ mode: 'chat', question: 'CO₂ güvenli mi?', context: {} });
    expect(a.source).toBe('fallback');
    expect(a.sources?.map((x) => x.ad)).toContain('OCHMO-TB-004 CO₂');
  });

  it('sohbet isteğiyle araç verisini de gönderir', async () => {
    const f = reply({ text: 'Tamam.', source: 'gemini' });
    vi.stubGlobal('fetch', f);
    await askAstra({ mode: 'chat', question: 'Mert nasıl?', context: {} });
    const body = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(Object.keys(body.toolData.murettebat)).toHaveLength(6);
    expect(body.toolData.bilgi.length).toBeGreaterThan(5);
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
    const r = runTool('get_crew_member', { ad: "Kerem'in" }, data()) as { ad: string; olcumler: unknown[]; acikOlaylar: unknown[] };
    expect(r.ad).toBe('Kerem');
    expect(r.olcumler.length).toBe(METRICS.length);
    expect(r.acikOlaylar.length).toBe(1);
    expect(runTool('get_crew_member', { ad: 'Kenji' }, data())).toMatchObject({ hata: expect.stringMatching(/astronot yok/) });
  });

  it('get_metric_trend: Türkçe ölçüm adından doğru ölçümü bulur', () => {
    runSimulation(40);
    const td = JSON.parse(JSON.stringify(buildToolData(useAstra.getState())));
    const r = runTool('get_metric_trend', { ad: 'Elif', olcum: 'nabız' }, td) as {
      olcum: string;
      kisiselNormal: number;
      yakinDonem: { degerler: number[]; yon: string };
      uzunDonem: { degerler: number[]; kapsam_saat: number };
    };
    expect(r.olcum).toBe('Kalp atış hızı');
    expect(r.kisiselNormal).toBeGreaterThan(40);
    expect(r.yakinDonem.degerler.length).toBeGreaterThan(2);
    expect(['artıyor', 'azalıyor', 'sabit']).toContain(r.yakinDonem.yon);
    expect(r.uzunDonem.degerler.length).toBeGreaterThan(2);
    expect(r.uzunDonem.kapsam_saat).toBeGreaterThan(0);
    expect((runTool('get_metric_trend', { ad: 'Elif', olcum: 'toplam doz' }, td) as { olcum: string }).olcum).toBe('Toplam radyasyon dozu');
    expect((runTool('get_metric_trend', { ad: 'Elif', olcum: 'CO₂' }, td) as { olcum: string }).olcum).toBe('CO₂ kısmi basıncı');
  });

  it('get_metric_trend: veride olmayan ölçümde "veride yok" der', () => {
    expect(runTool('get_metric_trend', { ad: 'Deniz', olcum: 'kemik yoğunluğu' }, data())).toMatchObject({ hata: 'Bu ölçüm veride yok.' });
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

describe('Kaynak linkleri (sources.ts)', () => {
  it('sorudaki konuya göre doğru kaynakları seçer, ilgisizleri eklemez', () => {
    const noise = answerSources('Kabin gürültüsü normal mi?', 'Ortam gürültüsü: Elif 55 dBA. Tüm değerler resmi normal aralıkta (en fazla 72 dBA).');
    expect(noise.map((x) => x.ad).join(' ')).toMatch(/Akustik/);
    expect(noise.map((x) => x.ad).join(' ')).not.toMatch(/NIH|Pulse/);
    expect(answerSources('Kemik kaybı ne durumda?', 'Kemik yoğunluğu ölçülmüyor. Bu konuda uçuş doktoruna danışmayı öneririm.').map((x) => x.ad)).toEqual([
      'NASA HRP, kemik değişimi riski',
    ]);
    // "önemli" kelimesindeki "nem" ortam konusunu tetiklemez
    expect(answerSources('Bu önemli mi?', 'Merhaba.')).toEqual([]);
    for (const x of answerSources('Radyasyon durumu nasıl?', 'Kariyer limiti 600 mSv.')) expect(x.url).toMatch(/^https:\/\//);
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

  it('araçlar Türkçe adla yeni ölçümleri bulur', () => {
    runSimulation(40);
    const td = JSON.parse(JSON.stringify(buildToolData(useAstra.getState())));
    expect((runTool('get_metric_trend', { ad: 'Elif', olcum: 'gürültü' }, td) as { olcum: string }).olcum).toBe('Ortam gürültüsü');
    expect((runTool('get_metric_trend', { ad: 'Elif', olcum: 'kabin sıcaklığı' }, td) as { olcum: string }).olcum).toBe('Ortam sıcaklığı');
    expect((runTool('get_metric_trend', { ad: 'Elif', olcum: 'vücut ısısı' }, td) as { olcum: string }).olcum).toBe('Çekirdek sıcaklık');
    expect((runTool('lookup_reference', { konu: 'kemik' }, td) as { konu: string }).konu).toBe('kemik');
    expect((runTool('lookup_reference', { konu: 'gürültü' }, td) as { konu: string }).konu).toBe('ortam');
    expect((runTool('lookup_reference', { konu: 'SANS' }, td) as { konu: string }).konu).toBe('goz');
  });

  it('kemik kaybı tahmini görev gününe göre hesaplanır', () => {
    expect(boneLossEstimate(180)).toBe('%6–9');
    expect(boneLossEstimate(30)).toBe('%1');
  });

  it('yedek mod: ölçülmeyen konularda uydurmaz, ölçülmediğini ve NASA bilgisini söyler', () => {
    makeDemoState();
    const ask = (q: string) => fallbackAnswer({ mode: 'chat', question: q, context: {} }).text;
    const bone = ask("Kerem'in kemik kaybı ne durumda?");
    expect(bone).toMatch(/ölçülmüyor/);
    expect(bone).toContain('%1–1,5');
    expect(bone).toContain('%6–9');
    expect(ask('Bağışıklık sistemi nasıl?')).toMatch(/ölçülmüyor/);
    expect(ask('Ekip uyumu nasıl?')).toMatch(/ölçülmüyor/);
    expect(ask('SANS riski var mı?')).toMatch(/ölçülmüyor/);
    expect(ask("Mert'in elektrolit dengesi nasıl?")).not.toMatch(/vestibüler/);
    expect(ask('Kokpitte gürültü kaç?')).toMatch(/dBA/);
    expect(ask('Kabin gürültüsü normal mi?')).toMatch(/resmi normal aralıkta \(en fazla 72 dBA\)/);
    for (const q of ["Kerem'in kemik kaybı ne durumda?", 'SANS riski var mı?', 'Kokpitte gürültü kaç?']) {
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
    expect(possibleConditions(s, 'kerem')[0].durum).toMatch(/hiperkapni/);
    s = runSimulation(40, 'EVA_OVEREXERTION', 30);
    const mert = possibleConditions(s, 'mert');
    expect(mert[0].durum).toMatch(/Isı stresi/);
    expect(mert[0].dayanak.join(' ')).toMatch(/Çekirdek sıcaklık .* \(kişisel normal/);
    expect(['düşük', 'orta']).toContain(mert[0].olasilik);
  });

  it('assess_possible_conditions aracı olası durumları ve "kesin değil" uyarısını verir', () => {
    runSimulation(40, 'EVA_OVEREXERTION', 30);
    const td = JSON.parse(JSON.stringify(buildToolData(useAstra.getState())));
    const r = runTool('assess_possible_conditions', { ad: 'Mert' }, td) as { olasiDurumlar: { durum: string }[]; uyari: string };
    expect(r.olasiDurumlar[0].durum).toMatch(/Isı stresi/);
    expect(r.uyari).toMatch(/kesin değildir/);
    expect(toolLabel({ ad: 'assess_possible_conditions', girdi: { ad: 'Mert' } })).toBe('Olası durumlar · Mert');
  });

  it('yedek modda hastalık sorusuna değişen değerler + ihtimal diliyle cevap verir', () => {
    runSimulation(40, 'EVA_OVEREXERTION', 30);
    const t = fallbackAnswer({ mode: 'chat', question: "Mert'te ne olabilir?", context: {} }).text;
    expect(t).toMatch(/^Kesin bir teşhis koyamam; ancak Mert için çekirdek sıcaklık/);
    expect(t).toMatch(/ısı stresi ve aşırı efor ile uyumlu olabilir/);
    expect(t).toMatch(/kesin değildir/);
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
    useAstra.getState().addChat({ id: 'x', role: 'user', text: 'Merhaba', at: 1 });
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
    expect(f.mock.calls[1][0]).toContain('gemini-3.5-flash-lite');
  });

  it('Gemini: model hiç cevap vermezse süresi dolunca sıradaki modele geçer', async () => {
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

  it('önceki konuşmayı modele sırayla iletir; bozuk geçmişi yok sayar', async () => {
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

  it('Gemini araç döngüsü: aracı çalıştırır, sonucu modele verir, kullanılan aracı bildirir', async () => {
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
    expect(second.contents.at(-2).parts[0].thoughtSignature).toBe('imza'); // imza aynen geri gider
    expect(second.contents.at(-1).parts[0].functionResponse.name).toBe('get_crew_member');
  });

  it('Gemini araç tanımlarını reddederse araçsız ve ayrıntılı veriyle tekrar sorar', async () => {
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

  it('Claude araç döngüsü: tool_use -> tool_result -> metin', async () => {
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

  it('olay açıklamasında araç kullanılmaz (hız için tek adım)', async () => {
    process.env.ASTRA_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test';
    const f = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ candidates: [{ content: { parts: [{ text: 'Açıklama.' }] } }] }));
    vi.stubGlobal('fetch', f);
    await handler.fetch(post({ mode: 'incident', question: 'Olay', context: {}, toolData: { murettebat: {} } }));
    expect(JSON.parse(String(f.mock.calls[0][1].body)).tools).toBeUndefined();
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
