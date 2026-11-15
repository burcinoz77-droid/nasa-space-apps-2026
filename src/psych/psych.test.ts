// Part 4 · Psychological tests: scoring, PVT-B sent to Layer 1, test plan, psychological state and ASTRA tools.
import { beforeEach, describe, expect, it } from 'vitest';
import { runTool } from '../../api/astra';
import { buildContext } from '../ai/context';
import { fallbackAnswer } from '../ai/fallback';
import { answerSources } from '../ai/sources';
import { countSentences, makeDemoState, runSimulation } from '../ai/testing';
import { buildToolData } from '../ai/tooldata';
import { createDetector } from '../engine';
import { createSimulation } from '../sim';
import { useAstra } from '../store';
import type { CrewId } from '../types';
import { dueTests, psychState, ROUTINE_TICKS } from './analysis';
import { LICENSED_NOTE, PVT, SP_LEVELS, TLX_ITEMS } from './instruments';
import { rawTlx, scorePvt, tlxHighest, type TlxRatings } from './scoring';
import { activePvt, applyTestResults, DAY_TICKS, PVT_HOLD_TICKS, useTests } from './store';

const RATINGS: TlxRatings = { zihinsel: 70, fiziksel: 20, zamansal: 60, performans: 30, efor: 65, engellenme: 45 };
const advance = (n: number) => {
  for (let i = 0; i < n; i++) useTests.getState().advance();
};
const ask = (question: string) => fallbackAnswer({ mode: 'chat', question, context: {} }).text;

beforeEach(() => useTests.getState().clear());

describe('psych/instruments · official items', () => {
  it('Samn-Perelli 7 steps, NASA-TLX 6 subscales; official English items', () => {
    expect(SP_LEVELS.map((l) => l.puan)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(SP_LEVELS[0].en).toBe('Fully alert, wide awake');
    expect(SP_LEVELS[6].en).toBe('Completely exhausted, unable to function effectively');
    expect(TLX_ITEMS).toHaveLength(6);
    expect(TLX_ITEMS[0].soruEn).toBe('How mentally demanding was the task?');
    expect(TLX_ITEMS.find((i) => i.key === 'performans')!.alt).toBe('Perfect');
  });

  it('PVT-B parameters match Basner et al. 2011', () => {
    expect(PVT.durationS).toBe(180);
    expect([PVT.minDelayMs, PVT.maxDelayMs]).toEqual([1000, 4000]);
    expect(PVT.lapseMs).toBe(355);
    expect(PVT.falseStartMs).toBe(100);
  });
});

describe('psych/scoring · code computes the scores', () => {
  it('Raw TLX = mean of the six subscales; the highest subscale is found', () => {
    expect(rawTlx(RATINGS)).toBe(48.3);
    expect(tlxHighest(RATINGS)).toMatchObject({ key: 'zihinsel', puan: 70 });
  });

  it('PVT: 355 ms and above is a lapse, under 100 ms a false start, 30 s without a response is also a lapse', () => {
    const s = scorePvt([250, 300, 354, 355, 400, 80, PVT.timeoutMs], 2);
    expect(s.responses).toBe(6);
    expect(s.lapses).toBe(3);
    expect(s.falseStarts).toBe(3);
    expect(s.medianRt_ms).toBe(355); // (354 + 355) / 2, rounded
    expect(s.meanRt_ms).toBe(Math.round((250 + 300 + 354 + 355 + 400 + 30000) / 6));
  });
});

describe('psych/store · the PVT-B result goes to Layer 1', () => {
  const pvt = (meanRt_ms: number, lapses: number, demo = false) =>
    useTests.getState().add({ kind: 'PVT', meanRt_ms, medianRt_ms: meanRt_ms, lapses, falseStarts: 0, responses: 50, speed: 1000 / meanRt_ms, demo, durationS: demo ? 30 : 180 }, 'elif');

  it('the measured value replaces the simulated value, the simulation continues after 1 mission day', () => {
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

  it('a 30 s trial does not go to Layer 1', () => {
    pvt(500, 10, true);
    expect(activePvt('elif')).toBeUndefined();
  });

  it('a slow PVT-B result shows up as a cognitive signal in Layer 1', () => {
    useAstra.getState().clearAll();
    const sim = createSimulation(7);
    const det = createDetector();
    const step = () => {
      const { ship, telemetry } = sim.tick();
      applyTestResults(telemetry);
      const out = det.process(ship, telemetry);
      useAstra.getState().applyTick(ship, telemetry, out);
    };
    for (let i = 0; i < 35; i++) step(); // let the personal baseline (30 readings) build
    pvt(520, 12);
    for (let i = 0; i < 5; i++) step();
    const st = useAstra.getState().statuses.elif!;
    const sig = st.topSignals.find((s) => s.key === 'cog.pvtMeanRt_ms' || s.key === 'cog.pvtLapses');
    expect(sig?.level).not.toBe('normal');
    expect(psychState('elif').etkenler.find((f) => f.ad.startsWith('Reaction'))!.seviye).not.toBe('normal');
  });
});

describe('psych/analysis · ASTRA test plan and psychological state', () => {
  it('with no tests, all three are recommended as "first measurement"; removed from the list once taken', () => {
    const s = runSimulation(3);
    const id = (['elif', 'kerem', 'zeynep', 'emir', 'deniz', 'mert'] as CrewId[]).find((x) => s.telemetry[x]!.env.sleepLastNight_h >= 6 && x !== 'mert')!;
    expect(dueTests(id).map((d) => d.kind).sort()).toEqual(['PVT', 'SP', 'TLX']);
    useTests.getState().add({ kind: 'SP', puan: 3 }, id);
    expect(dueTests(id).map((d) => d.kind)).not.toContain('SP');
    advance(ROUTINE_TICKS);
    expect(dueTests(id).find((d) => d.kind === 'SP')?.neden).toMatch(/4 mission days/);
  });

  it('with short sleep, fatigue and PVT-B have priority (Jones et al. 2022)', () => {
    const s = runSimulation(3);
    useAstra.setState({ telemetry: { ...s.telemetry, elif: { ...s.telemetry.elif!, env: { ...s.telemetry.elif!.env, sleepLastNight_h: 5.2 } } } });
    const due = dueTests('elif');
    expect(due.filter((d) => d.oncelik === 'priority').map((d) => d.kind).sort()).toEqual(['PVT', 'SP']);
    expect(due[0].neden).toMatch(/5.2 h/);
    expect(due[0].kaynak?.url).toContain('PMC8919197');
  });

  it('test results update the psychological state; assumption thresholds are marked', () => {
    runSimulation(3);
    expect(psychState('deniz').guncelTest).toBe(false);
    useTests.getState().add({ kind: 'SP', puan: 6 }, 'deniz');
    useTests.getState().add({ kind: 'TLX', ratings: RATINGS, raw: rawTlx(RATINGS) }, 'deniz');
    const ps = psychState('deniz');
    expect(ps.guncelTest).toBe(true);
    expect(ps.seviye).toBe('caution');
    const sp = ps.etkenler.find((f) => f.ad.startsWith('Fatigue'))!;
    expect(sp).toMatchObject({ seviye: 'caution', varsayim: true });
    expect(sp.deger).toContain('6/7');
    expect(ps.etkenler.find((f) => f.ad.startsWith('Workload'))!.seviye).toBe('normal');
    useTests.getState().add({ kind: 'SP', puan: 7 }, 'deniz');
    expect(psychState('deniz').seviye).toBe('critical');
    expect(psychState('deniz').etkenler[0].not).toMatch(/1 step\(s\) more tired/);
  });
});

describe('ASTRA · test tools and offline mode', () => {
  const seed = () => {
    makeDemoState();
    useTests.getState().add({ kind: 'SP', puan: 5 }, 'elif');
    useTests.getState().add({ kind: 'TLX', ratings: RATINGS, raw: rawTlx(RATINGS) }, 'elif');
    useTests.getState().add({ kind: 'PVT', meanRt_ms: 312, medianRt_ms: 298, lapses: 2, falseStarts: 1, responses: 55, speed: 3.3, demo: false, durationS: 180 }, 'elif');
    useTests.getState().add({ kind: 'SP', puan: 2 }, 'kerem');
    return JSON.parse(JSON.stringify(buildToolData(useAstra.getState())));
  };

  it('get_test_results: latest results, change and Layer 1 information', () => {
    const data = seed();
    const r = runTool('get_test_results', { ad: 'Elif' }, data) as { sonuclar: Record<string, { puan?: number; toplam?: number; ortalama_ms?: number }[]>; katman1eGidenPvt: string };
    expect(r.sonuclar.yorgunluk_SamnPerelli[0].puan).toBe(5);
    expect(r.sonuclar.isYuku_NasaTlx[0].toplam).toBe(48.3);
    expect(r.sonuclar.tepki_PvtB[0].ortalama_ms).toBe(312);
    expect(r.katman1eGidenPvt).toMatch(/^yes/);
    const only = runTool('get_test_results', { ad: 'Elif', test: 'iş yükü' }, data) as { sonuclar: Record<string, unknown> };
    expect(Object.keys(only.sonuclar)).toEqual(['isYuku_NasaTlx']);
    const none = runTool('get_test_results', { ad: 'Mert' }, data) as { not: string };
    expect(none.not).toMatch(/No test results for this person yet/);
  });

  it('get_psych_state, get_test_schedule and compare_crew_tests', () => {
    const data = seed();
    const ps = runTool('get_psych_state', { ad: 'Elif' }, data) as { seviye: string; etkenler: { esik?: string }[] };
    expect(ps.seviye).toBe('caution');
    expect(ps.etkenler.some((e) => e.esik === 'assumption')).toBe(true);
    const plan = runTool('get_test_schedule', {}, data) as { plan: { astronot: string; bekleyenTestler: unknown[] }[]; kurallar: Record<string, string> };
    expect(plan.plan).toHaveLength(6);
    expect(plan.kurallar.rutin).toMatch(/every 4 mission days/);
    const cmp = runTool('compare_crew_tests', { test: 'yorgunluk' }, data) as { enYorgundanBaslayarak: { ad: string; puan: number }[]; sonDortGundeTestYapmayanlar: string[] };
    expect(cmp.enYorgundanBaslayarak).toEqual([
      { ad: 'Elif', puan: 5 },
      { ad: 'Kerem', puan: 2 },
    ]);
    expect(cmp.sonDortGundeTestYapmayanlar).toContain('Mert');
  });

  it('offline mode: describes results, plan and comparison in at most 4 sentences', () => {
    seed();
    const elif = ask("How are Elif's test results?");
    expect(elif).toMatch(/5\/7/);
    expect(elif).toMatch(/48.3\/100/);
    expect(elif).toMatch(/312 ms/);
    const plan = ask('Who should take a test?');
    expect(plan).toMatch(/Tests tab/);
    const cmp = ask('Who is the most tired on the crew? Compare the tests.');
    expect(cmp).toMatch(/Highest fatigue: Elif \(5\/7\)/);
    for (const t of [elif, plan, cmp]) expect(countSentences(t)).toBeLessThanOrEqual(4);
  });

  it('does not make things up when there are no tests', () => {
    makeDemoState();
    expect(ask('How are the psychological test results?')).toMatch(/Nobody has taken a psychological test yet/);
  });

  it('PANAS and BSI-18 are simulated; ASTRA says so (licensed scales)', () => {
    makeDemoState();
    const mood = ask("How is Elif's mood?");
    expect(mood).toContain(LICENSED_NOTE);
    expect(countSentences(mood)).toBeLessThanOrEqual(4);
    const data = buildToolData(useAstra.getState());
    const panas = data.murettebat.elif.olcumler.find((m) => m.anahtar === 'cog.panasPositive')!;
    expect(panas).toMatchObject({ not: LICENSED_NOTE });
    expect(data.murettebat.elif.olcumler.find((m) => m.anahtar === 'cardio.hr_bpm')).not.toHaveProperty('not');
    expect(JSON.stringify(buildContext(useAstra.getState()))).toContain('licensed scales');
  });

  it('test sources are shown under the answer', () => {
    const src = answerSources('NASA-TLX iş yükü testi nedir?', 'NASA-TLX altı alt ölçekli bir iş yükü testidir.');
    expect(src.map((x) => x.url)).toContain('https://humansystems.arc.nasa.gov/groups/tlx/');
  });
});
