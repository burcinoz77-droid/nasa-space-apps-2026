// Parça 4 · Olay açıklaması: Katman 1'in açtığı bir olay için ASTRA'ya BİR KEZ sorar ve
// sonucu ortak durumun explanations alanına yazar. Katman 2 başka hiçbir alana yazmaz.
// <AstraExplanation /> bunu çağırır; aynı olay iki ekranda gösterilse de istek tek gider.
import { METRIC_BY_KEY } from '../metrics';
import { useAstra } from '../store';
import type { Incident } from '../types';
import { askAstra } from './client';
import { buildContext } from './context';
import { ACTION_TR, LEVEL_TR, shortName, valueText } from './labels';

const inflight = new Set<string>();

/** Modele giden olay sorusu: başlık, kişiler, sinyaller (değer + kişisel normal), otonom adım. */
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

/** Bir olayın açıklamasını ister; zaten varsa ya da istek yoldaysa hiçbir şey yapmaz. */
export function requestExplanation(incidentId: string): void {
  const s = useAstra.getState();
  if (s.explanations[incidentId] || inflight.has(incidentId)) return;
  const inc = s.incidents.find((i) => i.id === incidentId);
  if (!inc) return;
  inflight.add(incidentId);
  askAstra({ mode: 'incident', question: incidentQuestion(inc), context: buildContext(s, { incident: inc }) })
    .then((answer) => {
      // Bu arada "Simülasyonu sıfırla" basıldıysa eski olaya açıklama yazma.
      if (useAstra.getState().incidents.some((i) => i.id === incidentId)) useAstra.getState().setExplanation(incidentId, answer);
    })
    .finally(() => inflight.delete(incidentId));
}
