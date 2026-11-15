// Parça 4 · ASTRA cevabının altında gösterilen kaynak linkleri.
// Soru ve cevaptaki konulara (radyasyon, CO₂, uyku ...) bakar, bilgi tabanındaki (knowledge.ts) kaynaklı bilgileri bulur.
// lookup_reference aracıyla okunan konular önce gelir. Linki olmayan ve "Varsayım" olan bilgiler gösterilmez.
import { REFERENCES } from './knowledge';

export interface AnswerSource {
  ad: string;
  url: string;
}

const LETTER = 'a-zçğıöşüâîû';
const lower = (s: string) => s.toLowerCase();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Anahtar kelime metinde bir kelimenin başında geçiyor mu? ("nem" -> "nemli" evet, "önemli" hayır) */
function hasWord(text: string, keyword: string): boolean {
  return new RegExp(`(?<![${LETTER}])${escape(lower(keyword))}`).test(text);
}

export function answerSources(question: string, answer: string, usedTopics: string[] = [], max = 3): AnswerSource[] {
  const q = lower(question);
  // "uçuş doktoruna danışın" gibi her cevapta geçen kalıplar konu sayılmaz
  const a = lower(answer).replace(/uçuş doktor[a-zçğıöşü]*|flight surgeon/g, ' ');
  const used = usedTopics.map(lower).filter(Boolean);
  const scored = REFERENCES.map((t) => {
    const isUsed = used.some((u) => u === lower(t.konu) || t.anahtarKelimeler.some((k) => u.includes(lower(k))));
    const qHits = t.anahtarKelimeler.filter((k) => hasWord(q, k));
    const aHits = t.anahtarKelimeler.filter((k) => hasWord(a, k));
    // Soruda geçen konu ya da cevapta en az iki kez işaret edilen konu sayılır
    const relevant = isUsed || qHits.length > 0 || aHits.length >= 2;
    return { t, qHits, aHits, score: relevant ? (isUsed ? 100 : 0) + 3 * qHits.length + aHits.length : 0 };
  })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score);
  const top = scored[0]?.score ?? 0;

  const out: AnswerSource[] = [];
  const seen = new Set<string>();
  for (const { t, qHits, aHits, score } of scored) {
    if (score * 2 <= top) break; // en ilgili konunun yarısı kadar bile ilgili olmayanlar gösterilmez
    // Konunun içinde, soru ve cevaptaki kelimelerle en çok örtüşen bilgiler önce (soru kelimeleri daha ağır)
    const weight = (text: string) => {
      const b = lower(text);
      return qHits.filter((w) => b.includes(lower(w))).length * 3 + aHits.filter((w) => b.includes(lower(w))).length;
    };
    const facts = [...t.bilgiler].sort((f1, f2) => weight(f2.bilgi) - weight(f1.bilgi));
    let fromTopic = 0;
    for (const f of facts) {
      if (!f.url || seen.has(f.url) || /^(varsayım|assumption)/i.test(f.kaynak)) continue;
      seen.add(f.url);
      out.push({ ad: f.kaynak, url: f.url });
      if (out.length >= max) return out;
      if (++fromTopic >= 2) break; // bir konudan en fazla 2 kaynak
    }
  }
  return out;
}
