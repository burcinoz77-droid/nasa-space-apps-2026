# Azra – working folder

Owner: @azracetin335815-ux · **Part 4 · ASTRA AI (Layer 2)** · branch: `azra/ai`

As planned, the code is not in this folder but inside the shared app. Part 4's files:

| File | What it does |
| --- | --- |
| `api/astra.ts` | Server function: system instruction, Gemini ↔ Claude, key check, tools |
| `src/ai/context.ts` | Short data summary sent to the model (8 key metrics / all metrics, constants) |
| `src/ai/client.ts` | Cache, timeout, safety filter, switching to offline mode |
| `src/ai/safety.ts` | Diagnosis / medication / dose filter (English and Turkish) |
| `src/ai/verify.ts` | Compares the numbers in the answer with the data |
| `src/ai/fallback.ts` | Offline mode: English templates filled with current values |
| `src/ai/explain.ts`, `src/ui/components/AstraExplanation.tsx` | The purple "ASTRA explanation" on the incident card |
| `src/ui/components/AstraChatPanel.tsx` | Chat panel |
| `src/ui/pages/Gorevler.tsx` | Tasks page |
| `src/psych/` | Psychological tests: NASA-TLX, Samn-Perelli, PVT-B (official items, scoring, test schedule, psychological state) |
| `src/ai/testdata.ts`, `src/ui/components/PsychTests.tsx` | Copy of the test results sent to ASTRA; the "Tests" tab on the Astronaut View |
| `src/ai/*.test.ts`, `src/psych/psych.test.ts` | Tests (`npm run test`) and the live model test |
| `docs/`, `README.md` | ASTRA documentation, test table, AI use disclosure |

## Status

- ASTRA runs with Gemini in production (Vercel and Cloudflare); the option to switch to Claude is in the code but was not used.
- To try it locally: put `GEMINI_API_KEY` in `.env`, run `npm run dev` and press one of the ready-made questions in the chat.
- Live model test (10 questions): `docs/test-sorulari.md`.

## Remaining work

1. A 30-second demo video (with English subtitles) and an English presentation of at most 7 slides.
2. Adding the video and presentation links to the table in the main `README.md`.
