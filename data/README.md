Recorded NASA data (DONKI, OSDR EDA) is stored here as JSON. The app uses these files so the demo also works without internet; it does not call the live API.

| File | What | Source | Retrieved |
| --- | --- | --- | --- |
| `donki_sep_2024-05.json` | Solar energetic particle (SEP) events, May 2024: 14 records, 4 of them model predictions. Raw API response, unchanged. | https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP?startDate=2024-05-01&endDate=2024-05-31 | 14 November 2026 |

The solar particle event scenario (`src/sim/scenarios/SOLAR_STORM.json`) takes its event order and UTC times from these records:

| UTC | DONKI record |
| --- | --- |
| 10 May 2024 06:54 | X3.9 solar flare peak (FLR 30666) |
| 10 May 2024 13:35 | GOES >10 MeV particle event (SEP 30677) |
| 11 May 2024 01:23 | X5.8 solar flare peak (FLR 30711) |
| 11 May 2024 02:10 | GOES >100 MeV particle event (SEP 30714) |
| 13 May 2024 14:00 | GOES >10 MeV second wave (SEP 30817) |

DONKI gives the time of an event, not the dose. The dose multipliers in the scenario are assumptions.

## Imagery

| File | What | Source |
| --- | --- | --- |
| `public/media/sdo-x39-2024-05-10.mp4` | X3.9 solar flare on 10 May 2024, NASA SDO AIA 304 Å. A 16 s cut (06:29–08:05 TAI) from the original 40 s / 50 MB video, 720×720, no audio. | NASA SVS 5286: https://svs.gsfc.nasa.gov/5286/ · Imagery: NASA/SDO |

NASA imagery is not copyrighted and is used with credit. The NASA logo is not used.
