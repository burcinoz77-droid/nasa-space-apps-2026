// Part 4 · The purple "ASTRA explanation" box on the incident card. Purple = the voice of the AI;
// visually separate from Layer 1's red/amber alert. Layer 1 always raises the alert.
//
// Usage (Part 3 puts it in the incident banner, Part 2 on the Reports page):
//   import { AstraExplanation } from '../components/AstraExplanation';
//   <AstraExplanation incidentId={incident.id} />
//
// If the incident has no explanation, asks ASTRA ONCE (src/ai/explain.ts) and writes the result to the
// explanations field of the shared state. Layer 2 writes to no other field.
import { useEffect } from 'react';
import { requestExplanation } from '../../ai/explain';
import { SOURCE_LABEL } from '../../ai/labels';
import { useAstra } from '../../store';
import type { AstraAnswer } from '../../types';
import { COLORS, fmt } from '../theme';

export function AstraExplanation({ incidentId }: { incidentId: string }) {
  const answer = useAstra((s) => s.explanations[incidentId]);
  const exists = useAstra((s) => s.incidents.some((i) => i.id === incidentId));

  useEffect(() => {
    if (!answer && exists) requestExplanation(incidentId);
  }, [answer, exists, incidentId]);

  return (
    <div className="rounded-xl border border-ai/40 bg-ai/10 px-4 py-3" aria-live="polite">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-ai">
        <span aria-hidden>✦</span> ASTRA explanation
      </div>
      {answer ? (
        <>
          <p className="text-sm leading-relaxed text-slate-100">{answer.text}</p>
          <AstraMeta answer={answer} />
        </>
      ) : exists ? (
        <Thinking label="ASTRA is reviewing the incident" />
      ) : (
        <p className="text-sm text-slate-400">Incident not found.</p>
      )}
    </div>
  );
}

/** Line under the answer: source (Gemini / Claude / Offline mode), duration, verification badge. */
export function AstraMeta({ answer }: { answer: AstraAnswer }) {
  const offline = answer.source === 'fallback';
  const safety = answer.fallbackReason === 'safety';
  const label = safety ? 'Fallback answer · safety filter' : SOURCE_LABEL[answer.source];
  const hint = safety
    ? 'The model answer was hidden because it contained a medication recommendation or a definitive diagnosis; details in the browser console. This answer was generated directly from the data.'
    : offline
      ? 'The language model could not be reached; this answer was generated from the data by rules. Reason in the browser console.'
      : undefined;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span style={{ color: offline ? COLORS.offline : COLORS.ai }} title={hint}>
        {offline ? '◌' : '✦'} {label}
      </span>
      {!offline && <span style={{ color: COLORS.textMuted }}>{fmt(answer.latencyMs / 1000, 1)} s</span>}
      {!offline && <VerifiedBadge ok={answer.verified} />}
      {!!answer.tools?.length && (
        <span className="basis-full" style={{ color: COLORS.textMuted }} title="ASTRA read the data for this answer with these tools (read-only).">
          ⚙ Tools used: {answer.tools.join(' · ')}
        </span>
      )}
      {!!answer.sources?.length && (
        <span className="basis-full" style={{ color: COLORS.textMuted }}>
          Sources:{' '}
          {answer.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ' · '}
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`${s.ad} (opens in a new tab)`}
                className="underline decoration-dotted underline-offset-2 hover:text-slate-200"
                style={{ color: COLORS.calm }}
              >
                {s.ad.length > 40 ? `${s.ad.slice(0, 39)}…` : s.ad} ↗
              </a>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

export function VerifiedBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 font-semibold"
      style={{ color: ok ? COLORS.normal : COLORS.caution, backgroundColor: `${ok ? COLORS.normal : COLORS.caution}1A` }}
      title={ok ? 'Every number in the answer is present in the data sent to the model.' : 'The answer contains a number not found in the data; compare with the value on screen.'}
    >
      {ok ? '✓ Numbers verified' : '▲ Check the numbers'}
    </span>
  );
}

/** Purple "thinking" animation. */
export function Thinking({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-ai" role="status">
      <span className="flex gap-1" aria-hidden>
        {[0, 150, 300].map((d) => (
          <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ai" style={{ animationDelay: `${d}ms` }} />
        ))}
      </span>
      {label}…
    </div>
  );
}
