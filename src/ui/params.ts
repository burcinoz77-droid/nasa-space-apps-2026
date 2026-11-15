// Part 3 · Sourced constants used only in the UI. Same format as PARAMS (src/sim/parameters.ts);
// Part 1 can move them into PARAMS if wanted, SourceBadge reads both.
import type { Param } from '../sim/parameters';

export const UI_PARAMS = {
  // Mission progress ring on Mission Status: conjunction-class Mars mission ~180 days out + ~540 days at Mars + ~180 days back
  missionDurationDays: {
    label: 'Total mission duration (conjunction-class Mars mission)',
    value: 900,
    unit: 'days (approx.)',
    source: 'NASA Mars DRA 5.0 (Drake 2009)',
    url: 'https://ntrs.nasa.gov/api/citations/20090010571/downloads/20090010571.pdf',
  },
} satisfies Record<string, Param>;
