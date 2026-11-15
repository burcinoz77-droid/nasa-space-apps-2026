# Emir · Part 2 · Layer 1 (anomaly detection and incident log)

Owner: @emirruzunn · Branch: `emir/katman1`

The code is not in this folder; it lives in the shared structure:

| File | What it does |
| --- | --- |
| `src/engine/config.ts` | Thresholds, SD floors, rule constants. The source link of every NASA threshold is next to it |
| `src/engine/baseline.ts` | Personal baseline (Welford, first 30 readings, then frozen), directional z-score, 3-consecutive-reading rule |
| `src/engine/rules.ts` | Incident rules: RADIATION, CO2, HYPOXIA, CARDIO, THERMAL, FATIGUE, STRESS, MULTI |
| `src/engine/index.ts` | `createDetector()`: health score, raise/escalate/resolve incidents, autonomous actions, incident log |
| `src/engine/labels.ts` | Incident and autonomous action names (`INCIDENT_LABELS`, `ACTION_LABELS`) |
| `src/engine/*.test.ts` | Unit tests + end-to-end tests (`npm run test`) |
| `src/ui/pages/Reports.tsx` | Reports page: incident log, filter, telemetry snapshot report, acknowledgement |

## How it works (for the jury, in 30 seconds)

1. **Personal baseline.** For every metric of every astronaut, the mean and deviation of the first 30 readings are
   learned, then frozen. So "Zeynep's heart rate is low" is her baseline, not an alarm.
2. **Deviation = z-score.** Only the risky direction counts (SpO₂ falling is bad, CO₂ rising is bad). z ≥ 2 Caution, z ≥ 3 Warning.
3. **NASA limits take precedence.** ppCO₂ (> 2.3 / > 3.0 mmHg, OCHMO-TB-004), total dose (480 / 600 mSv, NASA-STD-3001),
   SpO₂ (< 94 / < 90%) and core temperature (38.5 / 39.0 °C) are tracked with absolute thresholds; these work before the baseline is built.
4. **A single spike raises no alarm.** The level only changes if 3 consecutive readings stay in the same direction (fewer false alarms).
5. **Incident and safe action.** Incidents are raised by the rule table; there is one open incident per person/location + type.
   Only three actions are automatic: storm shelter ingress, increased ventilation, mandatory crew rest. At most once per incident.
6. **Automatic resolution.** If all signals stay nominal for 10 readings, the incident is "resolved". Everything goes to the incident log.
7. **The AI cannot raise alerts.** Only Layer 1 raises alerts; ASTRA only explains.

## What happens in the scenarios (tested with the Part 1 simulation, seed 2026)

| Scenario | Incident raised | Autonomous action | First incident |
| --- | --- | --- | --- |
| Nominal day | None (10 seeds × 6.6 min tested, 0 false alarms) | — | — |
| Solar particle event | Orbit and surface radiation (Warning); Elif stress + multi-system | Storm shelter (both crews) | ~12 readings |
| CO₂ scrubber failure | Spacecraft CO₂ (Caution → Warning) | Ventilation; CO₂ falls, the incident resolves | ~14 readings |
| Mars Day 180 workload | Elif fatigue + multi-system; the others only at Caution | Mandatory crew rest for Elif | ~31 readings |
| EVA overexertion | Mert multi-system (Warning) + heat load | Mandatory crew rest for Mert; temperature falls | ~22 readings |

After "Stabilize all crew", all incidents resolve by themselves in 10–30 readings.

## Demo notes

- After the app opens, wait **at least 36 seconds** (30 readings): start a scenario once the log says the personal baselines are built.
  If started earlier, the baseline is frozen early with the readings so far (at least 10) and the log says so; the demo still works.
- To be presented to the jury as "assumptions": SD floors, the SpO₂ and core temperature thresholds, and not counting the environmental domain in the MULTI rule.

## For the other parts

- **Part 3:** `ACTION_LABELS` (`src/engine`) can be used for `incident.autoActions` in the incident banner
  ("Ventilation increased · automatic"). A person's `level` carries the incident's level while its signals persist.
- **Part 1:** for orbit/surface-wide actions (storm shelter, ventilation), `AutoAction.crewIds` includes everyone at that location.
- **Part 4:** the `AstraExplanation` component appears automatically in the incident rows on Reports.
  Incident titles do not diagnose; `incident.signals` contains the value, personal mean and z.
