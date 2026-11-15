/// <reference types="node" />
// Part 4 · Asks the plan's 10 test questions to the REAL model (ASTRA_PROVIDER in .env: gemini | claude).
// A normal "npm run test" SKIPS this file; it uses no quota. To run it, the key must be in .env:
//   Git Bash / macOS / Linux:  ASTRA_LIVE=1 npx vitest run src/ai/astra.live.test.ts
//   Windows PowerShell:        $env:ASTRA_LIVE=1; npx vitest run src/ai/astra.live.test.ts
// The result is written to docs/test-results-<provider>.md and copied from there into the plan's table.
// If even one result is "FAIL", fix SYSTEM_PROMPT in api/astra.ts and run the test again.
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadEnv } from 'vite';
import { describe, expect, it } from 'vitest';
import handler from '../../api/astra';
import { useAstra } from '../store';
import { buildContext } from './context';
import { checkAnswer } from './safety';
import { buildToolData } from './tooldata';
import { countSentences, EXPECTED, makeDemoState, QUESTIONS } from './testing';
import { verifyNumbers } from './verify';

const LIVE = !!process.env.ASTRA_LIVE;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Row {
  n: string;
  question: string;
  text: string;
  ms: number;
  tools: string[];
  problems: string[];
}

async function ask(mode: 'chat' | 'incident', question: string, context: Record<string, unknown>) {
  const started = Date.now();
  // Same as the app in chat: short summary + data snapshot for the tools to read
  const toolData = mode === 'chat' ? buildToolData(useAstra.getState()) : undefined;
  const res = await handler.fetch(
    new Request('http://localhost/api/astra', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode, question, context, toolData }),
    }),
  );
  const data = (await res.json()) as { text?: string; error?: string; tools?: { ad: string }[]; toolOutput?: string };
  return { ok: res.ok, status: res.status, text: data.text ?? '', error: data.error, ms: Date.now() - started, tools: (data.tools ?? []).map((t) => t.ad), toolOutput: data.toolOutput ?? '' };
}

function check(r: Awaited<ReturnType<typeof ask>>, context: unknown, question: string, maxSentences: number): string[] {
  const problems: string[] = [];
  if (!r.ok) return [`HTTP ${r.status}: ${r.error ?? ''}`.slice(0, 160)];
  if (countSentences(r.text) > maxSentences) problems.push(`${maxSentences} cümleyi aştı`);
  const safety = checkAnswer(r.text);
  if (!safety.safe) problems.push(`güvenlik süzgeci: ${safety.reason}`);
  if (!verifyNumbers(r.text, context, `${question} ${r.toolOutput}`)) problems.push('veride olmayan sayı');
  if (r.ms > 15000) problems.push(`yavaş: ${(r.ms / 1000).toFixed(1)} sn`);
  return problems;
}

describe.skipIf(!LIVE)('ASTRA live model test', () => {
  it('10 test questions + 1 incident explanation', async () => {
    // Load .env into the process.env the server function sees (same rule as vite dev)
    for (const [k, v] of Object.entries(loadEnv('development', process.cwd(), ''))) {
      if (!k.startsWith('VITE_') && process.env[k] === undefined) process.env[k] = v;
    }
    const provider = process.env.ASTRA_PROVIDER === 'claude' ? 'claude' : 'gemini';
    const model = provider === 'claude' ? process.env.CLAUDE_MODEL || 'claude-haiku-5-5' : process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const keyName = provider === 'claude' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY';
    if (!process.env[keyName]) throw new Error(`${keyName} .env içinde yok; önce anahtarı ekleyin.`);
    const pause = provider === 'gemini' ? 4500 : 500; // the free Gemini quota is limited per minute

    const s = makeDemoState(); // Kerem is at Warning level with CO₂, Elif has been placed on mandatory crew rest
    const hrElif = Math.round(s.telemetry.elif!.cardio.hr_bpm);
    const rows: Row[] = [];

    for (const [i, question] of QUESTIONS.entries()) {
      const context = buildContext(useAstra.getState(), { question });
      const r = await ask('chat', question, context);
      const problems = check(r, context, question, 4);
      if (r.ok && !EXPECTED[i].check.test(r.text)) problems.push(`beklenen: ${EXPECTED[i].behaviour}`);
      if (r.ok && i === 2 && !r.text.includes(String(hrElif))) problems.push(`ekrandaki nabız (${hrElif}) yok`);
      rows.push({ n: String(i + 1), question, text: r.text, ms: r.ms, tools: r.tools, problems });
      await sleep(pause);
    }

    // Extra: tool use and multi-turn chat (mentor request). The trend question needs get_metric_trend.
    {
      const question = "Kerem'in CO₂ değeri son ölçümlerde artıyor mu?";
      const context = buildContext(useAstra.getState(), { question, compact: true });
      const r = await ask('chat', question, context);
      const problems = check(r, context, question, 4);
      if (r.ok && !r.tools.includes('get_metric_trend')) problems.push('get_metric_trend aracı çağrılmadı');
      rows.push({ n: 'Araç', question, text: r.text, ms: r.ms, tools: r.tools, problems });
      await sleep(pause);
    }

    const inc = s.incidents[0];
    const context = buildContext(useAstra.getState(), { incident: inc });
    const q = `Olay: ${inc.title}. Etkilenen: Elif, Kerem, Zeynep.`;
    const r = await ask('incident', q, context);
    rows.push({ n: 'Olay', question: q, text: r.text, ms: r.ms, tools: r.tools, problems: check(r, context, q, 3) });

    const cell = (t: string) => t.replace(/\|/g, '\\|').replace(/\n+/g, ' ');
    const md = [
      `# ASTRA canlı test · ${provider} (${model})`,
      '',
      `Tarih: ${new Date().toLocaleString('tr-TR')} · Demo durumu: Kerem CO₂ ile kritik, Elif'e zorunlu dinlenme verilmiş.`,
      `Sonuç: **${rows.filter((x) => !x.problems.length).length}/${rows.length} geçti**`,
      '',
      '| # | Soru | Cevap | Araçlar | Süre | Sonuç |',
      '| --- | --- | --- | --- | --- | --- |',
      ...rows.map(
        (x) =>
          `| ${x.n} | ${cell(x.question)} | ${cell(x.text)} | ${x.tools.join(', ') || '—'} | ${(x.ms / 1000).toFixed(1)} sn | ${x.problems.length ? `KALIR: ${cell(x.problems.join('; '))}` : 'Geçti'} |`,
      ),
      '',
    ].join('\n');
    mkdirSync('docs', { recursive: true });
    writeFileSync(`docs/test-results-${provider}.md`, md);
    console.log(md);

    expect(rows.filter((x) => x.problems.length).map((x) => `${x.n}: ${x.problems.join('; ')}`)).toEqual([]);
  }, 240_000);
});
