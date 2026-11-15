// Parça 2 testleri: Katman 1 dedektörü. Çalıştırma: npm run test
// Bu dosyadaki testler simülasyondan bağımsızdır: sentetik ölçümle (fake) dedektörü sınar.
// Gerçek simülasyon ve senaryolarla testler: scenarios.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { CREW, CREW_IDS } from '../crew';
import type { MetricKey } from '../metrics';
import { createSimulation } from '../sim';
import { gaussian, mulberry32 } from '../sim/random';
import type { CrewId, Detector, DetectorOutput, ShipState, Telemetry } from '../types';
import { BASELINE_WINDOW, RESOLVE_AFTER } from './config';
import { createDetector, scoreDomains } from './index';

// ---------- Sentetik veri ----------
type Overrides = Partial<Record<CrewId | 'KOKPIT' | 'GEZEGEN', Partial<Record<MetricKey, number>>>>;

function normalTelemetry(id: CrewId, eva: boolean, t: number, rand: () => number): Telemetry {
  const j = (sd: number) => gaussian(rand) * sd; // küçük sensör gürültüsü
  return {
    crewId: id,
    t,
    missionDay: 180,
    cardio: { hr_bpm: (eva ? 92 : 68) + j(1.5), hrv_rmssd_ms: 42 + j(2), ecg_rhythm: 'sinus', ecg_ectopic_per_min: 0.2, bp_sys_mmHg: 112 + j(1.5), bp_dia_mmHg: 70 + j(1), spo2_pct: 98 },
    resp: { rr_bpm: (eva ? 22 : 14) + j(0.6), minuteVent_L_min: eva ? 22 : 6.5, etco2_mmHg: 38 + j(0.6), coreTemp_C: (eva ? 37.8 : 37.4) + j(0.04), skinTemp_C: 33.7, gsr_uS: 4 + j(0.2) },
    biochem: { vocOxStressIndex: 20, sweatCortisol_ng_mL: 40 + j(1.5), sweatLactate_mM: eva ? 14 : 10, sweatSodium_mM: 45 },
    cog: { pvtMeanRt_ms: 250, pvtLapses: 1, bsi18_gsi: 5, panasPositive: 33, panasNegative: 17, speechStrainIndex: 25, pupilDiameter_mm: 4.5, pupilLatency_ms: 230 },
    env: {
      doseRate_uSv_h: (eva ? 26.7 : 76.7) + j(1.5),
      doseCumulative_mSv: eva ? 319 : 331,
      ppCO2_mmHg: (eva ? 2.0 : 1.9) + j(0.04),
      o2_pct: eva ? 100 : 21,
      pressure_kPa: eva ? 29.6 : 101.3,
      sleepLastNight_h: 6.1,
      remPct: 22,
      swsPct: 18,
      circadianShift_h: 0.5,
      ambientTemp_C: 22.5,
      humidity_pct: 45,
      noise_dBA: 55,
    },
  };
}

function setMetric(t: Telemetry, key: MetricKey, value: number) {
  const [g, f] = key.split('.') as [keyof Telemetry, string];
  (t[g] as unknown as Record<string, number>)[f] = value;
}

/** Dedektörü ölçüm ölçüm besleyen küçük sürücü. */
function harness() {
  const det: Detector = createDetector();
  const rand = mulberry32(42);
  let tick = 0;
  const all: DetectorOutput[] = [];
  const step = (over: Overrides = {}, rhythm: Partial<Record<CrewId, 'irregular'>> = {}) => {
    const t = 1_000_000 + tick * 1200;
    const telemetry = CREW.map((m) => {
      const tel = normalTelemetry(m.id, m.location === 'GEZEGEN', t, rand);
      for (const scope of [m.location, m.id] as const) for (const [k, v] of Object.entries(over[scope] ?? {})) setMetric(tel, k as MetricKey, v);
      if (rhythm[m.id]) tel.cardio.ecg_rhythm = 'irregular';
      return tel;
    });
    const ship: ShipState = { t, missionDay: 180, scenario: 'NORMAL', commDelayOneWay_s: 750, activeEvents: [] };
    const out = det.process(ship, telemetry);
    all.push(out);
    tick++;
    return out;
  };
  const run = (n: number, over: Overrides = {}, rhythm: Partial<Record<CrewId, 'irregular'>> = {}) => {
    let out!: DetectorOutput;
    for (let i = 0; i < n; i++) out = step(over, rhythm);
    return out;
  };
  const ledger = () => all.flatMap((o) => o.newLedger);
  const actions = () => all.flatMap((o) => o.newActions);
  return { det, step, run, ledger, actions };
}

const KOKPIT_IDS = CREW.filter((c) => c.location === 'KOKPIT').map((c) => c.id);

// ---------- Testler ----------
describe('Katman 1 · kişisel baseline', () => {
  it('her astronot için bir durum üretir', () => {
    const sim = createSimulation(1);
    const det = createDetector();
    const { ship, telemetry } = sim.tick();
    const out = det.process(ship, telemetry);
    expect(Object.keys(out.statuses)).toHaveLength(6);
  });

  it(`baseline ilk ${BASELINE_WINDOW} ölçümde kurulur, sonra donar ve anomaliyle kirlenmez`, () => {
    const h = harness();
    const before = h.run(BASELINE_WINDOW - 1);
    // Kalibrasyon sürerken z-skoru yok: herkes %100, seviye normal
    expect(Object.values(before.statuses).every((s) => s.healthScore === 100 && s.level === 'normal')).toBe(true);
    expect(h.ledger().some((e) => e.text.includes('Personal baselines set'))).toBe(false);

    h.step(); // 30. ölçüm
    expect(h.ledger().filter((e) => e.text.includes('Personal baselines set'))).toHaveLength(1);

    // 31. ölçümden itibaren Elif'in nabzı +30 bpm: z hesaplanır, ama baseline ortalaması değişmez
    const out = h.run(20, { elif: { 'cardio.hr_bpm': 98 } });
    const hr = out.statuses.elif.topSignals.find((s) => s.key === 'cardio.hr_bpm')!;
    expect(hr).toBeDefined();
    expect(hr.mean).toBeGreaterThan(66);
    expect(hr.mean).toBeLessThan(70); // donmuş: 20 ölçümlük anomali ortalamayı kirletmedi
    expect(hr.z).toBeGreaterThan(3);
    expect(hr.level).toBe('critical');
  });

  it('günlük ölçümlerde sd = 0 iken z sonsuza gitmez (sd tabanı)', () => {
    const h = harness();
    h.run(BASELINE_WINDOW);
    // Uyku 6,1 → 5,5 sa: taban 0,4 sa ile z = −1,5 → normal kalmalı
    const out = h.run(5, { elif: { 'env.sleepLastNight_h': 5.5 } });
    const all = out.statuses.elif.topSignals;
    expect(all.every((s) => Number.isFinite(s.z))).toBe(true);
    expect(out.statuses.elif.level).toBe('normal');
  });
});

describe('Katman 1 · erken uyarı (ardışık ölçüm kuralı)', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness();
    h.run(BASELINE_WINDOW);
  });

  it('tek bir sıçrama olay açmaz (iki ardışık da açmaz)', () => {
    h.step({ KOKPIT: { 'env.doseRate_uSv_h': 2000 } });
    h.run(5);
    h.run(2, { KOKPIT: { 'env.doseRate_uSv_h': 2000 } });
    const out = h.run(5);
    expect(out.incidents).toHaveLength(0);
    expect(h.actions()).toHaveLength(0);
    expect(Object.values(out.statuses).every((s) => s.level === 'normal')).toBe(true);
  });

  it('3 ardışık sıçrama olay açar: radyasyon kritik + sığınak (Kokpit ekibi)', () => {
    h.run(2, { KOKPIT: { 'env.doseRate_uSv_h': 2000 } });
    expect(h.step().incidents).toHaveLength(0); // arada normal ölçüm: sayaç sıfırlanır
    const out = h.run(3, { KOKPIT: { 'env.doseRate_uSv_h': 2000 } });
    expect(out.incidents).toHaveLength(1);
    const inc = out.incidents[0];
    expect(inc.type).toBe('RADIATION');
    expect(inc.level).toBe('critical');
    expect(inc.crewIds).toEqual(KOKPIT_IDS);
    expect(inc.autoActions).toEqual(['RADIATION_SHELTER']);
    const acts = h.actions();
    expect(acts).toHaveLength(1);
    expect(acts[0]).toMatchObject({ type: 'RADIATION_SHELTER', crewIds: KOKPIT_IDS, incidentId: inc.id });
    expect(h.ledger().map((e) => e.kind)).toEqual(expect.arrayContaining(['INCIDENT_OPENED', 'AUTO_ACTION']));
    for (const id of KOKPIT_IDS) expect(out.statuses[id].level).toBe('critical');
    expect(out.statuses.mert.level).toBe('normal');
  });

  it('ppCO₂ 3,1 mmHg kritik: CO2 olayı + havalandırma artırılır', () => {
    const out = h.run(3, { KOKPIT: { 'env.ppCO2_mmHg': 3.1 } });
    const inc = out.incidents.find((i) => i.type === 'CO2')!;
    expect(inc).toBeDefined();
    expect(inc.level).toBe('critical');
    expect(inc.signals[0]).toMatchObject({ key: 'env.ppCO2_mmHg', value: 3.1 });
    expect(h.actions().map((a) => a.type)).toEqual(['INCREASE_VENTILATION']);
    expect(h.ledger().find((e) => e.kind === 'AUTO_ACTION')!.text).toContain('Ventilation increased');
  });

  it('aynı olay ikinci kez açılmaz, otonom adım olay başına bir kez', () => {
    h.run(25, { KOKPIT: { 'env.ppCO2_mmHg': 3.1 } });
    const out = h.step({ KOKPIT: { 'env.ppCO2_mmHg': 3.1 } });
    expect(out.incidents.filter((i) => i.type === 'CO2')).toHaveLength(1);
    expect(h.actions()).toHaveLength(1);
    expect(h.ledger().filter((e) => e.kind === 'INCIDENT_OPENED')).toHaveLength(1);
  });

  it('dikkat → kritik: aynı olay yükselir, havalandırma sadece kritikte', () => {
    const caution = h.run(3, { KOKPIT: { 'env.ppCO2_mmHg': 2.5 } });
    const id = caution.incidents[0].id;
    expect(caution.incidents[0].level).toBe('caution');
    expect(h.actions()).toHaveLength(0);
    const crit = h.run(3, { KOKPIT: { 'env.ppCO2_mmHg': 3.2 } });
    expect(crit.incidents).toHaveLength(1);
    expect(crit.incidents[0]).toMatchObject({ id, level: 'critical' });
    expect(h.actions().map((a) => a.type)).toEqual(['INCREASE_VENTILATION']);
  });

  it(`sinyaller ${RESOLVE_AFTER} ölçüm normal kalınca olay çözülür ve kayda düşer`, () => {
    h.run(3, { KOKPIT: { 'env.ppCO2_mmHg': 3.1 } });
    // Seviye 3 ölçümde iner (histerezis), sonra 10 ölçüm normal sayılır
    let out = h.run(3 + RESOLVE_AFTER - 2);
    expect(out.incidents[0].status).toBe('open');
    out = h.run(1);
    expect(out.incidents[0].status).toBe('resolved');
    const resolved = h.ledger().filter((e) => e.kind === 'INCIDENT_RESOLVED');
    expect(resolved).toHaveLength(1);
    expect(resolved[0].text).toMatch(/^Resolved/);
  });

  it('resmi normal aralıktaki değer uyarı vermez: EtCO₂ 44 mmHg (normal 35–45) sorun değil, 48 mmHg sorun', () => {
    const inRange = h.run(6, { KOKPIT: { 'resp.etco2_mmHg': 44 } });
    expect(inRange.statuses.elif.level).toBe('normal');
    expect(inRange.statuses.elif.domainScores.resp).toBe(100);
    const out = h.run(6, { KOKPIT: { 'resp.etco2_mmHg': 48 } });
    expect(out.statuses.elif.level).not.toBe('normal');
  });

  it('mürettebat onayı: olay "acknowledged" olur, kayda ACK düşer, ikinci onay boş döner', () => {
    const out = h.run(3, { KOKPIT: { 'env.ppCO2_mmHg': 3.1 } });
    const id = out.incidents[0].id;
    const ack = h.det.acknowledge(id);
    expect(ack).toMatchObject({ kind: 'ACK', incidentId: id });
    expect(h.det.acknowledge(id)).toBeNull();
    expect(h.det.acknowledge('yok-boyle-bir-olay')).toBeNull();
    expect(h.step({ KOKPIT: { 'env.ppCO2_mmHg': 3.1 } }).incidents[0].status).toBe('acknowledged');
  });

  it('onaylanmış dikkat olayı kritikleşirse yeniden onay ister', () => {
    const out = h.run(3, { KOKPIT: { 'env.ppCO2_mmHg': 2.5 } });
    h.det.acknowledge(out.incidents[0].id);
    const crit = h.run(3, { KOKPIT: { 'env.ppCO2_mmHg': 3.2 } });
    expect(crit.incidents[0]).toMatchObject({ level: 'critical', status: 'open' });
  });
});

describe('Katman 1 · olay kuralları', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness();
    h.run(BASELINE_WINDOW);
  });

  it('mutlak eşikler baseline kurulmadan da çalışır (ilk ölçümlerde CO₂)', () => {
    const fresh = harness();
    const out = fresh.run(4, { KOKPIT: { 'env.ppCO2_mmHg': 3.3 } });
    expect(out.incidents.map((i) => [i.type, i.level])).toEqual([['CO2', 'critical']]);
  });

  it('yorgunluk: 5 sinyalden 3\'ü dikkatte → FATIGUE + zorunlu dinlenme, restRequired', () => {
    const two = h.run(4, { elif: { 'env.sleepLastNight_h': 5.1, 'cog.pvtMeanRt_ms': 300 } });
    expect(two.incidents).toHaveLength(0); // 2 sinyal yetmez
    const out = h.run(3, { elif: { 'env.sleepLastNight_h': 5.1, 'cog.pvtMeanRt_ms': 300, 'cog.bsi18_gsi': 10 } });
    const inc = out.incidents.find((i) => i.type === 'FATIGUE')!;
    expect(inc).toMatchObject({ level: 'caution', crewIds: ['elif'], autoActions: ['MANDATORY_REST'] });
    expect(inc.title).toContain('sleep + reaction time');
    expect(out.statuses.elif.restRequired).toBe(true);
    expect(out.statuses.kerem.restRequired).toBe(false);
  });

  it('zorunlu dinlenme olay çözülünce kalkar', () => {
    h.run(3, { mert: { 'resp.coreTemp_C': 38.6 } });
    let out = h.step({ mert: { 'resp.coreTemp_C': 38.6 } });
    expect(out.incidents[0]).toMatchObject({ type: 'THERMAL', level: 'caution', autoActions: ['MANDATORY_REST'] });
    expect(out.statuses.mert.restRequired).toBe(true);
    out = h.run(3 + RESOLVE_AFTER);
    expect(out.incidents[0].status).toBe('resolved');
    expect(out.statuses.mert.restRequired).toBe(false);
  });

  it('SpO₂ < 94 dikkat, < 90 kritik; HYPOXIA otonom adım açmaz (karar insanın)', () => {
    const c = h.run(3, { deniz: { 'cardio.spo2_pct': 92 } });
    expect(c.incidents[0]).toMatchObject({ type: 'HYPOXIA', level: 'caution' });
    const k = h.run(3, { deniz: { 'cardio.spo2_pct': 88 } });
    expect(k.incidents[0]).toMatchObject({ type: 'HYPOXIA', level: 'critical', autoActions: [] });
    expect(k.incidents[0].title).toContain('medical check recommended');
    expect(h.actions()).toHaveLength(0);
  });

  it('EKG ritmi 3 ölçüm "irregular" → CARDIO dikkat, teşhis koymayan başlık', () => {
    h.run(2, {}, { zeynep: 'irregular' });
    expect(h.step().incidents).toHaveLength(0);
    const out = h.run(3, {}, { zeynep: 'irregular' });
    expect(out.incidents[0]).toMatchObject({ type: 'CARDIO', level: 'caution', crewIds: ['zeynep'] });
    expect(out.incidents[0].title).toBe('Zeynep: irregular beats on ECG, medical check recommended');
  });

  it('STRESS: GSR + ter kortizolü + PANAS olumsuz üçü birden dikkatteyse', () => {
    const two = h.run(4, { kerem: { 'resp.gsr_uS': 5.8, 'biochem.sweatCortisol_ng_mL': 53 } });
    expect(two.incidents).toHaveLength(0);
    const out = h.run(3, { kerem: { 'resp.gsr_uS': 5.8, 'biochem.sweatCortisol_ng_mL': 53, 'cog.panasNegative': 24 } });
    expect(out.incidents.map((i) => i.type)).toEqual(['STRESS']);
  });

  it('MULTI: aynı kişide 2 vücut alanı kritik → kritik; çevre alanı sayılmaz', () => {
    const env = h.run(3, { mert: { 'cardio.hr_bpm': 125, 'env.doseRate_uSv_h': 900 } });
    expect(env.incidents.map((i) => i.type)).toEqual(['RADIATION']); // kalp + çevre: MULTI yok
    const out = h.run(3, { mert: { 'cardio.hr_bpm': 125, 'resp.rr_bpm': 32 } });
    const multi = out.incidents.find((i) => i.type === 'MULTI')!;
    expect(multi).toMatchObject({ level: 'critical', crewIds: ['mert'] });
    expect(multi.title).toBe('Mert: simultaneous warning-level deviation in cardiovascular and respiratory/metabolic');
  });

  it('toplam doz ≥ 480 mSv dikkat (kariyer limitinin %80\'i), sığınak açmaz', () => {
    const out = h.run(3, { emir: { 'env.doseCumulative_mSv': 485 } });
    expect(out.incidents[0]).toMatchObject({ type: 'RADIATION', level: 'caution', crewIds: ['emir'], autoActions: [] });
    expect(out.incidents[0].title).toContain('600 mSv');
  });

  it('reset her şeyi sıfırlar', () => {
    h.run(3, { KOKPIT: { 'env.ppCO2_mmHg': 3.1 } });
    h.det.reset();
    const out = h.step();
    expect(out.incidents).toHaveLength(0);
    expect(out.statuses.elif.healthScore).toBe(100); // yeniden kalibrasyonda
  });
});

describe('Katman 1 · sağlık skoru', () => {
  it('alan skoru = 100 − 12 × Σ max(0, riskZ − 1); healthScore = 5 alanın ortalaması', () => {
    const riskZ = { 'cardio.hr_bpm': 4, 'resp.rr_bpm': 0.5 } as Record<MetricKey, number>;
    const { domainScores, healthScore } = scoreDomains(riskZ);
    expect(domainScores).toEqual({ cardio: 64, resp: 100, biochem: 100, cog: 100, env: 100 });
    expect(healthScore).toBe(93); // (64 + 4 × 100) / 5 = 92,8
  });

  it('skor 0–100 arasına kırpılır', () => {
    const { domainScores } = scoreDomains({ 'env.doseRate_uSv_h': 400 } as Record<MetricKey, number>);
    expect(domainScores.env).toBe(0);
  });

  it('normal veride herkes yüksek skorda, topSignals 3 ölçüm', () => {
    const h = harness();
    const out = h.run(BASELINE_WINDOW + 40);
    for (const id of CREW_IDS) {
      expect(out.statuses[id].healthScore).toBeGreaterThanOrEqual(90);
      expect(out.statuses[id].topSignals).toHaveLength(3);
    }
  });
});
