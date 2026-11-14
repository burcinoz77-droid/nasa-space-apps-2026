// Parça 4 · Tarayıcı tarafı: /api/astra'ya sorar; cevap gelmezse yedek moda geçer.
// Katman 2 sadece OKUR: bu klasör telemetriye, olaylara ya da otonom adımlara yazamaz.
// Sıra: önbellek -> sunucu -> güvenlik süzgeci -> sayı doğrulama. Hata olursa yedek mod.
import type { AstraAnswer, AstraRequest } from '../types';
import { fallbackAnswer } from './fallback';
import { checkAnswer } from './safety';
import { verifyNumbers } from './verify';

const TIMEOUT_MS = 22_000; // sunucu en fazla 20 sn içinde ya cevap ya hata döner (3 model × 6 sn)
const cache = new Map<string, { at: number; answer: AstraAnswer }>();
const CACHE_MS = 60_000; // aynı soru 60 sn içinde tekrar gelirse kotayı harcama

export async function askAstra(req: AstraRequest): Promise<AstraAnswer> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  const key = `${req.mode}|${req.question.trim().toLowerCase()}|${JSON.stringify(req.context).length}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return { ...hit.answer, source: 'cache', latencyMs: elapsed() };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch('/api/astra', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as { text?: string; source: 'claude' | 'gemini' };
    const text = (data.text ?? '').trim();
    if (!text) throw new Error('boş cevap');

    // Güvenlik süzgeci: teşhis, ilaç ya da doz içeren cevap gösterilmez.
    const safety = checkAnswer(text);
    if (!safety.safe) {
      console.warn(`[ASTRA] Güvenlik süzgeci cevabı engelledi (${safety.reason}); yedek cevap gösteriliyor.\n${text}`);
      return { ...fallbackAnswer(req), latencyMs: elapsed() };
    }

    const answer: AstraAnswer = {
      text,
      source: data.source,
      verified: verifyNumbers(text, req.context, req.question),
      latencyMs: elapsed(),
    };
    cache.set(key, { at: Date.now(), answer });
    return answer;
  } catch (err) {
    console.warn('[ASTRA] Dil modeline ulaşılamadı, yedek moda geçildi:', err instanceof Error ? err.message : err);
    return { ...fallbackAnswer(req), latencyMs: elapsed() };
  }
}

/** Testler ve "Simülasyonu sıfırla" için. */
export function clearAstraCache() {
  cache.clear();
}
