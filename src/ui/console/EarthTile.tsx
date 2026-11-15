// Parça 3 · Konsol: "Ana istasyon (Dünya)" paneli, iki görünüm.
//  Dünya : Elif'in (sağlık sorumlusu) Houston'daki uçuş cerrahıyla yazışması. Mesaj Dünya'ya gecikmeyle ulaşır,
//          yanıt aynı gecikmeyle döner (src/ui/earthLink.ts). "Durumu ekle" seçili astronotun özetini yazar.
//  ASTRA : Parça 4'ün ASTRA sohbeti konsolun içinde (aynı sohbet geçmişi, aynı askAstra; yüzen panelle ortak).
// İlaç talimatını yalnızca cerrah verir; ASTRA ilaç önermez, teşhis koymaz.
import { useEffect, useRef, useState } from 'react';
import { askAstra } from '../../ai/client';
import { buildContext } from '../../ai/context';
import { CREW_BY_ID } from '../../crew';
import { METRIC_BY_KEY } from '../../metrics';
import { useAstra } from '../../store';
import type { CrewId } from '../../types';
import { REGIONS } from '../bodyRegions';
import { AstraMeta, Thinking } from '../components/AstraExplanation';
import { type CrewMessage, type EarthMessage, realToMissionS, useEarth, worstIncidentOf } from '../earthLink';
import { firstName, fmtDelay, fmtMetric } from '../format';
import { GROUND, MED_BY_ID } from '../medical';
import { alpha, COLORS, fmt } from '../theme';
import { Tile } from './Tile';

type View = 'earth' | 'astra';
const time = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export function EarthTile({ crewId }: { crewId: CrewId }) {
  const [view, setView] = useState<View>('earth');
  const delay = useAstra((s) => s.ship?.commDelayOneWay_s);
  return (
    <Tile area="earth" title="Ground · MCC-Houston" meta={<span className="font-mono">{fmtDelay(delay)}</span>} bodyClass="flex flex-col p-0">
      <div className="flex shrink-0 items-center gap-2 border-b border-space-border/60 px-2 py-1.5">
        <span className="flex rounded-md p-0.5 ring-1 ring-space-border" role="tablist" aria-label="View">
          {(
            [
              ['earth', 'Flight Surgeon'],
              ['astra', '✦ ASTRA'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={`rounded px-2.5 py-0.5 text-sm whitespace-nowrap ${view === id ? (id === 'astra' ? 'bg-ai font-semibold text-space-bg' : 'bg-select font-semibold text-white') : 'text-slate-300 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </span>
        <span className="ml-auto truncate text-sm text-slate-400">{view === 'earth' ? GROUND.name : 'Layer 2 · decision support'}</span>
      </div>
      {view === 'earth' ? <EarthThread crewId={crewId} /> : <AstraChat />}
    </Tile>
  );
}

// ---------- Dünya ----------
function useNow(active: boolean, ms = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [active, ms]);
  return now;
}

/** Seçili astronotun durum özeti: "Flight, CMO: Kerem: ... (chest). SpO₂ 91% (personal baseline 97%)." */
function composeReport(crewId: CrewId): string {
  const s = useAstra.getState();
  const name = firstName(crewId);
  const t = s.telemetry[crewId];
  const st = s.statuses[crewId];
  if (!t) return `Surgeon, no data for ${name} yet.`;
  const inc = worstIncidentOf(s.incidents, crewId);
  const sigs = (inc?.signals.length ? inc.signals : (st?.topSignals ?? [])).slice(0, 2);
  const values = sigs.map((g) => `${METRIC_BY_KEY[g.key].label} ${fmtMetric(g.key, g.value)} (personal baseline ${fmtMetric(g.key, g.mean)})`).join(', ');
  if (inc) {
    const region = REGIONS.find((r) => r.id !== 'env' && r.metrics.includes(sigs[0]?.key));
    return `Surgeon, ${inc.title}${region ? ` (${region.name.toLocaleLowerCase('en-US')} region)` : ''}. ${values}.`;
  }
  return `Surgeon, routine report for ${name}: health score ${fmt(st?.healthScore)}%, heart rate ${fmtMetric('cardio.hr_bpm', t.cardio.hr_bpm)}, SpO₂ ${fmtMetric('cardio.spo2_pct', t.cardio.spo2_pct)}.`;
}

function EarthThread({ crewId }: { crewId: CrewId }) {
  const messages = useEarth((s) => s.messages);
  const send = useEarth((s) => s.send);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const waiting = messages.some((m) => m.kind === 'crew' && !messages.some((r) => r.kind === 'ground' && r.replyTo === m.id));
  const now = useNow(waiting);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const submit = () => {
    if (!text.trim()) return;
    send(text, crewId);
    setText('');
  };

  return (
    <>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto px-3 py-2.5" aria-live="polite">
        {messages.map((m) => (
          <Message key={m.id} m={m} now={now} answered={messages.some((r) => r.kind === 'ground' && r.replyTo === m.id)} />
        ))}
        <div ref={endRef} />
      </div>

      <form
        className="border-t border-space-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          maxLength={600}
          title="Ground replies are generated for the scenario (simulation)"
          placeholder="Message to the Flight Surgeon (Enter sends)"
          aria-label="Message to the Flight Surgeon"
          className="w-full resize-none rounded-md bg-space-bg/60 px-2.5 py-1.5 text-sm text-white ring-1 ring-space-border outline-none placeholder:text-slate-500 focus:ring-calm"
        />
        <div className="mt-1.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setText(composeReport(crewId))}
            className="min-w-0 truncate rounded-md px-2.5 py-1 text-sm text-slate-200 ring-1 ring-space-border hover:bg-white/5"
            title="Writes the selected astronaut's status into the message"
          >
            + Add {firstName(crewId)}'s status
          </button>
          <button type="submit" disabled={!text.trim()} className="ml-auto rounded-md bg-select px-4 py-1 text-sm font-semibold text-white disabled:opacity-40">
            Send
          </button>
        </div>
      </form>
    </>
  );
}

function Message({ m, now, answered }: { m: EarthMessage; now: number; answered: boolean }) {
  if (m.kind === 'crew') {
    return (
      <div className="ml-6 flex flex-col items-end">
        <div className="max-w-full rounded-md rounded-br-sm bg-select/45 px-2.5 py-1.5 text-sm text-white">{m.text}</div>
        <div className="mt-0.5 text-sm text-slate-400">
          {CREW_BY_ID.elif.name.replace(/^Dr\.\s*/, '')} · {time(m.at)} · <Transit m={m} now={now} answered={answered} />
        </div>
      </div>
    );
  }
  const med = m.med ? MED_BY_ID[m.med] : undefined;
  return (
    <div className="mr-6">
      <div className="mb-0.5 text-sm text-slate-400">
        <span className="font-semibold text-slate-200">{m.id === 'hosgeldin' ? GROUND.station : GROUND.name}</span> · {GROUND.role} · {time(m.at)}
      </div>
      <div
        className="rounded-md rounded-tl-sm px-2.5 py-1.5 text-sm text-slate-100"
        style={{ backgroundColor: alpha(COLORS.calm, 0.09), boxShadow: `inset 2px 0 0 ${COLORS.calm}` }}
      >
        {m.text}
        {med && (
          <div className="mt-1" style={{ color: COLORS.calm }}>
            Kit: {med.name} · {m.applied ? 'done ✓' : 'mark it in Medical bay › Treatment'}
          </div>
        )}
      </div>
    </div>
  );
}

function Transit({ m, now, answered }: { m: CrewMessage; now: number; answered: boolean }) {
  if (answered) return <span style={{ color: COLORS.normal }}>answered</span>;
  if (now < m.arriveAt) return <span style={{ color: COLORS.calm }}>to Earth · {fmtDelay(Math.ceil(realToMissionS(m.arriveAt - now)))}</span>;
  return <span style={{ color: COLORS.calm }}>received · awaiting reply</span>;
}

// ---------- ASTRA (Parça 4'ün sohbetiyle aynı geçmiş) ----------
const PRESETS = ['Who should rest today?', 'What is the radiation status?', 'Is CO₂ safe?'];

function AstraChat() {
  const chat = useAstra((s) => s.chat);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [chat.length, busy]);

  async function send(text?: string) {
    const q = (text ?? question).trim().slice(0, 600);
    if (!q || busy) return;
    const { addChat } = useAstra.getState();
    addChat({ id: crypto.randomUUID(), role: 'user', text: q, at: Date.now() });
    setQuestion('');
    setBusy(true);
    try {
      const answer = await askAstra({ mode: 'chat', question: q, context: buildContext(useAstra.getState(), { question: q }) });
      addChat({ id: crypto.randomUUID(), role: 'astra', text: answer.text, at: Date.now(), answer });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto px-3 py-2.5 text-sm">
        {chat.length === 0 && <p className="text-slate-300">ASTRA answers from the crew's live data. Layer 1 opens alerts; you make the decision.</p>}
        {chat.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="ml-6 flex justify-end">
              <div className="rounded-md rounded-br-sm bg-white/10 px-2.5 py-1.5">{m.text}</div>
            </div>
          ) : (
            <div key={m.id} className="mr-4">
              <div className="rounded-md rounded-tl-sm bg-ai/12 px-2.5 py-1.5 leading-relaxed" style={{ boxShadow: `inset 2px 0 0 ${COLORS.ai}` }}>
                {m.text}
              </div>
              {m.answer && <AstraMeta answer={m.answer} />}
            </div>
          ),
        )}
        {busy && <Thinking label="ASTRA is thinking" />}
        <div ref={endRef} />
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-space-border px-2 pt-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => send(p)}
            disabled={busy}
            className="rounded-full px-2.5 py-0.5 text-sm text-ai ring-1 ring-ai/40 hover:bg-ai/10 disabled:opacity-50"
          >
            {p}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={question}
          maxLength={600}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask ASTRA"
          aria-label="Question for ASTRA"
          className="min-w-0 flex-1 rounded-md bg-space-bg/60 px-2.5 py-1.5 text-sm ring-1 ring-space-border outline-none focus:ring-ai"
        />
        <button type="submit" disabled={busy || !question.trim()} className="rounded-md bg-ai px-3 text-sm font-semibold text-space-bg disabled:opacity-40">
          Ask
        </button>
      </form>
      <p className="px-2 pb-2 text-sm text-slate-500">ASTRA gives recommendations; it does not diagnose or recommend medication.</p>
    </>
  );
}
