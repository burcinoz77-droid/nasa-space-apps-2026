// Parça 4 · Olay kartındaki mor "ASTRA açıklaması" kutusu. Mor = yapay zekânın sesi;
// Katman 1'in kırmızı/amber uyarısından görsel olarak ayrıdır. Uyarıyı her zaman Katman 1 açar.
//
// Kullanım (Parça 3 olay bandına, Parça 2 Raporlar sayfasına koyar):
//   import { AstraExplanation } from '../components/AstraExplanation';
//   <AstraExplanation incidentId={incident.id} />
//
// Olayın açıklaması yoksa ASTRA'ya BİR KEZ sorar (src/ai/explain.ts) ve sonucu ortak
// durumun explanations alanına yazar. Katman 2 başka hiçbir alana yazmaz.
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
        <span aria-hidden>✦</span> ASTRA açıklaması
      </div>
      {answer ? (
        <>
          <p className="text-sm leading-relaxed text-slate-100">{answer.text}</p>
          <AstraMeta answer={answer} />
        </>
      ) : exists ? (
        <Thinking label="ASTRA olayı inceliyor" />
      ) : (
        <p className="text-sm text-slate-400">Olay bulunamadı.</p>
      )}
    </div>
  );
}

/** Cevabın altındaki satır: kaynak (Gemini / Claude / Yedek mod), süre, doğrulama rozeti. */
export function AstraMeta({ answer }: { answer: AstraAnswer }) {
  const offline = answer.source === 'fallback';
  const safety = answer.fallbackReason === 'safety';
  const label = safety ? 'Yedek cevap · güvenlik süzgeci' : SOURCE_LABEL[answer.source];
  const hint = safety
    ? 'Modelin cevabı ilaç önerisi ya da kesin teşhis içerdiği için gösterilmedi; ayrıntı tarayıcı konsolunda. Bu cevap doğrudan veriden üretildi.'
    : offline
      ? 'Dil modeline ulaşılamadı; cevap doğrudan veriden kural tabanlı üretildi. Sebep tarayıcı konsolunda.'
      : undefined;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span style={{ color: offline ? COLORS.offline : COLORS.ai }} title={hint}>
        {offline ? '◌' : '✦'} {label}
      </span>
      {!offline && <span style={{ color: COLORS.textMuted }}>{fmt(answer.latencyMs / 1000, 1)} sn</span>}
      {!offline && <VerifiedBadge ok={answer.verified} />}
      {!!answer.tools?.length && (
        <span className="basis-full" style={{ color: COLORS.textMuted }} title="ASTRA bu cevap için veriyi şu araçlarla okudu (salt okunur).">
          ⚙ Kullanılan araçlar: {answer.tools.join(' · ')}
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
      title={ok ? 'Cevaptaki her sayı modele gönderilen veride var.' : 'Cevapta veride olmayan bir sayı var; ekrandaki değerle karşılaştırın.'}
    >
      {ok ? '✓ Sayılar doğrulandı' : '▲ Sayıları kontrol et'}
    </span>
  );
}

/** Mor "düşünüyor" animasyonu. */
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
