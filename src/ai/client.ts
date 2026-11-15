// Part 4 · Browser side: asks /api/astra; if no answer arrives, switches to offline mode.
// Layer 2 only READS: this folder cannot write to telemetry, incidents or autonomous actions.
// Order: cache -> server -> safety filter -> number verification. On any error, offline mode.
import { useAstra } from '../store';
import type { AstraAnswer, AstraRequest } from '../types';
import { fallbackAnswer } from './fallback';
import { toolLabel } from './labels';
import { answerSources } from './sources';
import { checkAnswer } from './safety';
import { buildToolData } from './tooldata';
import { verifyNumbers } from './verify';

const TIMEOUT_MS = 58_000; // the server returns either an answer or an error within 55 s at most (api/astra.ts)
const cache = new Map<string, { at: number; answer: AstraAnswer }>();
const CACHE_MS = 60_000; // if the same question comes again within 60 s, do not spend quota

/**
 * The last 10 chat messages (for follow-ups: "And Kerem?"). The panel adds the new question to the chat
 * before askAstra, so if the last message is the question itself it is removed.
 */
function recentHistory(question: string): { role: 'user' | 'astra'; text: string }[] {
  const chat = useAstra.getState().chat;
  const last = chat[chat.length - 1];
  const previous = last && last.role === 'user' && last.text.trim() === question.trim() ? chat.slice(0, -1) : chat;
  return previous.slice(-10).map((m) => ({ role: m.role, text: m.text.slice(0, 500) }));
}

/** Asks ASTRA; also attaches the source links shown under the answer. */
export async function askAstra(req: AstraRequest): Promise<AstraAnswer> {
  const answer = await askAstraInner(req);
  return answer.sources ? answer : { ...answer, sources: answerSources(req.question, answer.text) };
}

async function askAstraInner(req: AstraRequest): Promise<AstraAnswer> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  const history = req.mode === 'chat' ? recentHistory(req.question) : [];
  const key = `${req.mode}|${req.question.trim().toLowerCase()}|${JSON.stringify(req.context).length}|${JSON.stringify(history).length}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return { ...hit.answer, source: 'cache', latencyMs: elapsed() };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch('/api/astra', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // In chat, the data snapshot for the tools is sent too (the tools run on the server).
      body: JSON.stringify(req.mode === 'chat' ? { ...req, history, toolData: buildToolData(useAstra.getState()) } : req),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      text?: string;
      source: 'claude' | 'gemini';
      tools?: { ad: string; girdi?: Record<string, unknown> }[];
      toolOutput?: string;
    };
    const text = (data.text ?? '').trim();
    if (!text) throw new Error('empty answer');

    // Safety filter: an answer containing a diagnosis, medication or dose is not shown.
    const safety = checkAnswer(text);
    if (!safety.safe) {
      console.warn(`[ASTRA] Safety filter blocked the answer (${safety.reason}); showing the fallback answer.\n${text}`);
      return { ...fallbackAnswer(req), latencyMs: elapsed(), fallbackReason: 'safety' };
    }

    const answer: AstraAnswer = {
      text,
      source: data.source,
      // Numbers in tool results also count as "in the data": the model read them with a tool.
      verified: verifyNumbers(text, req.context, `${req.question} ${data.toolOutput ?? ''}`),
      latencyMs: elapsed(),
      ...(data.tools?.length ? { tools: data.tools.map(toolLabel) } : {}),
      // sources of topics read with lookup_reference come first
      sources: answerSources(
        req.question,
        text,
        (data.tools ?? []).filter((t) => t.ad === 'lookup_reference').map((t) => String(t.girdi?.konu ?? '')),
      ),
    };
    cache.set(key, { at: Date.now(), answer });
    return answer;
  } catch (err) {
    console.warn('[ASTRA] Language model unreachable, switched to offline mode:', err instanceof Error ? err.message : err);
    return { ...fallbackAnswer(req), latencyMs: elapsed(), fallbackReason: 'connection' };
  }
}

/** For tests and "Reset simulation". */
export function clearAstraCache() {
  cache.clear();
}
