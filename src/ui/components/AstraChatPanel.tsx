// Parça 4 · ASTRA sohbet paneli (v0: çalışan en basit hâli). Mor renk = yapay zekânın sesi.
// TODO Parça 4: hazır soru düğmeleri, "Doğrulandı" rozeti, kaynak (Gemini/Claude/yedek) etiketi, yükleniyor animasyonu.
import { useState } from 'react';
import { askAstra } from '../../ai/client';
import { buildContext } from '../../ai/context';
import { useAstra } from '../../store';

export function AstraChatPanel() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const chat = useAstra((s) => s.chat);

  async function send() {
    const q = question.trim();
    if (!q || busy) return;
    const { addChat } = useAstra.getState();
    addChat({ id: crypto.randomUUID(), role: 'user', text: q, at: Date.now() });
    setQuestion('');
    setBusy(true);
    const answer = await askAstra({ mode: 'chat', question: q, context: buildContext(useAstra.getState()) });
    addChat({ id: crypto.randomUUID(), role: 'astra', text: answer.text, at: Date.now(), answer });
    setBusy(false);
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="fixed right-6 bottom-6 rounded-full bg-ai px-5 py-3 font-semibold text-space-bg shadow-lg">
        ASTRA'ya sor
      </button>
    );

  return (
    <div className="fixed right-6 bottom-6 flex h-[480px] w-[380px] flex-col rounded-2xl border border-ai/50 bg-space-panel">
      <div className="flex items-center justify-between border-b border-space-border p-3">
        <span className="font-semibold text-ai">ASTRA · karar desteği</span>
        <button onClick={() => setOpen(false)} className="text-slate-400">✕</button>
      </div>
      <div className="flex-1 space-y-2 overflow-auto p-3 text-sm">
        {chat.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'text-right' : ''}>
            <div className={`inline-block rounded-lg px-3 py-2 ${m.role === 'user' ? 'bg-white/10' : 'bg-ai/15'}`}>{m.text}</div>
            {m.answer && <div className="mt-1 font-mono text-[10px] text-slate-400">{m.answer.source} · {m.answer.latencyMs} ms · {m.answer.verified ? 'sayılar doğrulandı' : 'sayıları kontrol et'}</div>}
          </div>
        ))}
        {busy && <div className="text-ai">ASTRA düşünüyor…</div>}
      </div>
      <div className="flex gap-2 border-t border-space-border p-3">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Örn: Bugün kim dinlenmeli?"
          className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-sm outline-none"
        />
        <button onClick={send} className="rounded-lg bg-ai px-3 text-sm font-semibold text-space-bg">Sor</button>
      </div>
      <div className="px-3 pb-2 text-[10px] text-slate-400">ASTRA öneri verir, kararı mürettebat verir. Teşhis koymaz, ilaç önermez.</div>
    </div>
  );
}
