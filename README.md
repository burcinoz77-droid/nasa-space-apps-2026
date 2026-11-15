# Orbitalis · ASTRA — astronaut health monitoring and decision support

NASA Space Apps Challenge 2026 · Bursa · Team FLOW
Challenge: *Create Health Monitoring Software for Astronauts on Space Missions*

> "The flight surgeon is up to 44 minutes away. ASTRA is right here."

**Orbitalis** is a crew health console for a 6-person Mars mission (ARES-1, Mission Day 180): 3 astronauts
in orbit (IVA) and 3 on the surface in EVA suits. Earth is up to 22 minutes away one way (one-way light time),
so the crew cannot wait for the flight surgeon. ASTRA monitors 36 metrics in 5 data groups for every astronaut, live.

- **Layer 1 (onboard, no internet):** learns each astronaut's *personal baseline* from the first 30
  readings, flags deviations with directional z-scores and NASA limits (NASA-STD-3001, OCHMO), raises
  Caution and Warning alerts and runs three pre-approved safe actions on its own: storm shelter ingress,
  increased ventilation and mandatory crew rest. Every action is logged; the crew acknowledges.
- **Layer 2, ASTRA (AI):** explains every alert and answers questions using only the live data,
  with source links and a "Numbers verified" check. It never diagnoses, never recommends medication and
  cannot raise or change alerts. Without internet it switches to offline mode (rule-based answers).
- **Real NASA data:** the solar particle event scenario replays the real May 2024 storm (NASA DONKI event
  times, NASA/SDO footage of the X3.9 flare). Values come from NASA and peer-reviewed sources; every
  number in the app links to its source, and values without a source are marked "assumption".
- **Crew fatigue tests:** NASA-TLX (workload, NASA Ames), Samn-Perelli (fatigue) and a 3-minute
  PVT-B (alertness; flown on the ISS as the Reaction Self Test). Official items only, no AI-written questions.
- All crew data is simulated; no real person's health data is used.

## Team

| Member | Part | What they built | GitHub |
| --- | --- | --- | --- |
| Burcin Oz | Part 1 · Simulation | Digital twin, scenarios, sourced parameters, NASA data, cinematics, jury demo tour, helmet visor HUD, Settings, deployment | [burcinoz77-droid](https://github.com/burcinoz77-droid) |
| Muhammet Emir Uzun | Part 2 · Layer 1 | Personal baseline, anomaly detection, incident rules, autonomous actions, Reports (incident log) | [emirruzunn](https://github.com/emirruzunn) |
| Berat Yusuf Beyazit | Part 3 · Interface | Mission Status, Astronaut View, Crew, 3D astronaut, incident banner, color and accessibility | [beyazitberatyusuf-afk](https://github.com/beyazitberatyusuf-afk) |
| Azra Cetin | Part 4 · ASTRA | AI (Layer 2), psychological tests, Tasks, documentation, presentation and video | [azracetin335815-ux](https://github.com/azracetin335815-ux) |

## Presentation, demo video and live links

| What | Link | Note |
| --- | --- | --- |
| **Demo video (30 s)** | _to be added_ | English subtitles |
| **Presentation (slides)** | _to be added_ | English, at most 7 slides |
| **Live app** | https://nasa-space-apps-2026-tau.vercel.app | ASTRA live (Gemini) |
| Live app, backup (Cloudflare) | https://nasa-space-apps-2026.orbitalis-astra.workers.dev | ASTRA live (Gemini) |
| GitHub Pages | https://burcinoz77-droid.github.io/nasa-space-apps-2026/ | No AI server: ASTRA in offline mode |

Some networks in Turkiye block `.vercel.app` and `.workers.dev` addresses. If the app does not open,
use a phone hotspot or run it locally (`npm run dev`).

**Try it in 2 minutes:** wait ~40 s until the clock shows "● Live" (personal baselines learned) →
top right **Simulation ▾ → Solar particle event** → watch the cinematic, the red Warning banner and
the automatic storm shelter action → click **Ask ASTRA**. For a hands-free tour: **Settings → ★ Jury demo**.

## Running locally

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env  — then add the key
npm run dev               # http://localhost:5173
```

It also runs without a key: the ASTRA chat switches to offline mode.

| Command | What it does |
| --- | --- |
| `npm run dev` | App + local `/api/astra` |
| `npm run build` | Production bundle (`dist/`) |
| `npm run preview` | Opens the built bundle locally |
| `npm run typecheck` | Type check |
| `npm run lint` | Lint (oxlint) |
| `npm run test` | Vitest tests |
| `ASTRA_LIVE=1 npx vitest run src/ai/astra.live.test.ts` | Asks the 10 test questions to the real model (see `docs/test-questions.md`) |

## Folders and owners

| Path | What | Owner |
| --- | --- | --- |
| `src/types.ts` | Shared data contract | Everyone (post in the team group before changing) |
| `src/metrics.ts`, `src/crew.ts` | Metric catalog, crew | Part 1 |
| `src/sim/` | Simulation engine, `parameters.ts`, scenarios | Part 1 |
| `src/engine/` | Layer 1: anomaly detection, incidents, autonomous actions | Part 2 |
| `src/ui/` | Screens, color system | Part 3 (Reports: Part 2, Settings: Part 1, Tasks: Part 4) |
| `src/ui/cinematic/` | Scenario cinematics, jury demo tour, helmet visor HUD | Part 1 |
| `data/`, `public/media/` | Recorded NASA DONKI data, source check, NASA/SDO video | Part 1 |
| `api/astra.ts`, `src/ai/` | Layer 2: ASTRA AI | Part 4 |
| `src/psych/` | Psychological tests: NASA-TLX, Samn-Perelli, PVT-B | Part 4 |
| `src/loop.ts`, `src/store.ts` | Loop and shared state connecting the parts | Everyone (post in the team group) |
| `vercel.json`, `cloudflare/`, `wrangler.jsonc`, `.github/workflows/pages.yml` | Deployment: Vercel, Cloudflare backup, GitHub Pages | Part 1 |
| `docs/` | Presentation, sources, ASTRA documentation | Part 4 |

## Deployment

| Where | How to update |
| --- | --- |
| Vercel (main) | Deployed from the `main` branch on GitHub. `api/astra.ts` runs as a server function (60 s limit in `vercel.json`); keys are Vercel environment variables, and changing them needs a **Redeploy**. |
| Cloudflare Workers (backup) | `npm run build` and `npx wrangler deploy`. Same site and ASTRA server; the key is stored in Cloudflare as a secret. Details: `cloudflare/README.md`. |
| GitHub Pages | GitHub Actions (`.github/workflows/pages.yml`) builds and publishes on every merge to `main`. There is no server, so ASTRA runs in offline mode. |

Keys never go into the repository or the browser: `.env` is not committed and variable names never use the `VITE_` prefix.

## What is in the app

- **6 pages:** Mission Status (mission console), Astronaut View, Crew, Tasks, Reports (incident log), Settings.
- **5 scenarios** (top right **Simulation ▾** menu): Nominal day, Solar particle event, Mars Day 180 workload, CO₂ scrubber failure, EVA overexertion.
  Crisis scenarios play a full-screen cinematic; the solar particle event uses real NASA/SDO footage and DONKI event times.
- **Jury demo tour:** Settings → **★ Jury demo**; plays the whole tour by itself (~2 min).
- **Personal baseline:** each astronaut's own baseline is learned over the first 30 readings; values within an official reference range raise no alert.
  After a crisis, values recover gradually.
- **Alert levels:** NOMINAL (green), CAUTION (amber), WARNING (red), following NASA caution and warning practice; color is always paired with a symbol and a label.
- **Astronaut View:** 3D astronaut (colored by body region), metric groups, reference range indicators,
  the **helmet visor HUD** for astronauts on EVA (opens by itself on a Warning) and the **Tests** tab.
- **Sources everywhere:** a small gray (i) next to every number; hover to see the source, click to open it.
  Values without a source show a gray "assumption" label. The **Data sources** table in Settings lists every value, its reference range and its source.
- **Cinematic sounds:** generated in code (storm, alarm, heartbeat); mute with the 🔊 button.
- **ASTRA chat panel:** "Ask ASTRA" at the bottom right; the panel can be dragged by its header and has ready-made questions.

## ASTRA (Layer 2) in short

- Incident explanations and chat: English, at most 4 sentences, based only on the data. Details: `docs/ASTRA.md`.
- No definitive diagnosis: based on the changed values it states possible conditions as possibilities ("may be consistent with ...") and recommends a medical check. It does not recommend medication, cannot raise alerts and cannot change data. A safety filter blocks answers with definitive claims or medication.
- Tool use (10 read-only tools; 4 of them for psychological test results, the test schedule and crew comparison), a sourced knowledge base, long-term data memory and a chat that remembers the last 10 messages; the chat survives a page reload and is cleared with "Reset chat".
- Every number in an answer is checked against the data: **Numbers verified** / **Check the numbers** badge. Links to the sources the answer relies on appear below it.
- Without internet or a key: **Offline mode**, answers generated by rules from the data; the onboard loop already runs without internet.
- Incident explanations on other screens: `<AstraExplanation incidentId={incident.id} />`.

## Psychological tests

Astronaut View → **Tests** tab. Items are taken verbatim from the official scales; the AI does not write questions.

| Test | What it measures | Source |
| --- | --- | --- |
| NASA-TLX | Workload, 6 subscales, 0–100 (Raw TLX) | [NASA Ames](https://humansystems.arc.nasa.gov/groups/tlx/), [Hart 2006](https://humansystems.arc.nasa.gov/publications/HFES_2006_Paper.pdf) |
| Samn-Perelli | Fatigue, 1–7 | [Samn & Perelli 1982 items](https://pmc.ncbi.nlm.nih.gov/articles/PMC9286802), [NASA–easyJet study](https://ntrs.nasa.gov/citations/20130001718) |
| PVT-B | 3-min reaction test; 355 ms and above is a lapse | [Basner et al. 2011](https://pmc.ncbi.nlm.nih.gov/articles/PMC3197786), [NASA Spinoff 2013](https://spinoff.nasa.gov/Spinoff2013/hm_1.html) |

- ASTRA recommends the tests every 4 mission days (the ISS Reaction Self Test frequency, [Jones et al. 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8919197));
  it moves them up if sleep was under 6 hours or Layer 1 sees a cognitive deviation.
- The PVT-B result is written to telemetry for 1 mission day; if an alert is needed, Layer 1 raises it.
- Thresholds without a source (Samn-Perelli ≥ 5, NASA-TLX ≥ 50) are marked "assumption" on screen.
- PANAS (APA copyright) and BSI-18 (Pearson's commercial scale) were not used as tests. The PANAS and BSI-18
  scores in the simulation are simulated only and their items are not in the app; a real system would need the licensed scales.

## Data and sources

All astronaut data is synthetic (simulation). Parameters come from NASA and peer-reviewed sources;
the source of every constant is written in `src/sim/parameters.ts`, and the link check is in
`data/SOURCE_CHECK.md`. 16 values have no published source; they were added by the team as assumptions and are marked "assumption" in the interface.

**CO₂ thresholds:** the WARNING limit of 3.0 mmHg is NASA's 1-hour average limit (NASA-STD-3001 V2 6004, OCHMO-TB-004), and NASA's 7-day average limit is 2.5 mmHg. The CAUTION threshold of 2.3 mmHg is not in OCHMO-TB-004: it is an early-warning margin chosen by the team below the 2.5 mmHg limit.

| NASA data and standards used | Where |
| --- | --- |
| NASA DONKI (May 2024 solar particle event times) | Solar particle event scenario, `data/donki_sep_2024-05.json` |
| NASA/SDO footage (X3.9 flare, [NASA SVS 5286](https://svs.gsfc.nasa.gov/5286/)) | Solar particle event cinematic |
| NASA OSDR EDA (ISS cabin environment) | Cabin CO₂ and environment values |
| NASA-STD-3001 / OCHMO (CO₂, radiation, noise, environment) | Layer 1 limits and reference ranges |
| NASA Human Research Program | Risk topics, ASTRA knowledge base |
| Curiosity RAD (Mars cruise and surface dose rate) | Radiation values |
| NASA 3D Resources, "Astronaut" model (DigitalSpace Corporation, [link](https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Astronaut)) | 3D astronaut on the Astronaut View |

## Open-source libraries

The code was written with AI assistants (see below), and that code is built on these open-source libraries. All are used under their licenses; none of their code was changed.

| Library | Used for | License |
| --- | --- | --- |
| React, React DOM | Interface | MIT |
| three.js (with Google's Draco decoder, bundled in three.js) | 3D astronaut on the Astronaut View | MIT (Draco: Apache 2.0) |
| Recharts | Charts and trend lines | MIT |
| Zustand | Shared app state | MIT |
| Barlow, Barlow Semi Condensed (via Fontsource) | Typeface, works offline | SIL Open Font License 1.1 |
| Vite, @vitejs/plugin-react | Development server and build | MIT |
| Tailwind CSS | Styling | MIT |
| TypeScript | Type checking | Apache 2.0 |
| Vitest, oxlint | Tests and lint | MIT |

Exact versions are in `package.json` and `package-lock.json`.

## AI use disclosure

As required by the NASA Space Apps rules, the data, tools and AI used are listed here.

**Inside the app (part of the product)**
- Layer 2 (ASTRA): Google Gemini (`gemini-3.8-flash`; `gemini-3.5-flash-lite` and `gemini-3.7-flash` as backup models when it is overloaded). Gemini was used in development and in the demo. The code can optionally switch to Anthropic Claude Haiku 5.5 (`ASTRA_PROVIDER=claude`); this option was not used in production. It is called over REST from the server function; keys stay on the server only.
- The language model only reads: it explains incidents, answers questions and states data-based possible conditions as possibilities. It cannot raise alerts or change telemetry, incidents or autonomous actions. Answers with a definitive diagnosis or medication are stopped by the safety filter; the numbers in an answer are checked against the data.

**During development**
- Anthropic Claude and Google Gemini: used as assistants for planning, coding, translation and source research in all four parts (simulation, Layer 1, interface, ASTRA); the code was generated with them (see the `Co-Authored-By` lines in the commits). The team reviewed the generated code and verified it with tests (`npm run test`). No other AI tools were used.
- Layer 1's thresholds and rules were chosen by the team and documented with their sources (`src/engine/config.ts`).

**Data and images**
- All astronaut data is synthetic (simulation); no real person's health data is used. Parameter sources are in `src/sim/parameters.ts` (NASA HRP, NASA-STD-3001, OCHMO-TB-004, OSDR EDA, DONKI, peer-reviewed studies).
- NASA imagery is in the public domain and is used with credit: the NASA/SDO solar flare video and the astronaut model from NASA 3D Resources. The astronaut drawings in the cinematics and the image on the Tasks page are original SVG drawings made for this project.
- The NASA logo is not used; the project is not endorsed by NASA.

## License

Apache 2.0 — see `LICENSE`.
