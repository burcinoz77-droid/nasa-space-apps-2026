// Parça 1 testleri. Çalıştırma: npm run test
import { describe, expect, it } from 'vitest';
import { createSimulation } from './index';
import { PARAMS } from './parameters';
import type { Telemetry } from '../types';

const run = (n: number, sim = createSimulation(7)) => {
  let last: ReturnType<typeof sim.tick> | undefined;
  for (let i = 0; i < n; i++) last = sim.tick();
  return last!;
};
const by = (tel: Telemetry[], id: string) => tel.find((t) => t.crewId === id)!;

describe('Simülasyon', () => {
  it('aynı seed aynı veriyi üretir; sıfırlama baştan aynı veriyi verir', () => {
    const a = createSimulation(7);
    const b = createSimulation(7);
    const ta = [a.tick(), a.tick()].map((x) => x.telemetry);
    const tb = [b.tick(), b.tick()].map((x) => x.telemetry);
    expect(ta.map((t) => t.map((x) => ({ ...x, t: 0 })))).toEqual(tb.map((t) => t.map((x) => ({ ...x, t: 0 }))));
    a.reset();
    expect({ ...a.tick().telemetry[0], t: 0 }).toEqual({ ...ta[0][0], t: 0 });
  });

  it('6 kişinin baseline nabzı birbirinden farklı; Zeynep Kokpit\'te en düşük (demo seed\'i)', () => {
    const sim = createSimulation(); // demo seed'i 2026
    const sum: Record<string, number> = {};
    for (let i = 0; i < 60; i++) for (const t of sim.tick().telemetry) sum[t.crewId] = (sum[t.crewId] ?? 0) + t.cardio.hr_bpm / 60;
    expect(new Set(Object.values(sum).map((v) => Math.round(v))).size).toBeGreaterThan(3);
    expect(sum.zeynep).toBeLessThan(Math.min(sum.elif, sum.kerem));
  });

  it('normal günde değerler makul aralıkta kalır', () => {
    const sim = createSimulation(3);
    for (let i = 0; i < 300; i++) {
      for (const t of sim.tick().telemetry) {
        expect(t.cardio.spo2_pct).toBeGreaterThanOrEqual(94);
        expect(t.cardio.hr_bpm).toBeGreaterThan(45);
        expect(t.cardio.hr_bpm).toBeLessThan(110);
        expect(t.env.ppCO2_mmHg).toBeLessThan(2.3);
        expect(t.cardio.ecg_rhythm).toBe('sinus');
      }
    }
  });

  it('günlük ölçümler normal günde her tick değişmez', () => {
    const sim = createSimulation(5);
    run(40, sim);
    const a = sim.tick().telemetry[0].env.sleepLastNight_h;
    const b = sim.tick().telemetry[0].env.sleepLastNight_h;
    expect(Math.abs(a - b)).toBeLessThan(1e-6);
  });

  it('toplam doz 180. günde ~330 mSv ve zamanla artar', () => {
    const sim = createSimulation(1);
    const first = by(sim.tick().telemetry, 'elif').env.doseCumulative_mSv;
    expect(first).toBeGreaterThan(320);
    expect(first).toBeLessThan(340);
    const later = by(run(50, sim).telemetry, 'elif').env.doseCumulative_mSv;
    expect(later).toBeGreaterThan(first);
  });

  it('güneş fırtınası Kokpit doz hızını sıçratır, sığınak düşürür, olay bitince normale döner', () => {
    const sim = createSimulation(9);
    run(30, sim);
    sim.setScenario('SOLAR_STORM');
    const { ship, telemetry } = run(60, sim);
    const base = PARAMS.doseRateMarsTransit.value * 1000 / 24; // 76,7 µSv/sa
    expect(ship.activeEvents.length).toBeGreaterThan(0);
    const elif = by(telemetry, 'elif').env.doseRate_uSv_h;
    expect(elif).toBeGreaterThan(base * 40);
    expect(by(telemetry, 'emir').env.doseRate_uSv_h).toBeLessThan(elif / 5);
    sim.onAutoAction({ type: 'RADIATION_SHELTER', crewIds: ['elif'], at: 0, reason: 'test', incidentId: 'x' });
    const sheltered = by(run(15, sim).telemetry, 'elif').env.doseRate_uSv_h;
    expect(sheltered).toBeLessThan(elif * 0.45);
    const after = by(run(80, sim).telemetry, 'elif').env.doseRate_uSv_h;
    expect(after).toBeLessThan(base * 1.3);
  });
});
