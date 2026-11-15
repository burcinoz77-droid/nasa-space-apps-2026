// Parça 4 · ASTRA sohbet paneli. Mor renk = yapay zekânın sesi.
// Hazır soru düğmeleri, yükleniyor animasyonu, kaynak (Gemini / Claude / Yedek mod) ve süre
// etiketi, "Sayılar doğrulandı" rozeti, kullanılan araçlar, alttaki sorumluluk satırı ve
// "Sohbeti sıfırla" düğmesi. Sohbet panel kapanınca ya da sayfa yenilenince kaybolmaz (src/ai/chatStore.ts).
// Panel başlığından tutulup sürüklenebilir; yeri hatırlanır, başlığa çift tıklayınca sağ alt köşeye döner.
// Sadece chat alanına yazar.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { askAstra } from '../../ai/client';
import { resetChat } from '../../ai/chatStore';
import { buildContext } from '../../ai/context';
import { useAstra } from '../../store';
import { AstraMeta, Thinking } from './AstraExplanation';

const PRESETS = [
  'Who should rest today?',
  'Why is Kerem at Warning level?',
  'What could be going on with Mert?',
  'How is the radiation situation?',
  'Is CO₂ safe?',
  'Is cabin noise normal?',
  'How is bone loss?',
];

// ---- Sürükleme: panelin sol üst köşesinin ekrandaki yeri (px). null = varsayılan sağ alt köşe.
type Pos = { x: number; y: number };
const POS_KEY = 'astra-panel-konum-v1';
const MARGIN = 8;

function loadPos(): Pos | null {
  try {
    const p = JSON.parse(globalThis.localStorage?.getItem(POS_KEY) ?? 'null') as Pos | null;
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
  } catch {
    return null;
  }
}

function savePos(p: Pos | null) {
  try {
    if (p) globalThis.localStorage?.setItem(POS_KEY, JSON.stringify(p));
    else globalThis.localStorage?.removeItem(POS_KEY);
  } catch {
    // depo kapalıysa konum sadece bu oturumda kalır
  }
}

/** Paneli ekranın içinde tutar (pencere küçülse de kaybolmasın). */
function clampPos(p: Pos, el: HTMLElement | null): Pos {
  const w = el?.offsetWidth ?? 400;
  const h = el?.offsetHeight ?? 560;
  return {
    x: Math.min(Math.max(MARGIN, p.x), Math.max(MARGIN, window.innerWidth - w - MARGIN)),
    y: Math.min(Math.max(MARGIN, p.y), Math.max(MARGIN, window.innerHeight - h - MARGIN)),
  };
}

export function AstraChatPanel() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [waited, setWaited] = useState(0); // saniye; uzun bekleyişte kullanıcı neler olduğunu görsün
  const chat = useAstra((s) => s.chat);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [pos, setPos] = useState<Pos | null>(loadPos);
  const drag = useRef<{ dx: number; dy: number; last: Pos | null } | null>(null);

  // Pencere boyutu değişince panel ekran dışında kalmasın
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clampPos(p, panelRef.current) : p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function startDrag(e: ReactPointerEvent<HTMLElement>) {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return; // kapat düğmesi sürüklemez
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, last: null };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function moveDrag(e: ReactPointerEvent<HTMLElement>) {
    if (!drag.current) return;
    const next = clampPos({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy }, panelRef.current);
    drag.current.last = next;
    setPos(next);
  }

  function endDrag() {
    if (!drag.current) return;
    if (drag.current.last) savePos(drag.current.last); // sadece gerçekten taşındıysa kaydet
    drag.current = null;
  }

  function resetPos() {
    setPos(null);
    savePos(null);
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [chat.length, busy, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setWaited((w) => w + 1), 1000);
    return () => clearInterval(id);
  }, [busy]);

  async function send(text?: string) {
    const q = (text ?? question).trim().slice(0, 600);
    if (!q || busy) return;
    const { addChat } = useAstra.getState();
    addChat({ id: crypto.randomUUID(), role: 'user', text: q, at: Date.now() });
    setQuestion('');
    setWaited(0);
    setBusy(true);
    try {
      const answer = await askAstra({ mode: 'chat', question: q, context: buildContext(useAstra.getState(), { question: q }) });
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
        <span aria-hidden>✦</span> Ask ASTRA
      </button>
    );

  return (
    <section
      ref={panelRef}
      aria-label="ASTRA chat panel"
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      className={`fixed z-40 flex h-[560px] max-h-[calc(100vh-3rem)] w-[400px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-ai/50 bg-space-panel shadow-2xl shadow-black/40 ${pos ? '' : 'right-6 bottom-6'}`}
    >
      <header
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={resetPos}
        title="Drag to move · double-click to return to the bottom-right corner"
        className="flex cursor-move touch-none items-center justify-between border-b border-space-border px-4 py-3 select-none"
      >
        <div>
          <div className="font-semibold text-ai">
            ✦ ASTRA <span className="ml-1 text-sm font-normal text-slate-500" aria-hidden>⠿ move</span>
          </div>
          <div className="text-sm text-slate-400">Layer 2 · decision support</div>
        </div>
        <button onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/5" aria-label="Paneli kapat">
          ✕
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-auto p-4 text-sm">
        {chat.length === 0 && (
          <div className="rounded-xl border border-ai/30 bg-ai/10 p-3 leading-relaxed text-slate-200">
            Hello, I'm ASTRA. I answer from the crew's live data and can point out possible conditions, as probabilities, based on changing values. Layer 1 raises the alerts; you make the decisions.
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
        {busy && <Thinking label={waited < 5 ? 'ASTRA is thinking' : `ASTRA is reviewing the data · ${waited} s`} />}
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
          placeholder="e.g. What is Elif's heart rate?"
          aria-label="Question for ASTRA"
          className="min-w-0 flex-1 rounded-lg bg-white/5 px-3 py-2 text-sm outline-none ring-ai/50 focus:ring-1"
        />
        <button type="submit" disabled={busy || !question.trim()} className="rounded-lg bg-ai px-4 text-sm font-semibold text-space-bg disabled:opacity-50">
          Ask
        </button>
      </form>
      <div className="flex items-start justify-between gap-3 px-4 pb-3">
        <p className="text-sm leading-snug text-slate-400">
          ASTRA advises; the crew decides. It never gives a definitive diagnosis, never recommends medication, and cannot raise alerts.
        </p>
        <button
          type="button"
          onClick={resetChat}
          disabled={busy || chat.length === 0}
          className="shrink-0 rounded-lg border border-space-border px-2.5 py-1 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-40"
          title="Clears the chat; ASTRA forgets previous messages."
        >
          ↺ Reset chat
        </button>
      </div>
    </section>
  );
}
