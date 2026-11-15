// Parça 4 · ASTRA'nın kaynaklı bilgi tabanı (bağlam). Model "neden önemli?" ya da "sınır ne?"
// sorularında lookup_reference aracıyla buradan okur ve kaynağı belirtir.
// Sayılar planın "Veri ve kaynaklar" tablosundan ve src/sim/parameters.ts'ten gelir; yeni sayı uydurulmaz.
// "Varsayım" yazanların NASA ya da hakemli bir kaynağı yoktur.
import { LICENSED_NOTE_LONG, TEST_SOURCES } from '../psych/instruments';
import { PARAMS } from '../sim/parameters';

export interface Fact {
  bilgi: string;
  kaynak: string;
  url?: string;
}

export interface ReferenceTopic {
  konu: string;
  anahtarKelimeler: string[];
  bilgiler: Fact[];
}

type ParamLike = { value: number; source?: string; url?: string };

/** PARAMS'tan kaynak adı ve linki; anahtar yoksa verilen kaynak adı kullanılır. */
function src(key: string, fallback: string): Pick<Fact, 'kaynak' | 'url'> {
  const p = (PARAMS as Record<string, ParamLike | undefined>)[key];
  return { kaynak: p?.source ?? fallback, ...(p?.url ? { url: p.url } : {}) };
}

/** Test kaynağını bilgi tabanı biçimine çevirir. */
function fromTest(t: { ad: string; url: string }): Pick<Fact, 'kaynak' | 'url'> {
  return { kaynak: t.ad, url: t.url };
}

function val(key: string, fallback: number): string {
  const v = (PARAMS as Record<string, ParamLike | undefined>)[key]?.value ?? fallback;
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** NASA HRP: 4–6 aylık görevlerde ağırlık taşıyan kemikler ayda ortalama %1–1,5 yoğunluk kaybeder. */
export const BONE_LOSS_PER_MONTH = { min: 1, max: 1.5 };
const BONE_SRC = { kaynak: 'NASA HRP, risk of bone changes', url: 'https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/' };

/** Görev gününe göre kaba kemik yoğunluğu kaybı tahmini, örneğin 180. gün için "6–9%". Ölçüm değildir. */
export function boneLossEstimate(missionDay: number): string {
  const months = missionDay / 30.4;
  const lo = Math.round(months * BONE_LOSS_PER_MONTH.min);
  const hi = Math.round(months * BONE_LOSS_PER_MONTH.max);
  return lo === hi ? `${lo}%` : `${lo}–${hi}%`;
}

const ASSUMPTION = { kaynak: 'Assumption (team setting; no universal threshold in NASA or peer-reviewed sources)' };

export const REFERENCES: ReferenceTopic[] = [
  {
    konu: 'radiation',
    anahtarKelimeler: ['radiation', 'dose', 'msv', 'sievert', 'solar', 'storm', 'flare', 'shelter', 'career', 'spe'],
    bilgiler: [
      { bilgi: `The career radiation limit is ${val('careerDoseLimit', 600)} mSv.`, ...src('careerDoseLimit', 'NASA-STD-3001 (OCHMO radiation brief)') },
      {
        bilgi: `During Mars cruise (orbit crew) the dose rate is ${val('doseRateMarsTransit', 1.84)} mSv/day, about 76.7 µSv/h.`,
        ...src('doseRateMarsTransit', 'Curiosity RAD, Zeitlin et al. 2013'),
      },
      {
        bilgi: `On the Mars surface the dose rate is ${val('doseRateMarsSurface', 0.64)} mSv/day, about 26.7 µSv/h; the atmosphere acts as a partial shield.`,
        ...src('doseRateMarsSurface', 'Curiosity RAD, Hassler et al. 2013'),
      },
      {
        bilgi:
          'Layer 1 opens a caution event when the cumulative dose reaches 480 mSv (80% of the career limit) and a warning event at 600 mSv; when the dose rate deviates from the personal baseline by z ≥ 3 it starts storm shelter ingress.',
        kaynak: 'Layer 1 rule, based on the NASA-STD-3001 limit',
      },
      {
        bilgi: 'About 30% of the total radiation on the ISS is from neutrons; this share applies to the ISS and should not be used for Mars.',
        kaynak: 'Canadian Space Agency (CSA), 2026',
        url: 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp',
      },
      {
        bilgi:
          'On the Mars surface neutrons make up about 7% of the total dose rate and about 10% of the biologically relevant dose equivalent. The app does not show the neutron share separately.',
        kaynak: 'Köhler et al. 2014, Curiosity RAD neutron measurements on the Mars surface',
      },
      {
        bilgi: 'The event sequence in the solar particle event scenario follows the May 2024 DONKI records (DONKI does not provide dose values).',
        ...src('donkiSep', 'NASA DONKI, May 2024 SEP'),
      },
      {
        bilgi: `During the Mars cruise Curiosity measured about 332 µGy per day in quiet periods and more than 10,000 µGy per day in solar storms; the storm peak in the scenario is therefore ${val('stormDoseMultiplierPeak', 30)} times normal.`,
        ...src('stormDoseMultiplierPeak', 'Guo et al. 2015, A&A'),
      },
      {
        bilgi: `On Artemis I, the dose in Orion's shelter in a 1989-storm simulation was about ${val('shelterDoseFactor', 0.23)} times that of the crew cabin (95 µGy/min instead of 414 µGy/min).`,
        ...src('shelterDoseFactor', 'George et al. 2024, Nature'),
      },
      {
        bilgi:
          "In the May 2024 storm, an astronaut next to Curiosity on the Mars surface would have received 8,100 micrograys. The scenario's surface storm multiplier (5×) and storm onset multiplier (25×) are assumptions.",
        ...src('stormDoseMultiplierSurface', 'NASA, May 2024'),
        kaynak: 'NASA, May 2024 solar storm at Mars',
        url: 'https://www.nasa.gov/?p=670127',
      },
    ],
  },
  {
    konu: 'co2',
    anahtarKelimeler: ['co2', 'co₂', 'carbon dioxide', 'carbon', 'ventilation', 'scrubber', 'cdra', 'cabin air'],
    bilgiler: [
      {
        bilgi: `CO₂ partial pressure above ${val('co2CautionLimit', 2.3)} mmHg is a caution, above ${val('co2CriticalLimit', 3.0)} mmHg a warning.`,
        ...src('co2CautionLimit', 'OCHMO-TB-004 CO₂'),
      },
      { bilgi: 'High CO₂ can cause symptoms such as headache and loss of attention.', ...src('co2CautionLimit', 'OCHMO-TB-004 CO₂') },
      {
        bilgi: `The ISS cabin CO₂ median is ${val('cabinCO2Median', 1.9)} mmHg (2,516 ppm); the highest value measured is ${val('cabinCO2FailurePeak', 5.3)} mmHg (6,977 ppm).`,
        ...src('cabinCO2Median', 'OSDR EDA (ISS environmental data)'),
      },
      { bilgi: 'In a warning-level CO₂ event, Layer 1 increases ventilation automatically.', kaynak: 'Layer 1 rule' },
    ],
  },
  {
    konu: 'oxygen',
    anahtarKelimeler: ['oxygen', 'spo2', 'spo₂', 'saturation', 'hypoxia', 'cabin pressure', 'suit pressure', 'suit'],
    bilgiler: [
      {
        bilgi: 'SpO₂ is normally 96–100% at sea-level pressure; the cabin is also at sea-level pressure. No alert is raised for values in this range.',
        ...src('spo2Normal', 'NIH StatPearls'),
      },
      {
        bilgi: 'The SpO₂ thresholds of below 94% for caution and below 90% for warning are clinical assumptions.',
        ...ASSUMPTION,
        kaynak: 'Clinical threshold, assumption (risk: NASA HRP hypoxia)',
      },
      { bilgi: `The cabin is at ${val('cabinPressure', 101.3)} kPa with 21% O₂ (same as the ISS).`, ...src('cabinPressure', 'Cabin atmosphere (NASA NTRS)') },
      { bilgi: `The EVA suit is at ${val('suitPressure', 29.6)} kPa with 100% O₂.`, ...src('suitPressure', 'EVA suit regulator (NASA NTRS)') },
    ],
  },
  {
    konu: 'temperature',
    anahtarKelimeler: ['temperature', 'fever', 'core', 'heat', 'effort', 'thermal', 'overexertion'],
    bilgiler: [
      {
        bilgi: `At rest in space, core temperature is about ${val('coreTempRiseInSpace', 1)} °C higher (37.3–37.8 °C); during exercise it can exceed 40 °C.`,
        ...src('coreTempRiseInSpace', 'Stahn et al. 2017, Sci Rep'),
      },
      {
        bilgi: 'Layer 1 opens a caution event at a core temperature of 38.5 °C and a warning event at 39.0 °C, and orders mandatory crew rest.',
        ...ASSUMPTION,
      },
    ],
  },
  {
    konu: 'sleep',
    anahtarKelimeler: ['sleep', 'fatigue', 'rest', 'rem', 'circadian', 'tired'],
    bilgiler: [
      {
        bilgi: `Average sleep in space is ${val('sleepInSpaceMean', 6.09)} hours; NASA schedules 8.5 hours.`,
        ...src('sleepInSpaceMean', 'Barger et al. 2014, Lancet Neurology'),
      },
      { bilgi: 'Sleep loss lengthens PVT reaction time and increases stress.', ...src('pvtMeanRtRested', 'Jones et al. 2022 (NASA Reaction Self Test)') },
      {
        bilgi:
          'Layer 1 opens a fatigue event and orders mandatory crew rest when at least three of sleep, PVT, PANAS positive affect, BSI-18 and HRV reach caution together.',
        kaynak: 'Layer 1 rule',
      },
    ],
  },
  {
    konu: 'cognitive',
    anahtarKelimeler: ['pvt', 'reaction', 'attention', 'cognitive', 'panas', 'bsi', 'mood', 'stress', 'cortisol'],
    bilgiler: [
      {
        bilgi: `In a rested person the PVT reaction time is about ${val('pvtMeanRtRested', 250)} ms.`,
        ...src('pvtMeanRtRested', 'Jones et al. 2022 (NASA Reaction Self Test)'),
      },
      {
        bilgi: `In the PVT, reactions of ${val('pvtLapseThreshold', 355)} ms or longer count as lapses.`,
        ...src('pvtLapseThreshold', 'Basner et al. 2011, PVT-B'),
      },
      { bilgi: 'PANAS positive affect averages 33.3 and negative affect 17.4 (10–50 scale).', ...src('panasPositiveMean', 'Watson et al. 1988, PANAS') },
      { bilgi: 'Layer 1 opens a stress event when GSR, sweat cortisol and PANAS negative affect all rise together.', kaynak: 'Layer 1 rule' },
      { bilgi: LICENSED_NOTE_LONG, kaynak: 'Project note (simulation)' },
    ],
  },
  {
    konu: 'tests',
    anahtarKelimeler: ['test', 'tlx', 'nasa-tlx', 'workload', 'samn', 'perelli', 'fatigue scale', 'psychological', 'questionnaire', 'scale'],
    bilgiler: [
      {
        bilgi:
          'NASA-TLX is the workload scale developed at NASA Ames: 6 subscales (mental, physical and temporal demand, performance, effort and frustration), each 0–100.',
        ...fromTest(TEST_SOURCES.tlx),
      },
      { bilgi: 'Raw TLX is the unweighted mean of the six subscales and is used without the pairwise comparison step.', ...fromTest(TEST_SOURCES.hart2006) },
      {
        bilgi:
          'Samn-Perelli is a 7-point fatigue scale from 1 (fully alert) to 7 (completely exhausted); it was used together with the PVT in the NASA–easyJet pilot fatigue study.',
        ...fromTest(TEST_SOURCES.nasaFatigue),
      },
      {
        bilgi: 'PVT-B is a 3-minute reaction test; stimuli come 1–4 seconds apart, and reactions of 355 ms or longer count as lapses.',
        ...fromTest(TEST_SOURCES.basner2011),
      },
      {
        bilgi:
          'On the ISS astronauts took the PVT-B as the Reaction Self Test, together with brief mood and workload ratings, every 4 days in the morning and evening throughout the flight; sleep shorter than 6 hours was linked to slower reactions.',
        ...fromTest(TEST_SOURCES.jones2022),
      },
      {
        bilgi: 'The test level thresholds (Samn-Perelli 5 or higher, NASA-TLX 50 or higher for caution) are assumptions; there is no official cut-off.',
        kaynak: 'Assumption (project rule)',
      },
    ],
  },
  {
    konu: 'heart',
    anahtarKelimeler: ['heart', 'pulse', 'heart rate', 'blood pressure', 'hrv', 'ecg', 'ekg', 'rhythm'],
    bilgiler: [
      {
        bilgi: `On a long mission heart rate does not change markedly; 24-hour systolic blood pressure is about ${val('bpDropInSpace', 8)} mmHg lower.`,
        ...src('bpDropInSpace', 'Norsk et al. 2015, J Physiol'),
      },
      { bilgi: 'The short-term HRV (RMSSD) norm is 42 ± 15 ms; a drop is linked to stress and fatigue.', ...src('hrvRmssdMean', 'Nunan et al. 2010') },
      {
        bilgi: 'If irregular beats appear on the ECG, Layer 1 opens a caution event and recommends a medical check; it does not diagnose.',
        kaynak: 'Layer 1 rule (risk: NASA HRP cardiovascular)',
      },
    ],
  },
  {
    konu: 'delay',
    anahtarKelimeler: ['delay', 'earth', 'communication', 'message', 'flight surgeon', 'light time', 'owlt', 'ground'],
    bilgiler: [
      { bilgi: 'One-way light time between Earth and Mars is 3–22.4 minutes; round trip 6–44 minutes.', ...src('commDelayMin', 'NASA Mars Relay Network') },
    ],
  },
  {
    konu: 'environment',
    anahtarKelimeler: ['environment', 'cabin temperature', 'ambient temperature', 'humidity', 'noise', 'sound level', 'decibel', 'dba', 'comfort'],
    bilgiler: [
      {
        bilgi:
          "NASA performance zone: ambient temperature 20–25 °C and relative humidity 30–60%. The health limits run from 18 °C at 75% humidity to 27 °C at 25% humidity. The app's nominal values (22.5 °C, 45%) sit in the middle of this range.",
        ...src('ambientTempComfort', 'OCHMO-TB-002 ECLSS'),
      },
      {
        bilgi:
          "The continuous noise limit in spacecraft work areas is the NC-50 curve (about 58 dBA). The app's nominal value of 55 dBA is an assumption chosen below this limit.",
        ...src('noiseBaseline', 'OCHMO-TB-035 Acoustics'),
      },
      {
        bilgi:
          'On the ISS the limit for astronaut noise exposure is 72 dBA averaged over 16 working hours and 62 dBA over 8 hours of sleep. If 50 dBA is exceeded during sleep, the flight surgeon briefs the astronaut on noise-reduction steps.',
        ...src('noiseWorkLimit', 'ISS noise limits'),
      },
      {
        bilgi: 'On the ISS, noise is measured with personal noise dosimeters worn by the astronauts.',
        kaynak: 'NASA NTRS, ISS acoustic monitoring',
        url: 'https://ntrs.nasa.gov/api/citations/20110013006/downloads/20110013006.pdf',
      },
    ],
  },
  {
    konu: 'bone',
    anahtarKelimeler: ['bone', 'osteoporosis', 'fracture', 'bone density', 'muscle loss', 'muscle'],
    bilgiler: [
      { bilgi: 'Bone density is not measured by this system; NASA tracks it with pre- and post-flight bone scans.', ...BONE_SRC },
      {
        bilgi: `According to NASA, weight-bearing bones lose on average 1–1.5% density per month on 4–6 month missions; for Mission Day 180 that is roughly ${boneLossEstimate(180)}. This is a general estimate, not a personal measurement. Whether this rate continues on longer missions is not yet known.`,
        ...BONE_SRC,
      },
    ],
  },
  {
    konu: 'eye',
    anahtarKelimeler: ['eye', 'sans', 'vision', 'optic disc', 'edema'],
    bilgiler: [
      {
        bilgi: 'SANS (spaceflight-associated neuro-ocular syndrome) is currently listed by NASA as a leading health risk of spaceflight.',
        kaynak: 'NASA HRP risks',
        url: 'https://www.nasa.gov/hrp/risks/',
      },
      {
        bilgi: 'On long missions, clear optic disc edema is seen in about 16–19% of astronauts; with eye scans (OCT) the share is about 70%.',
        kaynak: 'JAMA Ophthalmology, NASA One Year Mission case series',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8085766',
      },
      {
        bilgi: "The app's pupil measures are only an indirect, assumption-based indicator for SANS; a definitive assessment requires an eye scan.",
        ...ASSUMPTION,
      },
    ],
  },
  {
    konu: 'gravity',
    anahtarKelimeler: ['gravity', 'weight', 'g-force'],
    bilgiler: [
      {
        bilgi: "Mean surface gravity on Mars is 3.73 m/s², 0.38 of Earth's. The simulation does not model the effect of gravity on the body.",
        kaynak: 'NASA Mars Fact Sheet',
        url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html',
      },
    ],
  },
  {
    konu: 'not measured',
    anahtarKelimeler: ['immune', 'immunity', 'balance', 'vestibular', 'crew cohesion', 'team', 'crew dynamics', 'microbe', 'bacteria', 'not measured', 'scope'],
    bilgiler: [
      {
        bilgi:
          'The immune system is not measured by this system; it requires a blood or saliva test. Blood data from the Inspiration4 mission is open in the NASA OSDR archive.',
        kaynak: 'NASA OSDR, Inspiration4',
        url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11094041/',
      },
      {
        bilgi:
          'Balance (the vestibular system) is not measured by this system. Astronauts returning from long missions take longer to find their standing balance and step less accurately in balance tests.',
        kaynak: 'Frontiers in Physiology 2025, NASA JSC',
        url: 'https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2025.1677377/full',
      },
      {
        bilgi:
          'Crew cohesion is not measured directly; the stress and mood measures (BSI-18, PANAS) give indirect information. NASA notes that team measures from spaceflight have not yet been published.',
        kaynak: 'NASA NTRS, team risk evidence report',
        url: 'https://ntrs.nasa.gov/citations/20220007465',
      },
      {
        bilgi: 'Cabin microbes are not measured by this system. The microbes most often found on ISS surfaces are species associated with human skin.',
        kaynak: 'Microbial Tracking-2, Microbiome',
        url: 'https://www.osti.gov/biblio/1881622',
      },
    ],
  },
  {
    konu: 'method',
    anahtarKelimeler: ['method', 'baseline', 'z-score', 'z score', 'layer', 'how do you decide', 'threshold'],
    bilgiler: [
      {
        bilgi:
          "NASA sources give no universal numeric thresholds for heart rate, blood pressure, SpO₂ or mood; Layer 1 therefore tracks each astronaut's deviation from their personal baseline (z-score): z ≥ 2 caution, z ≥ 3 warning, over at least 3 consecutive samples.",
        kaynak: 'Project method (plan: data and sources)',
      },
      { bilgi: 'Only Layer 1 opens alerts; ASTRA (Layer 2) only reads and explains.', kaynak: 'Project architecture' },
      {
        bilgi:
          'For measures whose official source gives a reference range, no alert is raised while the value is in range: SpO₂ 96–100% (NIH), resting respiration 12–20/min and EtCO₂ 35–45 mmHg (JEMS), EVA heart rate 100–110 bpm (NASA, Apollo), cabin CO₂ up to 2.3 mmHg, ambient 20–25 °C and humidity 30–60% (NASA), noise up to 72 dBA (ISS). Outside the range, deviation from the personal baseline is assessed.',
        kaynak: 'Project method (reference ranges in src/sim/parameters.ts)',
      },
    ],
  },
];
