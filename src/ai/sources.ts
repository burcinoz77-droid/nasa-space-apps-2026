// Part 4 · Source links shown under an ASTRA answer.
// Looks at the topics in the question and answer (radiation, CO₂, sleep ...) and finds the sourced entries in the knowledge base (knowledge.ts).
// Topics read with the lookup_reference tool come first. Entries without a link or marked "Assumption" are not shown.
import { REFERENCES } from './knowledge';

export interface AnswerSource {
  ad: string;
  url: string;
}

const LETTER = 'a-zçğıöşüâîû';
const lower = (s: string) => s.toLowerCase();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Does the keyword appear at the start of a word in the text? ("nem" -> "nemli" yes, "önemli" no) */
function hasWord(text: string, keyword: string): boolean {
  return new RegExp(`(?<![${LETTER}])${escape(lower(keyword))}`).test(text);
}

export function answerSources(question: string, answer: string, usedTopics: string[] = [], max = 3): AnswerSource[] {
  const q = lower(question);
  // phrases that appear in every answer, like "consult the flight surgeon", do not count as a topic
  const a = lower(answer).replace(/uçuş doktor[a-zçğıöşü]*|flight surgeon/g, ' ');
  const used = usedTopics.map(lower).filter(Boolean);
  const scored = REFERENCES.map((t) => {
    const isUsed = used.some((u) => u === lower(t.konu) || t.anahtarKelimeler.some((k) => u.includes(lower(k))));
    const qHits = t.anahtarKelimeler.filter((k) => hasWord(q, k));
    const aHits = t.anahtarKelimeler.filter((k) => hasWord(a, k));
    // A topic counts if it is in the question or referred to at least twice in the answer
    const relevant = isUsed || qHits.length > 0 || aHits.length >= 2;
    return { t, qHits, aHits, score: relevant ? (isUsed ? 100 : 0) + 3 * qHits.length + aHits.length : 0 };
  })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score);
  const top = scored[0]?.score ?? 0;

  const out: AnswerSource[] = [];
  const seen = new Set<string>();
  for (const { t, qHits, aHits, score } of scored) {
    if (score * 2 <= top) break; // topics less than half as relevant as the most relevant topic are not shown
    // Within a topic, entries that overlap most with the words of the question and answer come first (question words weigh more)
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
      if (++fromTopic >= 2) break; // at most 2 sources per topic
    }
  }
  return out;
}
