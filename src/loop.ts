// Ana döngü: Simülasyon (Parça 1) -> Katman 1 (Parça 2) -> ortak durum -> ekranlar.
// Bu dosya parçaları birbirine bağlar; değiştirmeden önce ekibe haber verin.
import { createDetector } from './engine';
import { createSimulation } from './sim';
import { useAstra } from './store';
import type { ScenarioId } from './types';

const SCENARIO_NAMES: Record<ScenarioId, string> = {
  NORMAL: 'Normal gün',
  SOLAR_STORM: 'Güneş fırtınası',
  MARS_DAY_180: 'Mars 180. gün yükü',
  CO2_SCRUBBER_FAIL: 'CO₂ temizleyici arızası',
  EVA_OVEREXERTION: 'EVA aşırı efor',
};

const sim = createSimulation();
const detector = createDetector();
let timer: ReturnType<typeof setInterval> | undefined;

function step() {
  const { ship, telemetry } = sim.tick();
  const out = detector.process(ship, telemetry);
  for (const action of out.newActions) sim.onAutoAction(action); // güvenli adımın fiziksel etkisi
  useAstra.getState().applyTick(ship, telemetry, out);
}

function log(text: string) {
  useAstra.getState().addLedger([{ id: `sys-${Date.now()}`, at: Date.now(), kind: 'SCENARIO', text }]);
}

export const controls = {
  start() {
    if (timer) clearInterval(timer);
    step();
    timer = setInterval(step, useAstra.getState().tickMs);
  },
  stop() {
    if (timer) clearInterval(timer);
    timer = undefined;
  },
  setScenario(id: ScenarioId) {
    sim.setScenario(id);
    log(`Senaryo değişti: ${SCENARIO_NAMES[id]}`);
  },
  setSpeed(ms: number) {
    useAstra.getState().setTickMs(ms);
    controls.start();
  },
  acknowledge(incidentId: string) {
    const entry = detector.acknowledge(incidentId);
    if (entry) useAstra.getState().addLedger([entry]);
  },
  reset() {
    sim.reset();
    detector.reset();
    useAstra.getState().clearAll();
    log('Simülasyon sıfırlandı');
    controls.start();
  },
};

export { SCENARIO_NAMES };
