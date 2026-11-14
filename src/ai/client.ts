// Parça 4 · Tarayıcı tarafı: /api/astra'ya sorar; cevap gelmezse yedek moda geçer.
// Katman 2 sadece OKUR: bu klasör telemetriye, olaylara ya da otonom adımlara yazamaz.
import type { AstraAnswer, AstraRequest } from '../types';
import { fallbackAnswer } from './fallback';
import { verifyNumbers } from './verify';

const TIMEOUT_MS = 12_000;
const cache = new Map<string, { at: number; answer: AstraAnswer }>();
const CACHE_MS = 60_000; // aynı soru 60 sn içinde tekrar gelirse kotayı harcama

export async function askAstra(req: AstraRequest): Promise<AstraAnswer> {
  const started = performance.now();
  const key = `${req.mode}|${req.question.trim().toLowerCase()}|${JSON.stringify(req.context).length}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return { ...hit.answer, source: 'cache' };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch('/api/astra', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { text: string; source: 'claude' | 'gemini' };
    const answer: AstraAnswer = {
      text: data.text,
      source: data.source,
      verified: verifyNumbers(data.text, req.context),
      latencyMs: Math.round(performance.now() - started),
    };
    cache.set(key, { at: Date.now(), answer });
    return answer;
  } catch {
    return { ...fallbackAnswer(req), latencyMs: Math.round(performance.now() - started) };
  }
}
