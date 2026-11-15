# ASTRA · how Layer 2 (AI) works

ASTRA is the onboard health assistant of the ARES-1 crew. It explains the incidents raised by Layer 1 in 2–3
sentences and answers the crew's questions in English, **based only on the data**. A message to the flight
surgeon on Earth and back takes 6–44 minutes (NASA Mars Relay Network); ASTRA supports the crew in between.

## What it cannot do (enforced in code)

| Rule | Where it is enforced |
| --- | --- |
| Cannot raise alerts or close incidents | Only Layer 1 (`src/engine/`) raises alerts. `src/ai/` writes only to the `explanations` and `chat` fields. |
| Cannot change data or operate systems | The server function only returns text; Layer 1 starts the autonomous actions. |
| No definitive diagnosis, no medication or dose advice | `src/ai/safety.ts` blocks only three genuinely dangerous things: medication or dose advice ("give 400 mg", "he should take a painkiller"), a definitive diagnosis ("Kerem has hypoxia", "he is definitely having a heart attack") and a definitive exclusion for life-threatening conditions ("not a heart attack"). The word appearing is not a problem: "this is not a definitive diagnosis", "I cannot recommend medication", "... may be consistent with" all pass. A blocked answer is replaced by an offline answer; the screen shows "Offline answer · safety filter" and the reason appears in the console. `ai.test.ts` has realistic "should pass" and "should block" sentences in English and Turkish; if a new false block shows up, the sentence is added to the list. |
| Cannot make up numbers | `src/ai/verify.ts`: every number in the answer is looked up in the data sent to the model. If all are found, a green **Numbers verified** badge; otherwise an amber **Check the numbers** badge. |
| Does not go silent without internet | `src/ai/fallback.ts`: produces a rule-based English answer from the data; shown with a gray **Offline mode** label. |

## Flow

```
Question / new incident
  → src/ai/context.ts   short data summary (≈ 900–1,500 tokens)
  → src/ai/client.ts    60 s cache, 58 s timeout
  → POST /api/astra     (api/astra.ts: Gemini or Claude, with fetch; the key stays on the server)
  → src/ai/safety.ts    diagnosis / medication filter
  → src/ai/verify.ts    number verification
  → purple box on screen (on an error or no connection → src/ai/fallback.ts)
```

**Data summary** (`context.ts`): 8 key metrics for a person with Nominal status (heart rate, SpO₂, respiratory
rate, core temperature, dose rate, total dose, CO₂, sleep); all 36 metrics and the 3 most deviating signals for a
person who is not Nominal, is named in the question or is affected by an incident. Also the constants that may
appear in an answer: career dose limit 600 mSv (NASA-STD-3001), CO₂ caution/warning limits 2.3 / 3.0 mmHg
(OCHMO-TB-004), communication delay with Earth. It stays under 3,000 tokens even if everyone is at Warning (tested).

**Offline mode templates**: by incident type (RADIATION, CO2, FATIGUE, THERMAL, HYPOXIA, CARDIO, STRESS, MULTI)
filled with current values; in chat by keyword (who should rest, why Warning, radiation, CO₂, delay, a specific
metric, medication, diagnosis, commands, out-of-role requests).

## Tool use, context and multi-turn chat

Following a mentor's suggestion, ASTRA works with three capabilities:

| Capability | What it does | Where |
| --- | --- | --- |
| **Tool use (tool calling)** | The model pulls the details it needs with 10 read-only tools: `get_crew_member` (an astronaut's metrics with personal baselines, scores, open incidents), `get_metric_trend` (short- and long-term trend: rising / falling / stable), `assess_possible_conditions` (data-based possible conditions), `list_incidents`, `get_event_log`, `lookup_reference` (thresholds, limits and scientific sources); for the psychological tests `get_test_results` (latest results and change), `get_psych_state` (psychological state and its factors), `get_test_schedule` (who should take which test when) and `compare_crew_tests` (crew comparison). With `functionCall` on Gemini and `tool_use` on Claude; at most 2 rounds. The tools used appear below the answer in the "⚙ Tools used" line. | `api/astra.ts` (`TOOLS`, `runTool`) |
| **Context** | With every question, a short live data summary (8 key metrics for everyone, the most deviating signals of people with issues, open incidents, constants) + a data snapshot the tools read + a knowledge base sourced from NASA and peer-reviewed studies. | `src/ai/context.ts`, `src/ai/tooldata.ts`, `src/ai/knowledge.ts` |
| **Multi-turn chat** | The last 10 messages go to the model, so follow-ups like "And Kerem?" are understood. The chat survives a page reload. | `src/ai/client.ts`, `api/astra.ts` (`cleanHistory`) |

The tools cannot change anything: they only read the data snapshot sent by the browser. If the model rejects
the tool definitions, the server asks once more without tools and with detailed data. Incident explanations are
a single step without tools, for speed.

## Possible-condition estimate (not a definitive diagnosis)

By team decision, ASTRA can state possible conditions based on changed values. `src/ai/conditions.ts` compares
each astronaut's metrics with their personal baseline (z ≥ 2.5 or an absolute threshold) and returns the matching
rules out of 9: CO₂ build-up (hypercapnia), hypoxia, heat stress and overexertion, fluid-electrolyte loss, possible
heart rhythm irregularity, sleep deprivation and fatigue, acute stress load, suspected SANS, increased radiation
exposure. Each result has the supporting signals (current value + personal baseline), the likelihood (low / medium;
never "certain"), the recommended check and the source. The model reads this with the `assess_possible_conditions`
tool and explains in this order: which values changed and how → "... may be consistent with" → that it is not
definitive, and a medical check. It is tested that no false estimate comes up over 200 readings on a nominal day.

## Environmental metrics and topics the system does not measure

To cover the NASA HRP "hostile/closed environment" hazard, three live metrics were added to the environmental group (36 metrics in total):

| Metric | Baseline value | Basis |
|---|---|---|
| Ambient temperature (`env.ambientTemp_C`) | 22.5 °C | NASA-STD-3001 performance zone 20–25 °C, health limit 18–27 °C (OCHMO-TB-002) |
| Relative humidity (`env.humidity_pct`) | 45% | Performance zone 30–60%, health limit 25–75% (OCHMO-TB-002) |
| Ambient noise (`env.noise_dBA`) | 55 dBA (assumption) | Continuous noise limit NC-50, about 58 dBA (OCHMO-TB-035); ISS limit 72 dBA over a 16 h work period, 62 dBA over 8 h of sleep |

The scenarios do not change these three metrics; they stay at their baseline values.

**Official reference range rule (Layer 1):** for metrics whose source gives an explicit reference range, a value
within that range does not raise a new alert; an open alert steps down with hysteresis (`src/sim/parameters.ts` →
`normalRangeFor`, `src/engine/index.ts`). Ranges: SpO₂ 96–100% (NIH), resting respiratory rate 12–20/min and EtCO₂
35–45 mmHg (JEMS), EVA heart rate 100–110 bpm (NASA Apollo), cabin CO₂ ≤ 2.3 mmHg (OCHMO), ambient 20–25 °C and
humidity 30–60% (NASA-STD-3001), noise ≤ 72 dBA (ISS). Shown in the "Reference range" column of the "Data sources"
table in Settings.

Bone, immunity, balance, crew cohesion, cabin microbes and eye structure (SANS) are not measured in the system.
When asked about them, ASTRA first says they are not measured, then gives NASA's general information with its
source from `lookup_reference` (`kemik`, `goz`, `olculmeyenler`, `yercekimi`, `ortam`) or the `sabitler` field of the
context, stating "an estimate, not a personal measurement". Example: bone density loss is 1–1.5% per month according
to NASA; roughly 6–9% by day 180 (`boneLossEstimate`). Offline mode gives the same answers by rules.

## Memory

- **Data memory** (`src/ai/memory.ts`): the personal baseline of all 36 metrics (first 30 readings) and a long
  history of at most 72 records, one every 5 readings (about 60 hours of mission time). `get_metric_trend` returns
  the short- and long-term trend together. Reset with "Reset simulation".
- **Chat memory**: the last 10 messages go to the model. The chat is saved in the browser (`src/ai/chatStore.ts`);
  it continues when the panel is closed and reopened or the page reloads. The **Reset chat** button at the bottom
  of the panel clears it.

## Tone and conversation

ASTRA speaks formally and respectfully (no emoji, no slang) but adapts the form of the answer to the question:
a short introduction for a greeting, value + unit for a single-value question, observation → why it matters →
what to do for a "why" question. It uses NASA terminology: Nominal / Caution / Warning, personal baseline,
reference range, flight surgeon, storm shelter, mandatory crew rest, orbit crew (IVA) and surface crew (EVA).
Example answers are in `SYSTEM_PROMPT` in `api/astra.ts`.

## Switching providers

`.env` (local), Vercel environment variables and Cloudflare secrets:

```
ASTRA_PROVIDER=gemini          # Gemini was used in production; claude is optional
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.8-flash
GEMINI_FALLBACK_MODELS=gemini-3.5-flash-lite,gemini-3.7-flash  # tried in order if the main model returns 503/429 or does not answer in time
GEMINI_MODEL_TIMEOUT_MS=24000  # timeout for one request; a simple question took ~11 s on the live site, do not go lower
ANTHROPIC_API_KEY=...
CLAUDE_MODEL=claude-haiku-5-5
```

On Claude, thinking is off (`thinking: disabled`, `effort: low`); if the model does not recognize these fields the
code retries once without them. Without a key the server returns 503 without calling the model and the interface
switches to offline mode. On Vercel a **Redeploy** is needed after changing a variable.

**Timing:** on 15 November a simple question took about 11 s on the live site, and the old 12 s per-request limit
pushed tool-using questions into offline mode. Now: 24 s per request, 55 s in total (tool-using questions take
2 requests); a backup model is only tried if at least 14 s remain. The client waits 58 s. On Vercel the function
time limit is 60 s in `vercel.json`. The `[ASTRA] gemini-... answered: X s` line in the server terminal (or in the
Vercel/Cloudflare logs) shows the real duration.

## For the other parts: incident explanation box

```tsx
import { AstraExplanation } from '../components/AstraExplanation';

<AstraExplanation incidentId={incident.id} />
```

Part 3 puts it under the Warning incident banner, Part 2 under the incident row in Reports. Even if the same
incident is shown in two places, the model is asked **once**; the result is stored in `useAstra((s) => s.explanations[id])`.

## Tests

- `npm run test`: safety filter, number verification, data summary size, offline answers to the 10 test questions,
  incident templates, client (mocked fetch) and the server function. Uses no quota.
- Live model test: `docs/test-sorulari.md`.
