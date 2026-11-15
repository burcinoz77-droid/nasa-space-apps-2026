// Parça 4 · Psikolojik testler: puanlama, Katman 1'e giden PVT-B, test planı, psikolojik durum ve ASTRA araçları.
import { beforeEach, describe, expect, it } from 'vitest';
import { runTool } from '../../api/astra';
import { fallbackAnswer } from '../ai/fallback';
import { answerSources } from '../ai/sources';
import { countSentences, makeDemoState, runSimulation } from '../ai/testing';
import { buildToolData } from '../ai/tooldata';
import { createDetector } from '../engine';
import { createSimulation } from '../sim';
import { useAstra } from '../store';
import type { CrewId } from '../types';
import { dueTests, psychState, ROUTINE_TICKS } from './analysis';
import { PVT, SP_LEVELS, TLX_ITEMS } from './instruments';
import { rawTlx, scorePvt, tlxHighest, type TlxRatings } from './scoring';
import { activePvt, applyTestResults, DAY_TICKS, PVT_HOLD_TICKS, useTests } from './store';

const RATINGS: TlxRatings = { zihinsel: 70, fiziksel: 20, zamansal: 60, performans: 30, efor: 65, engellenme: 45 };
const advance = (n: number) => {
  for (let i = 0; i < n; i++) useTests.getState().advance();
};
const ask = (question: string) => fallbackAnswer({ mode: 'chat', question, context: {} }).text;

beforeEach(() => useTests.getState().clear());

describe('psych/instruments · resmi maddeler', () => {
  it('Samn-Perelli 7 basamak, NASA-TLX 6 alt ölçek; İngilizce asılları yanında', () => {
    expect(SP_LEVELS.map((l) => l.puan)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(SP_LEVELS[0].en).toBe('Fully alert, wide awake');
    expect(SP_LEVELS[6].en).toBe('Completely exhausted, unable to function effectively');
    expect(TLX_ITEMS).toHaveLength(6);
    expect(TLX_ITEMS[0].soruEn).toBe('How mentally demanding was the task?');
    expect(TLX_ITEMS.find((i) => i.key === 'performans')!.alt).toBe('Mükemmel');
  });

  it('PVT-B parametreleri Basner vd. 2011 ile aynı', () => {
    expect(PVT.durationS).toBe(180);
    expect([PVT.minDelayMs, PVT.maxDelayMs]).toEqual([1000, 4000]);
    expect(PVT.lapseMs).toBe(355);
    expect(PVT.falseStartMs).toBe(100);
  });
});

describe('psych/scoring · puanları kod hesaplar', () => {
  it('Raw TLX = altı alt ölçeğin ortalaması; en yüksek alt ölçek bulunur', () => {
    expect(rawTlx(RATINGS)).toBe(48.3);
    expect(tlxHighest(RATINGS)).toMatchObject({ key: 'zihinsel', puan: 70 });
  });

  it('PVT: 355 ms ve üzeri dikkat kaybı, 100 ms altı erken basma, 30 sn yanıtsız da dikkat kaybı', () => {
    const s = scorePvt([250, 300, 354, 355, 400, 80, PVT.timeoutMs], 2);
    expect(s.responses).toBe(6);
    expect(s.lapses).toBe(3);
    expect(s.falseStarts).toBe(3);
    expect(s.medianRt_ms).toBe(355); // (354 + 355) / 2, yuvarlanmış
    expect(s.meanRt_ms).toBe(Math.round((250 + 300 + 354 + 355 + 400 + 30000) / 6));
  });
});

describe('psych/store · PVT-B sonucu Katman 1\'e gider', () => {
  const pvt = (meanRt_ms: number, lapses: number, demo = false) =>
    useTests.getState().add({ kind: 'PVT', meanRt_ms, medianRt_ms: meanRt_ms, lapses, falseStarts: 0, responses: 50, speed: 1000 / meanRt_ms, demo, durationS: demo ? 30 : 180 }, 'elif');

  it('ölçülen değer simüle değerin yerine geçer, 1 görev günü sonra simülasyon devam eder', () => {
    pvt(420, 7);
    const t = createSimulation(3).tick().telemetry;
    applyTestResults(t);
    const elif = t.find((x) => x.crewId === 'elif')!;
    expect(elif.cog.pvtMeanRt_ms).toBe(420);
    expect(elif.cog.pvtLapses).toBe(7);
    expect(t.find((x) => x.crewId === 'kerem')!.cog.pvtMeanRt_ms).not.toBe(420);
    advance(PVT_HOLD_TICKS);
    expect(activePvt('elif')).toBeUndefined();
    expect(PVT_HOLD_TICKS).toBe(DAY_TICKS);
  });

  it('30 sn deneme Katman 1\'e gitmez', () => {
    pvt(500, 10, true);
    expect(activePvt('elif')).toBeUndefined();
  });

  it('yavaş bir PVT-B sonucu Katman 1\'de bilişsel sinyal olarak görünür', () => {
    useAstra.getState().clearAll();
    const sim = createSimulation(7);
    const det = createDetector();
    const step = () => {
      const { ship, telemetry } = sim.tick();
      applyTestResults(telemetry);
      const out = det.process(ship, telemetry);
      useAstra.getState().applyTick(ship, telemetry, out);
    };
    for (let i = 0; i < 35; i++) step(); // kişisel baseline (30 ölçüm) kurulsun
    pvt(520, 12);
    for (let i = 0; i < 5; i++) step();
    const st = useAstra.getState().statuses.elif!;
    const sig = st.topSignals.find((s) => s.key === 'cog.pvtMeanRt_ms' || s.key === 'cog.pvtLapses');
    expect(sig?.level).not.toBe('normal');
    expect(psychState('elif').etkenler.find((f) => f.ad.startsWith('Tepki'))!.seviye).not.toBe('normal');
  });
});

describe('psych/analysis · ASTRA test planı ve psikolojik durum', () => {
  it('hiç test yoksa üçü de "ilk ölçüm" olarak önerilir; yapılınca listeden çıkar', () => {
    const s = runSimulation(3);
    const id = (['elif', 'kerem', 'zeynep', 'emir', 'deniz', 'mert'] as CrewId[]).find((x) => s.telemetry[x]!.env.sleepLastNight_h >= 6 && x !== 'mert')!;
    expect(dueTests(id).map((d) => d.kind).sort()).toEqual(['PVT', 'SP', 'TLX']);
    useTests.getState().add({ kind: 'SP', puan: 3 }, id);
    expect(dueTests(id).map((d) => d.kind)).not.toContain('SP');
    advance(ROUTINE_TICKS);
    expect(dueTests(id).find((d) => d.kind === 'SP')?.neden).toMatch(/4 görev günü/);
  });

  it('kısa uykuda yorgunluk ve PVT-B öncelikli (Jones vd. 2022)', () => {
    const s = runSimulation(3);
    useAstra.setState({ telemetry: { ...s.telemetry, elif: { ...s.telemetry.elif!, env: { ...s.telemetry.elif!.env, sleepLastNight_h: 5.2 } } } });
    const due = dueTests('elif');
    expect(due.filter((d) => d.oncelik === 'öncelikli').map((d) => d.kind).sort()).toEqual(['PVT', 'SP']);
    expect(due[0].neden).toMatch(/5,2 sa/);
    expect(due[0].kaynak?.url).toContain('PMC8919197');
  });

  it('test sonuçları psikolojik durumu günceller; varsayım eşikler işaretli', () => {
    runSimulation(3);
    expect(psychState('deniz').guncelTest).toBe(false);
    useTests.getState().add({ kind: 'SP', puan: 6 }, 'deniz');
    useTests.getState().add({ kind: 'TLX', ratings: RATINGS, raw: rawTlx(RATINGS) }, 'deniz');
    const ps = psychState('deniz');
    expect(ps.guncelTest).toBe(true);
    expect(ps.seviye).toBe('caution');
    const sp = ps.etkenler.find((f) => f.ad.startsWith('Yorgunluk'))!;
    expect(sp).toMatchObject({ seviye: 'caution', varsayim: true });
    expect(sp.deger).toContain('6/7');
    expect(ps.etkenler.find((f) => f.ad.startsWith('İş yükü'))!.seviye).toBe('normal');
    useTests.getState().add({ kind: 'SP', puan: 7 }, 'deniz');
    expect(psychState('deniz').seviye).toBe('critical');
    expect(psychState('deniz').etkenler[0].not).toMatch(/1 basamak daha yorgun/);
  });
});

describe('ASTRA · test araçları ve yedek mod', () => {
  const seed = () => {
    makeDemoState();
    useTests.getState().add({ kind: 'SP', puan: 5 }, 'elif');
    useTests.getState().add({ kind: 'TLX', ratings: RATINGS, raw: rawTlx(RATINGS) }, 'elif');
    useTests.getState().add({ kind: 'PVT', meanRt_ms: 312, medianRt_ms: 298, lapses: 2, falseStarts: 1, responses: 55, speed: 3.3, demo: false, durationS: 180 }, 'elif');
    useTests.getState().add({ kind: 'SP', puan: 2 }, 'kerem');
    return JSON.parse(JSON.stringify(buildToolData(useAstra.getState())));
  };

  it('get_test_results: son sonuçlar, değişim ve Katman 1 bilgisi', () => {
    const data = seed();
    const r = runTool('get_test_results', { ad: 'Elif' }, data) as { sonuclar: Record<string, { puan?: number; toplam?: number; ortalama_ms?: number }[]>; katman1eGidenPvt: string };
    expect(r.sonuclar.yorgunluk_SamnPerelli[0].puan).toBe(5);
    expect(r.sonuclar.isYuku_NasaTlx[0].toplam).toBe(48.3);
    expect(r.sonuclar.tepki_PvtB[0].ortalama_ms).toBe(312);
    expect(r.katman1eGidenPvt).toMatch(/^evet/);
    const only = runTool('get_test_results', { ad: 'Elif', test: 'iş yükü' }, data) as { sonuclar: Record<string, unknown> };
    expect(Object.keys(only.sonuclar)).toEqual(['isYuku_NasaTlx']);
    const none = runTool('get_test_results', { ad: 'Mert' }, data) as { not: string };
    expect(none.not).toMatch(/henüz test sonucu yok/);
  });

  it('get_psych_state, get_test_schedule ve compare_crew_tests', () => {
    const data = seed();
    const ps = runTool('get_psych_state', { ad: 'Elif' }, data) as { seviye: string; etkenler: { esik?: string }[] };
    expect(ps.seviye).toBe('dikkat');
    expect(ps.etkenler.some((e) => e.esik === 'varsayım')).toBe(true);
    const plan = runTool('get_test_schedule', {}, data) as { plan: { astronot: string; bekleyenTestler: unknown[] }[]; kurallar: Record<string, string> };
    expect(plan.plan).toHaveLength(6);
    expect(plan.kurallar.rutin).toMatch(/4 görev gününde bir/);
    const cmp = runTool('compare_crew_tests', { test: 'yorgunluk' }, data) as { enYorgundanBaslayarak: { ad: string; puan: number }[]; sonDortGundeTestYapmayanlar: string[] };
    expect(cmp.enYorgundanBaslayarak).toEqual([
      { ad: 'Elif', puan: 5 },
      { ad: 'Kerem', puan: 2 },
    ]);
    expect(cmp.sonDortGundeTestYapmayanlar).toContain('Mert');
  });

  it('yedek mod: sonuçları, planı ve karşılaştırmayı en fazla 4 cümleyle anlatır', () => {
    seed();
    const elif = ask("Elif'in test sonuçları nasıl?");
    expect(elif).toMatch(/5\/7/);
    expect(elif).toMatch(/48,3\/100/);
    expect(elif).toMatch(/312 ms/);
    const plan = ask('Kim test yapmalı?');
    expect(plan).toMatch(/Testler sekmesi/);
    const cmp = ask('Ekipte en yorgun kim? Testleri karşılaştır.');
    expect(cmp).toMatch(/En yüksek yorgunluk: Elif \(5\/7\)/);
    for (const t of [elif, plan, cmp]) expect(countSentences(t)).toBeLessThanOrEqual(4);
  });

  it('hiç test yokken uydurmaz', () => {
    makeDemoState();
    expect(ask('Psikolojik test sonuçları ne durumda?')).toMatch(/Henüz kimse psikolojik test yapmadı/);
  });

  it('cevap altında test kaynakları gösterilir', () => {
    const src = answerSources('NASA-TLX iş yükü testi nedir?', 'NASA-TLX altı alt ölçekli bir iş yükü testidir.');
    expect(src.map((x) => x.url)).toContain('https://humansystems.arc.nasa.gov/groups/tlx/');
  });
});
