// Part 4 · Incident explanation: asks ASTRA ONCE about an incident raised by Layer 1 and
// writes the result to the explanations field of the shared state. Layer 2 writes to no other field.
// <AstraExplanation /> calls this; even if the same incident is shown on two screens, only one request is sent.
import { METRIC_BY_KEY } from '../metrics';
import { useAstra } from '../store';
import type { Incident } from '../types';
import { askAstra } from './client';
import { buildContext } from './context';
import { ACTION_TR, LEVEL_TR, shortName, valueText } from './labels';

const inflight = new Set<string>();

/** Incident question sent to the model: title, people, signals (value + personal baseline), autonomous action. */
export function incidentQuestion(inc: Incident): string {
  const signals = inc.signals
    .slice(0, 3)
    .map((x) => `${METRIC_BY_KEY[x.key]?.label ?? x.key} ${valueText(x.key, x.value)} (personal baseline ${valueText(x.key, x.mean)})`)
    .join(', ');
  const actions = inc.autoActions.map((a) => ACTION_TR[a]).join(', ');
  return [
    `Incident: ${inc.title}.`,
    `Level: ${LEVEL_TR[inc.level]}.`,
    `Affected: ${inc.crewIds.map(shortName).join(', ')}.`,
    signals && `Signals: ${signals}.`,
    `Autonomous action: ${actions || 'none'}.`,
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 590);
}

/** Requests an explanation for an incident; does nothing if one already exists or a request is in flight. */
export function requestExplanation(incidentId: string): void {
  const s = useAstra.getState();
  if (s.explanations[incidentId] || inflight.has(incidentId)) return;
  const inc = s.incidents.find((i) => i.id === incidentId);
  if (!inc) return;
  inflight.add(incidentId);
  askAstra({ mode: 'incident', question: incidentQuestion(inc), context: buildContext(s, { incident: inc }) })
    .then((answer) => {
      // If "Reset simulation" was pressed in the meantime, do not write an explanation for the old incident.
      if (useAstra.getState().incidents.some((i) => i.id === incidentId)) useAstra.getState().setExplanation(incidentId, answer);
    })
    .finally(() => inflight.delete(incidentId));
}
