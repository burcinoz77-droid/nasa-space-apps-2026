// Parça 1 · Hangi senaryonun sinematiği var. Yeni sinematik: buraya bir satır.
import type { ComponentType } from 'react';
import type { ScenarioId } from '../../types';
import { Co2Show } from './Co2Show';
import { StormShow } from './StormShow';

export { CINEMATIC_EVENT } from './phases';

export const SHOWS: Partial<Record<ScenarioId, ComponentType<{ onClose: () => void }>>> = {
  SOLAR_STORM: StormShow,
  CO2_SCRUBBER_FAIL: Co2Show,
};
