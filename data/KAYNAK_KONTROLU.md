# Source check (Part 1)

Every source link in `src/sim/parameters.ts` was checked one by one on 14 November 2026: does the link open, and does the number shown on screen appear in the source?

| Number | Value | Source | Result |
| --- | --- | --- | --- |
| Mars cruise dose rate | 1.84 mSv/day | Curiosity RAD (Zeitlin 2013, SwRI); Space.com | Verified (1.8 cruise; 1.84 Space.com) |
| Mars surface dose rate | 0.64 mSv/day | Space.com, Hassler 2013 | Verified |
| Career limit | 600 mSv | NASA OCHMO radiation technical brief | Verified (250 mSv per event is also stated) |
| CO₂ thresholds | 2.3 / 3.0 mmHg | OCHMO-TB-004 | Partly: 3.0 (1-hour) and 2.5 (7-day) are in the brief; 2.3 is from NASA NTRS (level where symptoms begin). Unit description corrected |
| ISS cabin CO₂ median | 1.9 mmHg | OSDR EDA | Link verified (EDA app) |
| Sleep in space | 6.09 h | Barger 2014 (EurekAlert) | Verified |
| Comm delay with Earth | 3–22.4 min | NASA NTRS, ASCEND 2022 | Link replaced: the old NASA link could not be verified. 54.6–401 million km ÷ speed of light = 3.0–22.3 min |
| Core temperature rise | +1 °C, > 40 °C during exercise | Stahn 2017 | Verified |
| Blood pressure drop | 8–10 mmHg | Norsk 2015 | Verified |
| HRV (RMSSD) | 42 ± 15 ms, 19–75 | Nunan 2010 | Verified |
| PVT lapse threshold | 355 ms | Basner 2011 | Verified |
| PVT and sleep loss | — | Jones 2022 | Verified |
| BSI-18 general population | 4.7 | Franke 2017 | Verified (GSI 4.66) |
| PANAS | 33.3 / 17.4 | Watson 1988 | Verified (weekly norms) |
| Sweat cortisol, lactate, sodium | 8–140 ng/mL, 5–20 mM, 10–100 mM | Sweat biomarker table (PMC8985157) | Verified |
| EtCO₂, respiratory rate | 35–45 mmHg, 12–20/min | JEMS | Verified |
| EVA suit | 4.3 psia (29.6 kPa), 100% O₂ | NASA NTRS ICES-2023 | Verified |
| Cabin atmosphere | 14.7 psia (101.3 kPa), 21% O₂ | NASA NTRS ICES-2024 | Link replaced: the old link could not be verified |
| Breath VOC (E-nose) | assumed scale | IAC-18 | Link verified (oxidative stress measured from breath in space) |
| NASA HRP risk pages | — | nasa.gov/reference/... | Verified |
| Solar particle event times | May 2024 | NASA DONKI | Raw data saved and verified by hash (`donki_sep_2024-05.json`) |

The 16 numbers without a source are shown in the app with an "Assumption" badge, and the jury is told so.
