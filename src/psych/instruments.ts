// Part 4 · Psychological tests: three free scales that need no permission, used by NASA and in aviation fatigue
// studies. The AI does NOT write or change the questions: the official items below are used verbatim.
// The items are the official English originals.
//
// Not used, and why:
//   PANAS  -> APA copyright (not used, by team decision)
//   BSI-18 -> commercial scale (Pearson), its items cannot be used
//   NASA Cognition battery -> licensed

export interface TestSource {
  ad: string;
  url: string;
}

export const TEST_SOURCES = {
  tlx: { ad: 'NASA Ames, NASA-TLX', url: 'https://humansystems.arc.nasa.gov/groups/tlx/' },
  hart2006: { ad: 'Hart 2006, NASA-TLX 20 years later (NASA Ames)', url: 'https://humansystems.arc.nasa.gov/publications/HFES_2006_Paper.pdf' },
  basner2011: { ad: 'Basner et al. 2011, PVT-B (Acta Astronautica)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3197786' },
  jones2022: { ad: 'Jones et al. 2022, ISS Reaction Self Test', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8919197' },
  spinoff2013: { ad: 'NASA Spinoff 2013, ISS Reaction Self-Test', url: 'https://spinoff.nasa.gov/Spinoff2013/hm_1.html' },
  samnPerelli: { ad: 'Samn & Perelli 1982 (US Air Force), scale items', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9286802' },
  nasaFatigue: { ad: 'NASA/TM-2012-216053, NASA–easyJet fatigue study (Samn-Perelli + PVT)', url: 'https://ntrs.nasa.gov/citations/20130001718' },
} satisfies Record<string, TestSource>;

export type TestKind = 'SP' | 'TLX' | 'PVT';

export const TEST_INFO: Record<TestKind, { ad: string; kisa: string; sure: string; olcer: string; kaynaklar: TestSource[] }> = {
  SP: {
    ad: 'Samn-Perelli fatigue scale',
    kisa: 'Fatigue',
    sure: '10 s',
    olcer: 'Current fatigue (self-report), 1–7',
    kaynaklar: [TEST_SOURCES.samnPerelli, TEST_SOURCES.nasaFatigue],
  },
  TLX: {
    ad: 'NASA-TLX workload scale',
    kisa: 'Workload',
    sure: '1 min',
    olcer: 'Perceived workload of the last task (self-report), 0–100',
    kaynaklar: [TEST_SOURCES.tlx, TEST_SOURCES.hart2006],
  },
  PVT: {
    ad: 'PVT-B reaction test',
    kisa: 'Reaction (PVT)',
    sure: '3 min',
    olcer: 'Attention and reaction speed (objective measure)',
    kaynaklar: [TEST_SOURCES.basner2011, TEST_SOURCES.spinoff2013],
  },
};

// ---------------------------------------------------------------- Simulated scores of licensed scales
// The PANAS and BSI-18 scores in the simulation (Part 1) are not real measurements; their items are not used, only the score is simulated.
// Both scales are licensed; a real system needs a license to collect these scores. ASTRA and the Tests tab say so.
export const LICENSED_SIM_KEYS: readonly string[] = ['cog.panasPositive', 'cog.panasNegative', 'cog.bsi18_gsi'];
export const LICENSED_NOTE = 'PANAS and BSI-18 scores are simulated; a real system needs licensed scales.';
export const LICENSED_NOTE_LONG = `${LICENSED_NOTE.slice(0, -1)} (PANAS: APA copyright, BSI-18: Pearson commercial scale).`;

// ---------------------------------------------------------------- Samn-Perelli (7 steps)
// Items: Samn & Perelli 1982. The end-point wording is in PMC9286802; all steps appear verbatim in aviation studies.
export const SP_LEVELS: { puan: number; tr: string; en: string }[] = [
  { puan: 1, tr: 'Fully alert, wide awake', en: 'Fully alert, wide awake' },
  { puan: 2, tr: 'Very lively, responsive, but not at peak', en: 'Very lively, responsive, but not at peak' },
  { puan: 3, tr: 'Okay, somewhat fresh', en: 'Okay, somewhat fresh' },
  { puan: 4, tr: 'A little tired, less than fresh', en: 'A little tired, less than fresh' },
  { puan: 5, tr: 'Moderately tired, let down', en: 'Moderately tired, let down' },
  { puan: 6, tr: 'Extremely tired, very difficult to concentrate', en: 'Extremely tired, very difficult to concentrate' },
  { puan: 7, tr: 'Completely exhausted, unable to function effectively', en: 'Completely exhausted, unable to function effectively' },
];
export const SP_PROMPT = 'Choose the statement that best describes how you feel right now.';

// ---------------------------------------------------------------- NASA-TLX (6 subscales)
// Items: NASA Ames TLX paper-and-pencil form (Hart & Staveland 1988). Each subscale 0–100 in steps of 5 (21 tick marks).
// On the Performance subscale 0 = perfect, 100 = failure; so on all subscales a higher score = higher load.
export type TlxKey = 'zihinsel' | 'fiziksel' | 'zamansal' | 'performans' | 'efor' | 'engellenme';

export const TLX_ITEMS: { key: TlxKey; ad: string; en: string; soru: string; soruEn: string; alt: string; ust: string }[] = [
  { key: 'zihinsel', ad: 'Mental Demand', en: 'Mental Demand', soru: 'How mentally demanding was the task?', soruEn: 'How mentally demanding was the task?', alt: 'Very low', ust: 'Very high' },
  { key: 'fiziksel', ad: 'Physical Demand', en: 'Physical Demand', soru: 'How physically demanding was the task?', soruEn: 'How physically demanding was the task?', alt: 'Very low', ust: 'Very high' },
  { key: 'zamansal', ad: 'Temporal Demand', en: 'Temporal Demand', soru: 'How hurried or rushed was the pace of the task?', soruEn: 'How hurried or rushed was the pace of the task?', alt: 'Very low', ust: 'Very high' },
  {
    key: 'performans',
    ad: 'Performance',
    en: 'Performance',
    soru: 'How successful were you in accomplishing what you were asked to do?',
    soruEn: 'How successful were you in accomplishing what you were asked to do?',
    alt: 'Perfect',
    ust: 'Failure',
  },
  {
    key: 'efor',
    ad: 'Effort',
    en: 'Effort',
    soru: 'How hard did you have to work to accomplish your level of performance?',
    soruEn: 'How hard did you have to work to accomplish your level of performance?',
    alt: 'Very low',
    ust: 'Very high',
  },
  {
    key: 'engellenme',
    ad: 'Frustration',
    en: 'Frustration',
    soru: 'How insecure, discouraged, irritated, stressed, and annoyed were you?',
    soruEn: 'How insecure, discouraged, irritated, stressed, and annoyed were you?',
    alt: 'Very low',
    ust: 'Very high',
  },
];
export const TLX_STEP = 5;
export const TLX_PROMPT = 'Think about the task you just finished and mark each scale.';

// ---------------------------------------------------------------- PVT-B (Basner et al. 2011)
export const PVT = {
  durationS: 180, // 3 minutes
  demoDurationS: 30, // short trial: the result does NOT go to Layer 1 (not a valid PVT-B)
  minDelayMs: 1000, // 1–4 s between stimuli (including the 1 s reaction display)
  maxDelayMs: 4000,
  feedbackMs: 1000,
  lapseMs: 355, // PVT-B lapse threshold (500 ms in the standard 10-min PVT)
  falseStartMs: 100, // a reaction shorter than 100 ms or a press before the stimulus = false start
  timeoutMs: 30_000, // no reaction for 30 s counts as a lapse
} as const;
