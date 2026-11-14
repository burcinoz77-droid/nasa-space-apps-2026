// Parça 4 · Tarayıcı tarafı: /api/astra'ya sorar; cevap gelmezse yedek moda geçer.
// Katman 2 sadece OKUR: bu klasör telemetriye, olaylara ya da otonom adımlara yazamaz.
// Sıra: önbellek -> sunucu -> güvenlik süzgeci -> sayı doğrulama. Hata olursa yedek mod.
import { useAstra } from '../store';
import type { AstraAnswer, AstraRequest } from '../types';
import { fallbackAnswer } from './fallback';
import { toolLabel } from './labels';
import { checkAnswer } from './safety';
import { buildToolData } from './tooldata';
import { verifyNumbers } from './verify';

const TIMEOUT_MS = 38_000; // sunucu en fazla 35 sn içinde ya cevap ya hata döner (api/astra.ts)
const cache = new Map<string, { at: number; answer: AstraAnswer }>();
const CACHE_MS = 60_000; // aynı soru 60 sn içinde tekrar gelirse kotayı harcama

/**
 * Sohbetteki son 10 mesaj (devam soruları için: "Peki Kerem?"). Panel yeni soruyu
 * askAstra'dan önce sohbete eklediği için son mesaj sorunun kendisiyse çıkarılır.
 */
function recentHistory(question: string): { role: 'user' | 'astra'; text: string }[] {
  const chat = useAstra.getState().chat;
  const last = chat[chat.length - 1];
  const previous = last && last.role === 'user' && last.text.trim() === question.trim() ? chat.slice(0, -1) : chat;
  return previous.slice(-10).map((m) => ({ role: m.role, text: m.text.slice(0, 500) }));
}

export async function askAstra(req: AstraRequest): Promise<AstraAnswer> {
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
      // Sohbette araçların okuyacağı anlık veri kopyası da gider (araçlar sunucuda çalışır).
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
    if (!text) throw new Error('boş cevap');

    // Güvenlik süzgeci: teşhis, ilaç ya da doz içeren cevap gösterilmez.
    const safety = checkAnswer(text);
    if (!safety.safe) {
      console.warn(`[ASTRA] Güvenlik süzgeci cevabı engelledi (${safety.reason}); yedek cevap gösteriliyor.\n${text}`);
      return { ...fallbackAnswer(req), latencyMs: elapsed(), fallbackReason: 'safety' };
    }

    const answer: AstraAnswer = {
      text,
      source: data.source,
      // Araç sonuçlarındaki sayılar da "veride var" sayılır: model onları araçla okudu.
      verified: verifyNumbers(text, req.context, `${req.question} ${data.toolOutput ?? ''}`),
      latencyMs: elapsed(),
      ...(data.tools?.length ? { tools: data.tools.map(toolLabel) } : {}),
    };
    cache.set(key, { at: Date.now(), answer });
    return answer;
  } catch (err) {
    console.warn('[ASTRA] Dil modeline ulaşılamadı, yedek moda geçildi:', err instanceof Error ? err.message : err);
    return { ...fallbackAnswer(req), latencyMs: elapsed(), fallbackReason: 'connection' };
  }
}

/** Testler ve "Simülasyonu sıfırla" için. */
export function clearAstraCache() {
  cache.clear();
}
