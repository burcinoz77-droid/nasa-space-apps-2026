// Part 4 · Test plan and psychological state. ASTRA's test recommendations and analyses come from the RULES here;
// code computes the numbers, the language model only explains them. Thresholds without a source are marked "assumption".
// Does NOT raise alerts (incidents): only Layer 1 raises alerts. The PVT result is written to telemetry, so Layer 1 evaluates it.
import { shortName } from '../ai/labels';
import { CREW_BY_ID } from '../crew';
import { useAstra, type AstraState } from '../store';
import type { CrewId, Level, MetricKey } from '../types';
import { fmt, scoreLevel, worstLevel } from '../ui/theme';
import { LICENSED_NOTE, TEST_INFO, TEST_SOURCES, TLX_ITEMS, type TestKind, type TestSource } from './instruments';
import { spLabel, tlxHighest } from './scoring';
import { activePvt, DAY_TICKS, missionAgo, resultsOf, useTests, type PvtResult, type SpResult, type TestResult, type TlxResult } from './store';

/** On the ISS the Reaction Self Test was done every 4 days throughout the flight (Jones et al. 2022). The routine plan uses this frequency. */
export const ROUTINE_TICKS = 4 * DAY_TICKS;
/** Triggered recommendation: if not done in the last 24 mission hours (assumption). */
export const RECENT_TICKS = DAY_TICKS;
/** Jones et al. 2022: sleep shorter than 6 hours is associated with slower reactions, more stress and higher workload on the ISS. */
export const SHORT_SLEEP_H = 6;
/** Samn-Perelli: 5–6 caution, 7 warning (assumption; based on the scale wording: 5 "moderately tired", 7 "unable to function effectively"). */
export const SP_CAUTION = 5;
export const SP_CRITICAL = 7;
/** NASA-TLX has no official "high" threshold. Assumption: the upper half of the 0–100 scale (≥ 50) is caution. */
export const TLX_CAUTION = 50;

export interface DueTest {
  kind: TestKind;
  oncelik: 'priority' | 'routine';
  neden: string;
  kaynak?: TestSource;
}

export interface PsychFactor {
  ad: string;
  kisa: string; // within a sentence: "fatigue", "workload" ...
  deger: string;
  seviye: Level;
  not?: string;
  varsayim?: boolean;
}

export interface PsychState {
  seviye: Level;
  ozet: string;
  etkenler: PsychFactor[];
  guncelTest: boolean; // is there at least one test in the last 4 mission days
}

const COG_KEYS: MetricKey[] = ['cog.pvtMeanRt_ms', 'cog.pvtLapses', 'cog.bsi18_gsi', 'cog.panasPositive', 'cog.panasNegative', 'cog.speechStrainIndex'];

function lastTick(crewId: CrewId, kind: TestKind, results: TestResult[]): number | undefined {
  return resultsOf(crewId, kind, results)[0]?.tick;
}

/** Whether Layer 1 sees a deviation in the cognitive metrics. */
function cogFlag(a: AstraState, crewId: CrewId): boolean {
  const st = a.statuses[crewId];
  if (!st) return false;
  return st.topSignals.some((s) => COG_KEYS.includes(s.key) && s.level !== 'normal') || (scoreLevel(st.domainScores.cog) ?? 'normal') !== 'normal';
}

/** Tests ASTRA recommends for this person (most important first). */
export function dueTests(crewId: CrewId, a: AstraState = useAstra.getState(), ts = useTests.getState()): DueTest[] {
  const out: DueTest[] = [];
  const t = a.telemetry[crewId];
  const sleep = t?.env.sleepLastNight_h;
  const shortSleep = sleep !== undefined && sleep < SHORT_SLEEP_H;
  const cog = cogFlag(a, crewId);
  const onSurface = CREW_BY_ID[crewId].location === 'GEZEGEN';
  const inIncident = a.incidents.some((i) => i.status !== 'resolved' && i.crewIds.includes(crewId));

  for (const kind of ['SP', 'PVT', 'TLX'] as TestKind[]) {
    const last = lastTick(crewId, kind, ts.results);
    const since = last === undefined ? Infinity : ts.tick - last;
    const recent = since < RECENT_TICKS;
    if (!recent && kind !== 'TLX' && shortSleep) {
      out.push({
        kind,
        oncelik: 'priority',
        neden: `Slept ${fmt(sleep, 1)} h last night (under 6 h). In ISS data, short sleep was linked to slower reactions and more fatigue.`,
        kaynak: TEST_SOURCES.jones2022,
      });
      continue;
    }
    if (!recent && kind !== 'TLX' && cog) {
      out.push({ kind, oncelik: 'priority', neden: 'Layer 1 sees cognitive metrics deviating from personal baseline; an objective reaction test and a fatigue rating will clarify.' });
      continue;
    }
    if (!recent && kind === 'TLX' && (onSurface || inIncident)) {
      out.push({
        kind,
        oncelik: 'priority',
        neden: onSurface ? 'EVA work on the surface: to measure post-task workload (assumed rule).' : 'There is an open incident: to measure post-incident workload (assumed rule).',
      });
      continue;
    }
    if (last === undefined) {
      out.push({ kind, oncelik: 'routine', neden: 'Not taken yet: a first measurement is needed for personal comparison.' });
    } else if (since >= ROUTINE_TICKS) {
      out.push({ kind, oncelik: 'routine', neden: '4 mission days since the last test (on the ISS the Reaction Self Test was done every 4 days).', kaynak: TEST_SOURCES.jones2022 });
    }
  }
  return out.sort((x, y) => (x.oncelik === y.oncelik ? 0 : x.oncelik === 'priority' ? -1 : 1));
}

function spFactor(sp: SpResult | undefined, prev: SpResult | undefined, now: number): PsychFactor | undefined {
  if (!sp || now - sp.tick >= ROUTINE_TICKS) return undefined;
  const seviye: Level = sp.puan >= SP_CRITICAL ? 'critical' : sp.puan >= SP_CAUTION ? 'caution' : 'normal';
  const change = prev ? sp.puan - prev.puan : 0;
  return {
    ad: 'Fatigue (Samn-Perelli)',
    kisa: 'fatigue',
    deger: `${sp.puan}/7 · ${spLabel(sp.puan)}`,
    seviye,
    not: `${missionAgo(sp.tick, now)}${prev ? `; vs previous: ${change === 0 ? 'same' : change > 0 ? `${change} step(s) more tired` : `${-change} step(s) fresher`}` : ''}`,
    varsayim: seviye !== 'normal',
  };
}

function tlxFactor(tlx: TlxResult | undefined, prev: TlxResult | undefined, now: number): PsychFactor | undefined {
  if (!tlx || now - tlx.tick >= ROUTINE_TICKS) return undefined;
  const top = tlxHighest(tlx.ratings);
  const change = prev ? Math.round((tlx.raw - prev.raw) * 10) / 10 : undefined;
  return {
    ad: 'Workload (NASA-TLX)',
    kisa: 'workload',
    deger: `${fmt(tlx.raw, 1)}/100 · highest: ${top.ad} ${top.puan}`,
    seviye: tlx.raw >= TLX_CAUTION ? 'caution' : 'normal',
    not: `${missionAgo(tlx.tick, now)}${change !== undefined ? `; vs previous: ${change === 0 ? 'same' : `${change > 0 ? '+' : ''}${fmt(change, 1)} points`}` : ''}`,
    varsayim: tlx.raw >= TLX_CAUTION,
  };
}

function pvtFactor(a: AstraState, crewId: CrewId, pvt: PvtResult | undefined, now: number): PsychFactor | undefined {
  if (!pvt) return undefined;
  const st = a.statuses[crewId];
  const levels = st?.topSignals.filter((s) => s.key === 'cog.pvtMeanRt_ms' || s.key === 'cog.pvtLapses').map((s) => s.level) ?? [];
  return {
    ad: 'Reaction (PVT-B)',
    kisa: 'reaction speed',
    deger: `mean ${pvt.meanRt_ms} ms · ${pvt.lapses} lapses · ${pvt.falseStarts} false starts`,
    seviye: worstLevel(...levels),
    not: `${missionAgo(pvt.tick, now)}; result sent to Layer 1, which sets the level`,
  };
}

/** An astronaut's psychological state from their test results and Layer 1's cognitive domain. */
export function psychState(crewId: CrewId, a: AstraState = useAstra.getState(), ts = useTests.getState()): PsychState {
  const now = ts.tick;
  const [sp, spPrev] = resultsOf(crewId, 'SP', ts.results);
  const [tlx, tlxPrev] = resultsOf(crewId, 'TLX', ts.results);
  const etkenler = [spFactor(sp, spPrev, now), tlxFactor(tlx, tlxPrev, now), pvtFactor(a, crewId, activePvt(crewId, ts), now)].filter(
    (f): f is PsychFactor => !!f,
  );
  const guncelTest = etkenler.length > 0;
  const cogScore = a.statuses[crewId]?.domainScores.cog;
  if (cogScore !== undefined) {
    etkenler.push({
      ad: 'Layer 1 cognitive domain',
      kisa: 'Layer 1 cognitive domain',
      deger: `${Math.round(cogScore)}%`,
      seviye: worstLevel(scoreLevel(cogScore), ...(a.statuses[crewId]?.topSignals.filter((s) => COG_KEYS.includes(s.key)).map((s) => s.level) ?? [])),
      not: `continuously monitored metrics (PVT, mood and stress scores, speech). ${LICENSED_NOTE}`,
    });
  }
  const seviye = worstLevel(...etkenler.map((f) => f.seviye));
  const name = shortName(crewId);
  const bad = etkenler.filter((f) => f.seviye !== 'normal').map((f) => f.kisa);
  const ozet = !guncelTest
    ? `No tests for ${name} in the last 4 mission days; the state relies only on Layer 1's continuous metrics.`
    : bad.length
      ? `${name}: ${bad.length > 1 ? `${bad.slice(0, -1).join(', ')} and ${bad[bad.length - 1]}` : bad[0]} should be watched.`
      : `${name}: test results and cognitive metrics are in the usual range.`;
  return { seviye, ozet, etkenler, guncelTest };
}

/** Crew comparison: the latest results in the last 4 mission days. */
export function crewComparison(ids: CrewId[], ts = useTests.getState()) {
  const fresh = <T extends TestResult>(r: T | undefined) => (r && ts.tick - r.tick < ROUTINE_TICKS ? r : undefined);
  const rows = ids.map((id) => ({
    id,
    sp: fresh(resultsOf(id, 'SP', ts.results)[0]),
    tlx: fresh(resultsOf(id, 'TLX', ts.results)[0]),
    pvt: fresh(resultsOf(id, 'PVT', ts.results)[0]),
  }));
  return {
    yorgunluk: rows.filter((r) => r.sp).sort((x, y) => y.sp!.puan - x.sp!.puan).map((r) => ({ id: r.id, puan: r.sp!.puan })),
    isYuku: rows.filter((r) => r.tlx).sort((x, y) => y.tlx!.raw - x.tlx!.raw).map((r) => ({ id: r.id, puan: r.tlx!.raw })),
    tepki: rows.filter((r) => r.pvt).sort((x, y) => y.pvt!.meanRt_ms - x.pvt!.meanRt_ms).map((r) => ({ id: r.id, ortalama_ms: r.pvt!.meanRt_ms, dikkatKaybi: r.pvt!.lapses })),
    testYapmayanlar: rows.filter((r) => !r.sp && !r.tlx && !r.pvt).map((r) => r.id),
  };
}

export const TLX_NAMES = Object.fromEntries(TLX_ITEMS.map((i) => [i.key, i.ad]));
export { TEST_INFO };
