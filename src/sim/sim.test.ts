// Part 1 tests. Run with: npm run test
import { describe, expect, it } from 'vitest';
import { createSimulation } from './index';
import { PARAMS } from './parameters';
import type { Telemetry } from '../types';
import { SCENARIOS } from './scenario';
import donkiSep from '../../data/donki_sep_2024-05.json?raw';

const run = (n: number, sim = createSimulation(7)) => {
  let last: ReturnType<typeof sim.tick> | undefined;
  for (let i = 0; i < n; i++) last = sim.tick();
  return last!;
};
const by = (tel: Telemetry[], id: string) => tel.find((t) => t.crewId === id)!;

describe('Simulation', () => {
  it('the same seed produces the same data; a reset gives the same data from the start', () => {
    const a = createSimulation(7);
    const b = createSimulation(7);
    const ta = [a.tick(), a.tick()].map((x) => x.telemetry);
    const tb = [b.tick(), b.tick()].map((x) => x.telemetry);
    expect(ta.map((t) => t.map((x) => ({ ...x, t: 0 })))).toEqual(tb.map((t) => t.map((x) => ({ ...x, t: 0 }))));
    a.reset();
    expect({ ...a.tick().telemetry[0], t: 0 }).toEqual({ ...ta[0][0], t: 0 });
  });

  it('the 6 people have different baseline heart rates; Zeynep is the lowest in orbit (demo seed)', () => {
    const sim = createSimulation(); // demo seed 2026
    const sum: Record<string, number> = {};
    for (let i = 0; i < 60; i++) for (const t of sim.tick().telemetry) sum[t.crewId] = (sum[t.crewId] ?? 0) + t.cardio.hr_bpm / 60;
    expect(new Set(Object.values(sum).map((v) => Math.round(v))).size).toBeGreaterThan(3);
    expect(sum.zeynep).toBeLessThan(Math.min(sum.elif, sum.kerem));
  });

  it('values stay in a reasonable range on a nominal day', () => {
    const sim = createSimulation(3);
    for (let i = 0; i < 300; i++) {
      for (const t of sim.tick().telemetry) {
        expect(t.cardio.spo2_pct).toBeGreaterThanOrEqual(94);
        expect(t.cardio.hr_bpm).toBeGreaterThan(45);
        expect(t.cardio.hr_bpm).toBeLessThan(125); // Surface crew on EVA: Apollo EVA nominal 100–110 bpm + noise
        expect(t.env.ppCO2_mmHg).toBeLessThan(2.3);
        expect(t.cardio.ecg_rhythm).toBe('sinus');
      }
    }
  });

  it('daily metrics do not change every tick on a nominal day', () => {
    const sim = createSimulation(5);
    run(40, sim);
    const a = sim.tick().telemetry[0].env.sleepLastNight_h;
    const b = sim.tick().telemetry[0].env.sleepLastNight_h;
    expect(Math.abs(a - b)).toBeLessThan(1e-6);
  });

  it('total dose is ~330 mSv on day 180 and rises over time', () => {
    const sim = createSimulation(1);
    const first = by(sim.tick().telemetry, 'elif').env.doseCumulative_mSv;
    expect(first).toBeGreaterThan(320);
    expect(first).toBeLessThan(340);
    const later = by(run(50, sim).telemetry, 'elif').env.doseCumulative_mSv;
    expect(later).toBeGreaterThan(first);
  });

  it('a solar particle event spikes the spacecraft dose rate, the storm shelter lowers it, back to baseline when the event ends', () => {
    const sim = createSimulation(9);
    run(30, sim);
    sim.setScenario('SOLAR_STORM');
    const { ship, telemetry } = run(60, sim);
    const base = PARAMS.doseRateMarsTransit.value * 1000 / 24; // 76.7 µSv/h
    expect(ship.activeEvents.length).toBeGreaterThan(0);
    const elif = by(telemetry, 'elif').env.doseRate_uSv_h;
    expect(elif).toBeGreaterThan(base * 20); // peak 30× (Curiosity cruise measurement)
    expect(by(telemetry, 'emir').env.doseRate_uSv_h).toBeLessThan(elif / 5);
    sim.onAutoAction({ type: 'RADIATION_SHELTER', crewIds: ['elif'], at: 0, reason: 'test', incidentId: 'x' });
    const sheltered = by(run(15, sim).telemetry, 'elif').env.doseRate_uSv_h;
    expect(sheltered).toBeLessThan(elif * 0.45);
    const after = by(run(80, sim).telemetry, 'elif').env.doseRate_uSv_h;
    expect(after).toBeLessThan(base * 1.3);
  });

  it('the CO₂ failure raises spacecraft CO₂ to 5.3, Kerem is affected twice as much, ventilation brings it back', () => {
    const sim = createSimulation(11);
    run(30, sim);
    sim.setScenario('CO2_SCRUBBER_FAIL');
    const peak = run(120, sim).telemetry;
    expect(by(peak, 'kerem').env.ppCO2_mmHg).toBeGreaterThan(4.8);
    expect(by(peak, 'mert').env.ppCO2_mmHg).toBeLessThan(2.3); // Surface crew inside suits
    sim.onAutoAction({ type: 'INCREASE_VENTILATION', crewIds: ['kerem'], at: 0, reason: 'test', incidentId: 'x' });
    const after = run(80, sim).telemetry;
    expect(by(after, 'elif').env.ppCO2_mmHg).toBeLessThan(2.4); // same cabin
    expect(by(after, 'kerem').resp.rr_bpm).toBeLessThan(by(peak, 'kerem').resp.rr_bpm);
  });

  it('Mars Day 180: Elif at full intensity, the others at half', () => {
    const sim = createSimulation();
    const before = run(30, sim).telemetry;
    sim.setScenario('MARS_DAY_180');
    const after = run(80, sim).telemetry;
    const drop = (id: string) => by(before, id).env.sleepLastNight_h - by(after, id).env.sleepLastNight_h;
    expect(by(after, 'elif').env.sleepLastNight_h).toBeLessThan(5.3);
    expect(drop('elif')).toBeGreaterThan(drop('kerem') * 1.5);
    expect(by(after, 'elif').cog.pvtLapses).toBeGreaterThanOrEqual(5);
  });

  it('EVA overexertion: Mert heats up; mandatory crew rest brings heart rate and temperature back', () => {
    const sim = createSimulation();
    const before = run(30, sim).telemetry;
    sim.setScenario('EVA_OVEREXERTION');
    const hot = run(90, sim).telemetry;
    expect(by(hot, 'mert').resp.coreTemp_C).toBeGreaterThan(39);
    expect(by(hot, 'mert').cardio.hr_bpm).toBeGreaterThan(145);
    expect(by(hot, 'deniz').cardio.hr_bpm).toBeLessThan(110);
    sim.onAutoAction({ type: 'MANDATORY_REST', crewIds: ['mert'], at: 0, reason: 'test', incidentId: 'x' });
    const rested = run(40, sim).telemetry;
    expect(by(rested, 'mert').resp.coreTemp_C).toBeLessThan(38.3);
    expect(by(rested, 'mert').cardio.hr_bpm).toBeLessThan(by(before, 'mert').cardio.hr_bpm + 12);
  });

  it('after returning to Nominal (stabilize) values return to baseline, but not all at once: recovery is gradual', () => {
    const sim = createSimulation();
    const before = by(run(30, sim).telemetry, 'mert').resp.coreTemp_C;
    sim.setScenario('EVA_OVEREXERTION');
    const peak = by(run(80, sim).telemetry, 'mert').resp.coreTemp_C;
    sim.setScenario('NORMAL');
    const soon = by(run(10, sim).telemetry, 'mert').resp.coreTemp_C;
    const later = by(run(150, sim).telemetry, 'mert').resp.coreTemp_C;
    expect(peak - before).toBeGreaterThan(0.8);
    expect(soon - before).toBeGreaterThan((peak - before) * 0.5); // after 10 readings the trace is still clear
    expect(Math.abs(later - before)).toBeLessThan(0.4); // eventually returns to the personal baseline
  });

  it('every SEP event in the solar particle event is in the recorded DONKI data', () => {
    const links = (JSON.parse(donkiSep) as { link: string }[]).map((e) => e.link);
    const sepEvents = SCENARIOS.SOLAR_STORM!.events.filter((e) => e.url?.includes('/SEP/'));
    expect(sepEvents.length).toBeGreaterThan(0);
    for (const e of sepEvents) expect(links).toContain(e.url);
  });

  it('all 5 scenarios are loaded', () => {
    expect(Object.keys(SCENARIOS).sort()).toEqual(['CO2_SCRUBBER_FAIL', 'EVA_OVEREXERTION', 'MARS_DAY_180', 'NORMAL', 'SOLAR_STORM']);
  });
});
