// Parça 2 testleri buraya. Çalıştırma: npm run test
import { describe, expect, it } from 'vitest';
import { createSimulation } from '../sim';
import { createDetector } from './index';

describe('Katman 1 dedektörü', () => {
  it('her astronot için bir durum üretir', () => {
    const sim = createSimulation(1);
    const det = createDetector();
    const { ship, telemetry } = sim.tick();
    const out = det.process(ship, telemetry);
    expect(Object.keys(out.statuses)).toHaveLength(6);
  });

  // TODO Parça 2: "SpO2 3 ölçüm üst üste z < -3 ise kritik olay açılır" gibi testler ekleyin.
});
