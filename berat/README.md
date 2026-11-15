# Berat · Part 3 · Interface

Owner: @beyazitberatyusuf-afk · Branches: `berat/arayuz`, `berat/arayuz-son` (merged in PR #17), `berat/tema-mavi` (open PR #26)

The code is not in this folder. It sits in the shared structure: `src/App.tsx`, `src/index.css` and `src/ui/` (except Reports, Settings and Tasks).
The UI produces no data and makes no decisions. It only reads from `useAstra` and calls `controls.setScenario / acknowledge / reset`.

## What is in `main`

| Part | Where | What it does |
| --- | --- | --- |
| App shell | `src/App.tsx` | Orbitalis logo and ASTRA-MED OS, six pages in the left rail. Bottom left: **Comm with Earth** (one-way delay from `ship.commDelayOneWay_s`, 12 min 30 s, round trip 25 min) and **Reset simulation**. Top bar: live clock with **Mission Day**, bell (open incident count, red when there is a WARNING, opens Reports), crew member card. During the first 30 readings, **Baseline 12/30** shows under the clock; start a scenario after it fills. |
| Mission Status | `src/ui/pages/Kokpit.tsx` | Status strip: crew online, average health (Layer 1 score of 6 crew), mission status (open WARNING → "Action required"), Mission Day 180 / ~900 with progress bar. Crew table split into orbit crew and surface crew (heart rate, SpO₂, temperature, health). Wireframe Mars orbit display: the ARES-1 marker carries the orbit crew's status color, the EVA marker the surface crew's. Habitat environment (cabin and suits: ppCO₂, oxygen, pressure, radiation dose rate) and recent log. |
| Astronaut View | `src/ui/pages/AstronotEkrani.tsx` | Crew selector, 3D body map, health card (score, heart rate, temperature, SpO₂ and heart rate trend), radiation (dose rate, cumulative dose against the 600 mSv career limit), cabin CO₂ with CAUTION and WARNING thresholds, sleep, reaction test (PVT). Tabs: Overview, Health, Performance, Environment. |
| 3D astronaut | `src/ui/components/Astronaut3D.tsx` | three.js model (`src/ui/assets/astronaut.glb`, Draco decoder bundled, works offline), loaded only when the page opens. Rotates slowly, can be dragged, slows down under the cursor. Regions: **Head** (cognition and eyes), **Chest** (heart and breathing), **Lower body** (metabolism, sweat and heat), and the **Environment** ring under the feet. Hover shows the region's risk; click opens all its readings. Falls back to a 2D drawing without WebGL. |
| Crew | `src/ui/pages/Astronotlar.tsx` | Orbit crew (IVA) and surface crew (EVA) with team averages; six cards with role, unit, health score, level and heart rate trend. A click opens that person's Astronaut View. |
| Incident banner | `src/ui/components/IncidentBanner.tsx` | WARNING: sticky red band with title, affected crew, the autonomous action (e.g. "Ventilation increased · automatic") and **Acknowledge**. Below it the triggering signals (value, unit, personal baseline, z) and ASTRA's explanation from Part 4. After Acknowledge it shrinks to a thin strip. CAUTION: one amber line, opened with **Details**. As soon as a scenario starts, a blue **Vehicle event** line appears. |
| Shared components | `src/ui/components/` | `Card`, `StatTile`, `Sparkline` + `TrendLine`, `SourceBadge`, `ProgressRing`, `LevelBadge`, `BodyMap`, `OrbitalDisplay`, `Icons` |
| Format and accessibility | `src/ui/theme.ts`, `src/ui/format.ts` | Numbers in en-US (`36.8 °C`, `87%`, `12 min 30 s`). Every level is color + symbol + text (● NOMINAL, ▲ CAUTION, ■ WARNING), so it still reads without color. Red is only used for WARNING. `prefers-reduced-motion` is respected. Font: Barlow / Barlow Semi Condensed (`@fontsource`, offline). |

Every number has a source badge (`SourceBadge`): NASA-STD-3001, OSDR, Curiosity RAD, NASA HRP or a peer-reviewed study, and a grey "Assumption" when there is none. It opens the source link from `PARAMS`. For the surface crew the dose rate badge switches to the Mars surface RAD measurement, and the pressure and O₂ badges to the suit source.

## Added by the team on top of these screens

- **Azra (Part 4):** scenarios moved into a muted **Simulation ▾** menu, source badges turned into small grey (i) icons, reference range indicator ("normal 96–100 ✓"), **Ask ASTRA** button, psychological test suggestions on Astronaut View.
- **Burcin (Part 1):** English UI with NASA terminology (PR #29), helmet **Visor view** (HUD) for the surface crew with an "On EVA" tag, scenario cinematics and the jury demo tour.

## Next version: health console v4 (PR #26, open)

On branch `berat/tema-mavi`, not in `main` yet. It turns Mission Status into a single-screen crew health console in a NASA style:

- Palette based on NASA blue (#0B3D91); fonts from the NASA Horizon Design System (Inter, Public Sans, DM Mono). Colors follow NASA-STD-3001 Vol. 2: red only for WARNING, yellow for CAUTION, blue for advisories.
- Panels: mission status with medical bay (beds 0/4), ASTRA messages, medical kit / diagnoses / treatment (ISS medications, Wotring 2015), crew grid with EVA tags, selected crew member with 3D model and health data.
- **Ground · MCC-Houston** thread: messages to the Flight Surgeon reach Earth after the light-time delay. Rule-based replies follow the scenario. ASTRA chat sits in the same panel.
- Top bar: ground link (AOS/LOS) and one-way light time.

The PR was built before PR #29. The English part is already in `main`, so the branch needs to be updated against `main` before it can merge.

## How to try

```bash
cd nasa-space-apps-2026
npm install
npm run dev          # http://localhost:5173
```

If the terminal says "Port 5173 is in use", an older dev server is still running: open the address the terminal prints, or close the old terminals first.

1. Leave the app open for about 40 s until **Baseline 30/30** fills under the clock.
2. **Simulation ▾ → CO₂ failure:** the cinematic plays, then the blue **Vehicle event** line appears. As ppCO₂ climbs, Layer 1 raises CAUTION, then the red WARNING band with "Ventilation increased · automatic".
3. Click **Kerem** in the band → Kerem's Astronaut View; Chest and the Environment ring change color on the body map.
4. **Acknowledge** → the band shrinks to a strip and Reports shows "Crew acknowledged: …".
5. **Simulation ▾ → EVA overexertion** → Mert goes to WARNING; the heart rate trend turns red and the deviating readings are marked ■. After the cinematic, Mert's helmet visor opens on its own.

## Checks (15 Nov)

Headless Chrome at 1280×800 and 1024×768, all six pages:

- No horizontal overflow and no console errors.
- Text below 14 px only in the (i) source icons, the ▾ menu arrow, the "On EVA" tag and the Settings source table.
- On `main` at PR #31, `npx tsc -b` is clean and 176 tests pass.

## Notes for the team

- **Body map thresholds:** a region score below 85 is CAUTION and below 60 is WARNING (`theme.ts`). In an earlier 5-minute nominal run no region dropped below 88, so there were no false alarms. Layer 1 still raises the actual alerts.
- **Mission duration** (~900 days, NASA Mars DRA 5.0) is in `src/ui/params.ts` in `PARAMS` format. Part 1 can move it into `parameters.ts` if wanted.
- The existing names in `theme.ts` (`COLORS`, `fmt`, `LEVEL_*`) were kept; new ones were only added. `LevelBadge` is 14 px, so Reports and Tasks benefit too.
