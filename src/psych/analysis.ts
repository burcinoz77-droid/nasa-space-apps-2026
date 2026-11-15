// Parça 4 · Test planı ve psikolojik durum. ASTRA'nın test önerileri ve analizleri buradaki KURALLARDAN gelir;
// sayıları kod hesaplar, dil modeli sadece açıklar. Kaynağı olmayan eşikler "varsayım" diye işaretlidir.
// Uyarı (olay) AÇMAZ: uyarıyı yalnızca Katman 1 açar. PVT sonucu telemetriye yazıldığı için Katman 1 onu değerlendirir.
import { shortName } from '../ai/labels';
import { CREW_BY_ID } from '../crew';
import { useAstra, type AstraState } from '../store';
import type { CrewId, Level, MetricKey } from '../types';
import { fmt, scoreLevel, worstLevel } from '../ui/theme';
import { LICENSED_NOTE, TEST_INFO, TEST_SOURCES, TLX_ITEMS, type TestKind, type TestSource } from './instruments';
import { spLabel, tlxHighest } from './scoring';
import { activePvt, DAY_TICKS, missionAgo, resultsOf, useTests, type PvtResult, type SpResult, type TestResult, type TlxResult } from './store';

/** ISS'te Reaction Self Test uçuş boyunca 4 günde bir yapıldı (Jones vd. 2022). Rutin plan bu sıklıkta. */
export const ROUTINE_TICKS = 4 * DAY_TICKS;
/** Tetiklenen öneri: son 24 görev saatinde yapılmadıysa (varsayım). */
export const RECENT_TICKS = DAY_TICKS;
/** Jones vd. 2022: 6 saatten kısa uyku, ISS'te daha yavaş tepki, daha çok stres ve iş yüküyle ilişkili. */
export const SHORT_SLEEP_H = 6;
/** Samn-Perelli: 5–6 dikkat, 7 kritik (varsayım; ölçek ifadelerine göre: 5 "orta derecede yorgun", 7 "etkili çalışamıyor"). */
export const SP_CAUTION = 5;
export const SP_CRITICAL = 7;
/** NASA-TLX'in resmi bir "yüksek" eşiği yok. Varsayım: 0–100 ölçeğinin üst yarısı (≥ 50) dikkat. */
export const TLX_CAUTION = 50;

export interface DueTest {
  kind: TestKind;
  oncelik: 'öncelikli' | 'rutin';
  neden: string;
  kaynak?: TestSource;
}

export interface PsychFactor {
  ad: string;
  kisa: string; // cümle içinde: "yorgunluk", "iş yükü" ...
  deger: string;
  seviye: Level;
  not?: string;
  varsayim?: boolean;
}

export interface PsychState {
  seviye: Level;
  ozet: string;
  etkenler: PsychFactor[];
  guncelTest: boolean; // son 4 görev gününde en az bir test var mı
}

const COG_KEYS: MetricKey[] = ['cog.pvtMeanRt_ms', 'cog.pvtLapses', 'cog.bsi18_gsi', 'cog.panasPositive', 'cog.panasNegative', 'cog.speechStrainIndex'];

function lastTick(crewId: CrewId, kind: TestKind, results: TestResult[]): number | undefined {
  return resultsOf(crewId, kind, results)[0]?.tick;
}

/** Katman 1'in bilişsel ölçümlerde sapma görüp görmediği. */
function cogFlag(a: AstraState, crewId: CrewId): boolean {
  const st = a.statuses[crewId];
  if (!st) return false;
  return st.topSignals.some((s) => COG_KEYS.includes(s.key) && s.level !== 'normal') || (scoreLevel(st.domainScores.cog) ?? 'normal') !== 'normal';
}

/** ASTRA'nın bu kişi için önerdiği testler (en önemlisi önce). */
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
        oncelik: 'öncelikli',
        neden: `Slept ${fmt(sleep, 1)} h last night (under 6 h). In ISS data, short sleep was linked to slower reactions and more fatigue.`,
        kaynak: TEST_SOURCES.jones2022,
      });
      continue;
    }
    if (!recent && kind !== 'TLX' && cog) {
      out.push({ kind, oncelik: 'öncelikli', neden: 'Layer 1 sees cognitive metrics deviating from personal baseline; an objective reaction test and a fatigue rating will clarify.' });
      continue;
    }
    if (!recent && kind === 'TLX' && (onSurface || inIncident)) {
      out.push({
        kind,
        oncelik: 'öncelikli',
        neden: onSurface ? 'EVA work on the surface: to measure post-task workload (assumed rule).' : 'There is an open incident: to measure post-incident workload (assumed rule).',
      });
      continue;
    }
    if (last === undefined) {
      out.push({ kind, oncelik: 'rutin', neden: 'Not taken yet: a first measurement is needed for personal comparison.' });
    } else if (since >= ROUTINE_TICKS) {
      out.push({ kind, oncelik: 'rutin', neden: '4 mission days since the last test (on the ISS the Reaction Self Test was done every 4 days).', kaynak: TEST_SOURCES.jones2022 });
    }
  }
  return out.sort((x, y) => (x.oncelik === y.oncelik ? 0 : x.oncelik === 'öncelikli' ? -1 : 1));
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

/** Bir astronotun test sonuçlarına ve Katman 1'in bilişsel alanına göre psikolojik durumu. */
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

/** Ekip karşılaştırması: son 4 görev günündeki en son sonuçlar. */
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
