// Parça 4 · ASTRA sohbet paneli. Mor renk = yapay zekânın sesi.
// Hazır soru düğmeleri, yükleniyor animasyonu, kaynak (Gemini / Claude / Yedek mod) ve süre
// etiketi, "Sayılar doğrulandı" rozeti, alttaki sorumluluk satırı. Sadece chat alanına yazar.
import { useEffect, useRef, useState } from 'react';
import { askAstra } from '../../ai/client';
import { buildContext } from '../../ai/context';
import { useAstra } from '../../store';
import { AstraMeta, Thinking } from './AstraExplanation';

const PRESETS = ['Bugün kim dinlenmeli?', 'Kerem neden kritik?', 'Radyasyon durumu nasıl?', 'CO₂ güvenli mi?'];

export function AstraChatPanel() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const chat = useAstra((s) => s.chat);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [chat.length, busy, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(text?: string) {
    const q = (text ?? question).trim().slice(0, 600);
    if (!q || busy) return;
    const { addChat } = useAstra.getState();
    addChat({ id: crypto.randomUUID(), role: 'user', text: q, at: Date.now() });
    setQuestion('');
    setBusy(true);
    try {
      const answer = await askAstra({ mode: 'chat', question: q, context: buildContext(useAstra.getState(), { question: q, compact: true }) });
      addChat({ id: crypto.randomUUID(), role: 'astra', text: answer.text, at: Date.now(), answer });
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed right-6 bottom-6 z-40 flex items-center gap-2 rounded-full bg-ai px-5 py-3 font-semibold text-space-bg shadow-lg shadow-ai/20 hover:brightness-110"
      >
        <span aria-hidden>✦</span> ASTRA'ya sor
      </button>
    );

  return (
    <section
      aria-label="ASTRA sohbet paneli"
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      className="fixed right-6 bottom-6 z-40 flex h-[560px] max-h-[calc(100vh-3rem)] w-[400px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-ai/50 bg-space-panel shadow-2xl shadow-black/40"
    >
      <header className="flex items-center justify-between border-b border-space-border px-4 py-3">
        <div>
          <div className="font-semibold text-ai">✦ ASTRA</div>
          <div className="text-sm text-slate-400">Katman 2 · karar desteği</div>
        </div>
        <button onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/5" aria-label="Paneli kapat">
          ✕
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-auto p-4 text-sm">
        {chat.length === 0 && (
          <div className="rounded-xl border border-ai/30 bg-ai/10 p-3 leading-relaxed text-slate-200">
            Merhaba, ben ASTRA. Mürettebatın canlı verisine dayanarak Türkçe cevap veririm. Uyarıları Katman 1 açar; kararı siz verirsiniz.
          </div>
        )}
        {chat.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-xl rounded-br-sm bg-white/10 px-3 py-2">{m.text}</div>
            </div>
          ) : (
            <div key={m.id} className="max-w-[92%]">
              <div className="rounded-xl rounded-bl-sm border-l-2 border-ai bg-ai/15 px-3 py-2 leading-relaxed">{m.text}</div>
              {m.answer && <AstraMeta answer={m.answer} />}
            </div>
          ),
        )}
        {busy && <Thinking label="ASTRA düşünüyor" />}
        <div ref={endRef} />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-space-border px-4 pt-3">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => send(p)}
            disabled={busy}
            className="rounded-full border border-ai/40 px-3 py-1 text-sm text-ai hover:bg-ai/10 disabled:opacity-50"
          >
            {p}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2 px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          ref={inputRef}
          value={question}
          maxLength={600}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Örn: Elif'in nabzı kaç?"
          aria-label="ASTRA'ya soru"
          className="min-w-0 flex-1 rounded-lg bg-white/5 px-3 py-2 text-sm outline-none ring-ai/50 focus:ring-1"
        />
        <button type="submit" disabled={busy || !question.trim()} className="rounded-lg bg-ai px-4 text-sm font-semibold text-space-bg disabled:opacity-50">
          Sor
        </button>
      </form>
      <p className="px-4 pb-3 text-sm leading-snug text-slate-400">
        ASTRA öneri verir, kararı mürettebat verir. Teşhis koymaz, ilaç önermez, uyarı açamaz.
      </p>
    </section>
  );
}
