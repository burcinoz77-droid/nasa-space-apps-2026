// Parça 2 · Uçtan uca testler: gerçek simülasyon (Parça 1) + Katman 1, loop.ts ile aynı akış.
// Plandaki "Bitti kriteri": Normal'de 5 dk yanlış alarm yok; her senaryo doğru olayı açar ve otonom
// adım kayda düşer; senaryo bitince olaylar kendiliğinden çözülür.
// Senaryo testleri, simülasyon senaryoları uygulamıyorsa (kitteki v0) kendiliğinden atlanır.
import { describe, expect, it } from 'vitest';
import { CREW } from '../crew';
import { createSimulation } from '../sim';
import type { AutoAction, DetectorOutput, Incident, LedgerEntry, ScenarioId } from '../types';
import { BASELINE_WINDOW } from './config';
import { createDetector } from './index';

const TICKS_5_MIN = Math.ceil((5 * 60) / 1.2); // 1,2 sn örneklemede 5 dakika = 250 ölçüm

function world(seed = 2026) {
  const sim = createSimulation(seed);
  const det = createDetector();
  const ledger: LedgerEntry[] = [];
  const actions: AutoAction[] = [];
  let last!: DetectorOutput;
  const run = (n: number) => {
    for (let i = 0; i < n; i++) {
      const { ship, telemetry } = sim.tick();
      last = det.process(ship, telemetry);
      for (const a of last.newActions) sim.onAutoAction(a); // loop.ts ile aynı
      ledger.push(...last.newLedger);
      actions.push(...last.newActions);
    }
    return last;
  };
  return { sim, det, run, ledger, actions, get last() { return last; } };
}

/** Simülasyon senaryoları uyguluyor mu? (Kitteki v0 uygulamaz; o zaman senaryo testleri atlanır.) */
function simulationHasScenarios(): boolean {
  const sim = createSimulation(1);
  for (let i = 0; i < 5; i++) sim.tick();
  sim.setScenario('CO2_SCRUBBER_FAIL');
  let ppCO2 = 0;
  for (let i = 0; i < 80; i++) ppCO2 = sim.tick().telemetry[0].env.ppCO2_mmHg;
  return ppCO2 > 2.5;
}

describe('Uçtan uca · Normal gün', () => {
  for (const seed of [2026, 1, 7, 42, 99]) {
    it(`seed ${seed}: 5 dakika boyunca hiç olay açılmaz, kimse dikkat/kritik olmaz`, () => {
      const w = world(seed);
      w.run(BASELINE_WINDOW);
      let worst = 0;
      for (let i = 0; i < TICKS_5_MIN; i++) {
        const out = w.run(1);
        for (const s of Object.values(out.statuses)) if (s.level !== 'normal') worst++;
      }
      expect(w.last.incidents).toHaveLength(0);
      expect(w.actions).toHaveLength(0);
      expect(worst).toBe(0);
    });
  }
});

const SCENARIOS_READY = simulationHasScenarios();

describe.skipIf(!SCENARIOS_READY)('Uçtan uca · senaryolar (Parça 1 simülasyonuyla)', () => {
  const ids = (loc: 'KOKPIT' | 'GEZEGEN') => CREW.filter((c) => c.location === loc).map((c) => c.id);

  /** Baseline + senaryo + Normal'e dönüş. */
  function play(id: ScenarioId, ticks = 160) {
    const w = world();
    w.run(BASELINE_WINDOW + 10);
    w.sim.setScenario(id);
    const during = w.run(ticks);
    const opened: Incident[] = [...during.incidents];
    w.sim.setScenario('NORMAL');
    const after = w.run(120);
    return { w, opened, after };
  }

  const allResolved = (out: DetectorOutput) => out.incidents.every((i) => i.status === 'resolved');

  it('Güneş fırtınası: Kokpit ve Gezegen için radyasyon kritik + sığınak; sonra çözülür', () => {
    const { w, opened, after } = play('SOLAR_STORM');
    const rad = opened.filter((i) => i.type === 'RADIATION');
    expect(rad.map((i) => i.crewIds).sort()).toEqual([ids('GEZEGEN'), ids('KOKPIT')].sort());
    expect(rad.every((i) => i.level === 'critical' && i.autoActions.includes('RADIATION_SHELTER'))).toBe(true);
    expect(w.actions.filter((a) => a.type === 'RADIATION_SHELTER')).toHaveLength(2);
    expect(allResolved(after)).toBe(true);
  });

  it('CO₂ temizleyici arızası: CO2 kritik + havalandırma; CO₂ düşer ve olay çözülür', () => {
    const { w, opened, after } = play('CO2_SCRUBBER_FAIL');
    const co2 = opened.find((i) => i.type === 'CO2')!;
    expect(co2).toMatchObject({ level: 'critical', crewIds: ids('KOKPIT'), autoActions: ['INCREASE_VENTILATION'] });
    // Havalandırma senaryo sürerken CO₂'yi düşürür: olay senaryo bitmeden çözülmüş olmalı
    expect(co2.status).toBe('resolved');
    expect(w.ledger.some((e) => e.kind === 'AUTO_ACTION' && e.text.startsWith('Ventilation increased'))).toBe(true);
    expect(allResolved(after)).toBe(true);
  });

  it('Mars 180. gün yükü: Elif\'te yorgunluk + zorunlu dinlenme; diğerlerinde yorgunluk olayı yok', () => {
    const { w, opened, after } = play('MARS_DAY_180');
    const fat = opened.filter((i) => i.type === 'FATIGUE');
    expect(fat.map((i) => i.crewIds)).toEqual([['elif']]);
    expect(fat[0].autoActions).toEqual(['MANDATORY_REST']);
    expect(w.actions.find((a) => a.type === 'MANDATORY_REST')!.crewIds).toEqual(['elif']);
    expect(allResolved(after)).toBe(true);
    expect(after.statuses.elif.restRequired).toBe(false);
  });

  it('EVA aşırı efor: Mert\'te ısı yükü + zorunlu dinlenme; çekirdek sıcaklık düşer', () => {
    const { w, opened, after } = play('EVA_OVEREXERTION');
    const th = opened.find((i) => i.type === 'THERMAL')!;
    expect(th).toMatchObject({ crewIds: ['mert'], autoActions: ['MANDATORY_REST'] });
    expect(opened.find((i) => i.type === 'MULTI')?.crewIds).toEqual(['mert']);
    expect(w.actions.map((a) => a.type)).toEqual(['MANDATORY_REST']);
    expect(allResolved(after)).toBe(true);
  });

  it('senaryo kalibrasyon bitmeden başlarsa baseline erken donar, olay yine açılır', () => {
    const w = world();
    w.run(12);
    w.sim.setScenario('SOLAR_STORM');
    const out = w.run(40);
    expect(w.ledger.some((e) => e.text.includes('frozen early'))).toBe(true);
    expect(out.incidents.some((i) => i.type === 'RADIATION' && i.level === 'critical')).toBe(true);
  });
});
