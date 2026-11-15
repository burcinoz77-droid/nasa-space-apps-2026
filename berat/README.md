# Berat · Part 3 · Interface

Owner: @beyazitberatyusuf-afk · Branch: `berat/arayuz`

The code is not in this folder; it lives in the shared structure: `src/App.tsx`, `src/index.css`, `src/ui/` (except Reports, Settings and Tasks).
The interface produces no data and makes no decisions: it only reads from `useAstra` and calls `controls.setScenario / acknowledge / reset`.

## What was built

| Step | Where | Note |
| --- | --- | --- |
| Shared components | `src/ui/components/` | `Card`, `StatTile`, `Sparkline` (Recharts) + `TrendLine` (lightweight SVG), `SourceBadge`, `ProgressRing`, `LevelBadge`, `BodyMap`, `Icons` |
| App shell | `src/App.tsx` | Orbitalis logo, ASTRA-MED OS, 6 pages; bottom left "Comm with Earth" (`ship.commDelayOneWay_s` → 12 min 30 s) and "Reset simulation"; in the top bar the scenario menu (active = `ship.scenario`), live clock + Mission Day, bell (number of open incidents, red if Warning, click for Reports), profile card. During the first 30 readings "Baseline 12/30" shows under the clock: start a scenario after that |
| Mission Status | `src/ui/pages/Kokpit.tsx` | Status strip (crew, average health, mission status: red "Intervention needed" if a Warning incident is open, Mission Day), crew table, orbit display, mission progress ring (Day 180 / ~900, NASA DRA 5.0) |
| Astronaut View | `src/ui/pages/AstronotEkrani.tsx` | Astronaut pills, body map, health card (score, heart rate, temperature, SpO₂ + heart rate chart), stress factors (radiation dose rate + total dose / 600 mSv bar, CO₂ with threshold lines, sleep, PVT), tabs: Overview / Health / Performance / Environment |
| Crew | `src/ui/pages/Astronotlar.tsx` | Two crew headers (with average health), 6 cards: role, unit, sensitivity, score, level, heart rate chart. Clicking a card opens that person's Astronaut View (the selected person is kept in `App.tsx`) |
| Incident experience | `src/ui/components/IncidentBanner.tsx` | Warning incident: sticky red banner at the top (title, affected people, autonomous action "Ventilation increased · automatic", **Acknowledge**); below it the signals (value + unit + personal baseline + z) and Part 4's purple ASTRA explanation. Once acknowledged it becomes a thin strip. Caution: a single amber line, expanded with "Details". As soon as a scenario starts, a blue "Vehicle event" advisory line appears |
| Format and accessibility | `src/ui/theme.ts`, `src/ui/format.ts` | Numbers in English format (`36.8 °C`, `87%`, `12 min 30 s`); every level has color + symbol + label (● NOMINAL, ▲ CAUTION, ■ WARNING); smallest text 14 px; `prefers-reduced-motion` supported |

The source badge (`SourceBadge`) is next to every number: NASA-STD-3001 / OSDR / Curiosity RAD / NASA HRP / peer-reviewed study (e.g. "Norsk 2015") / gray "Assumption". Clicking opens the source link from `PARAMS`. For the surface crew the dose rate badge switches to the surface measurement (Mars surface RAD), and the pressure and O₂ badges to the suit source.

## Version 2 (Mission Status and 3D astronaut)

- **Mission Status** moved to a mission control console layout: one-piece status strip, crew table (heart rate trend, SpO₂, temperature), wireframe Mars orbit display (the spacecraft marker carries the orbit crew's status color, the EVA marker the surface crew's), habitable environment (cabin and suits) and latest log entries.
- On the **Astronaut View** the body map became a 3D astronaut model (`src/ui/components/Astronaut3D.tsx`, three.js, loaded separately when the page opens). The model rotates slowly and can be dragged with the mouse. Regions: **head** (helmet: cognitive and eyes), **chest** (torso, arms, backpack: heart and breathing), **lower body** (hips and legs: metabolism, sweat and heat) and the **environment** ring under the feet. Hovering over a region shows a risk box (level, score, most deviating metric); clicking opens all metrics of the region. Without WebGL it falls back to a 2D drawing.
- The model is `src/ui/assets/astronaut.glb`; the Draco decoder comes from the three package. Both are bundled into the build, no internet needed.
- Typeface: Barlow / Barlow Semi Condensed (`@fontsource`, offline).

## How to try it

```bash
npm install
npm run dev          # http://localhost:5173
```

1. Leave the app open for ~40 s (until "Baseline 30/30" under the clock is full).
2. Choose **CO₂ failure** from the **Simulation ▾** menu: a blue "Vehicle event" line right away, an amber CAUTION after ~18 s, a red WARNING banner after ~40 s and "Ventilation increased · automatic".
3. Click **Kerem** in the banner → Kerem's Astronaut View; the chest and the environment ring change color on the body map.
4. **Acknowledge** → the banner becomes a thin strip and a "Crew acknowledged" row appears in Reports.
5. **EVA overexertion** → Mert reaches Warning; the heart rate chart turns red and deviating metrics are marked with ■ on the Health tab.

## Check results (Sunday morning step)

Six pages and two scenarios were opened in headless Chrome at 1280×800 and 1024×768:

- No horizontal overflow, no text below 14 px (except Settings, see below), no console errors.
- No "ISS", "408 km" or NASA logo on screen (except the source table in Settings, see below).
- "Acknowledge" is written to the incident log.
- Merged and tested together with Part 4's branch (`azra/ai`, PR #3): it builds, the tests pass, and the purple ASTRA explanation appears under the banner.

## Notes for the team

- **Merge order** as in the plan: Part 1 → 2 → 4 → **3 last**. The ASTRA explanation is loaded with a glob from `AstraSlot.tsx` (the same method as Reports); the build does not break even before Part 4 is merged.
- **10-second criterion (Part 1 + 2):** the interface renders the state on every reading (1.2 s); the blue vehicle event line appears within 1.2 s. But Layer 1's incident in the CO₂ failure is raised after ~18 s (Caution) and ~40 s (Warning), because ppCO₂ rises over 90 readings and there is the 3-consecutive-reading rule. If a faster demo is wanted, `rampTicks` in `CO2_SCRUBBER_FAIL.json` can be shortened.
- **Settings (Part 1):** the source table had "ISS RR-19 median" and "OSDR EDA (ISS environmental data)" and some 12 px (`text-xs`) text; worth checking against the "no ISS on screen" and "smallest text 14 px" criteria.
- **New constant:** the mission duration (~900 days, NASA Mars DRA 5.0) is in `src/ui/params.ts`, in `PARAMS` format. Part 1 can move it to `parameters.ts` if wanted.
- **Body map thresholds:** domain score < 85 → CAUTION, < 60 → WARNING (`theme.ts`). It was measured that no domain fell below 88 over 5 minutes on a nominal day; no false alarms. Layer 1 still raises the actual alert.
- `LevelBadge` is now 14 px; Reports and Tasks benefit too. The existing names in `theme.ts` (`COLORS`, `fmt`, `LEVEL_*`) did not change, only additions.
- We did not have the code of the prototype in screenshots 2–7; the pages were developed from the kit's v0 following the plan.
