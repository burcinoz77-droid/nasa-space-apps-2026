// Parça 4 · Test planı ve psikolojik durum. ASTRA'nın test önerileri ve analizleri buradaki KURALLARDAN gelir;
// sayıları kod hesaplar, dil modeli sadece açıklar. Kaynağı olmayan eşikler "varsayım" diye işaretlidir.
// Uyarı (olay) AÇMAZ: uyarıyı yalnızca Katman 1 açar. PVT sonucu telemetriye yazıldığı için Katman 1 onu değerlendirir.
import { shortName } from '../ai/labels';
import { CREW_BY_ID } from '../crew';
import { useAstra, type AstraState } from '../store';
import type { CrewId, Level, MetricKey } from '../types';
import { fmt, scoreLevel, worstLevel } from '../ui/theme';
import { TEST_INFO, TEST_SOURCES, TLX_ITEMS, type TestKind, type TestSource } from './instruments';
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
        neden: `Dün gece uyku ${fmt(sleep, 1)} sa (6 saatten az). ISS verisinde kısa uyku daha yavaş tepki ve daha fazla yorgunlukla ilişkili bulundu.`,
        kaynak: TEST_SOURCES.jones2022,
      });
      continue;
    }
    if (!recent && kind !== 'TLX' && cog) {
      out.push({ kind, oncelik: 'öncelikli', neden: 'Katman 1 bilişsel ölçümlerde kişisel normalden sapma görüyor; nesnel bir tepki testi ve yorgunluk puanı durumu netleştirir.' });
      continue;
    }
    if (!recent && kind === 'TLX' && (onSurface || inIncident)) {
      out.push({
        kind,
        oncelik: 'öncelikli',
        neden: onSurface ? 'Gezegen yüzeyinde EVA çalışması: görev sonrası iş yükünü ölçmek için (varsayım kuralı).' : 'Açık bir olay var: olay sonrası iş yükünü ölçmek için (varsayım kuralı).',
      });
      continue;
    }
    if (last === undefined) {
      out.push({ kind, oncelik: 'rutin', neden: 'Henüz yapılmadı: kişisel karşılaştırma için ilk ölçüm gerekli.' });
    } else if (since >= ROUTINE_TICKS) {
      out.push({ kind, oncelik: 'rutin', neden: 'Son testten bu yana 4 görev günü geçti (ISS\'te Reaction Self Test 4 günde bir yapıldı).', kaynak: TEST_SOURCES.jones2022 });
    }
  }
  return out.sort((x, y) => (x.oncelik === y.oncelik ? 0 : x.oncelik === 'öncelikli' ? -1 : 1));
}

function spFactor(sp: SpResult | undefined, prev: SpResult | undefined, now: number): PsychFactor | undefined {
  if (!sp || now - sp.tick >= ROUTINE_TICKS) return undefined;
  const seviye: Level = sp.puan >= SP_CRITICAL ? 'critical' : sp.puan >= SP_CAUTION ? 'caution' : 'normal';
  const change = prev ? sp.puan - prev.puan : 0;
  return {
    ad: 'Yorgunluk (Samn-Perelli)',
    kisa: 'yorgunluk',
    deger: `${sp.puan}/7 · ${spLabel(sp.puan)}`,
    seviye,
    not: `${missionAgo(sp.tick, now)}${prev ? `; öncekine göre ${change === 0 ? 'aynı' : change > 0 ? `${change} basamak daha yorgun` : `${-change} basamak daha dinç`}` : ''}`,
    varsayim: seviye !== 'normal',
  };
}

function tlxFactor(tlx: TlxResult | undefined, prev: TlxResult | undefined, now: number): PsychFactor | undefined {
  if (!tlx || now - tlx.tick >= ROUTINE_TICKS) return undefined;
  const top = tlxHighest(tlx.ratings);
  const change = prev ? Math.round((tlx.raw - prev.raw) * 10) / 10 : undefined;
  return {
    ad: 'İş yükü (NASA-TLX)',
    kisa: 'iş yükü',
    deger: `${fmt(tlx.raw, 1)}/100 · en yüksek: ${top.ad} ${top.puan}`,
    seviye: tlx.raw >= TLX_CAUTION ? 'caution' : 'normal',
    not: `${missionAgo(tlx.tick, now)}${change !== undefined ? `; öncekine göre ${change === 0 ? 'aynı' : `${change > 0 ? '+' : ''}${fmt(change, 1)} puan`}` : ''}`,
    varsayim: tlx.raw >= TLX_CAUTION,
  };
}

function pvtFactor(a: AstraState, crewId: CrewId, pvt: PvtResult | undefined, now: number): PsychFactor | undefined {
  if (!pvt) return undefined;
  const st = a.statuses[crewId];
  const levels = st?.topSignals.filter((s) => s.key === 'cog.pvtMeanRt_ms' || s.key === 'cog.pvtLapses').map((s) => s.level) ?? [];
  return {
    ad: 'Tepki (PVT-B)',
    kisa: 'tepki hızı',
    deger: `ort. ${pvt.meanRt_ms} ms · ${pvt.lapses} dikkat kaybı · ${pvt.falseStarts} erken basma`,
    seviye: worstLevel(...levels),
    not: `${missionAgo(pvt.tick, now)}; sonuç Katman 1'e gitti, seviyeyi Katman 1 belirler`,
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
      ad: 'Katman 1 bilişsel alan',
      kisa: 'Katman 1 bilişsel alanı',
      deger: `%${Math.round(cogScore)}`,
      seviye: worstLevel(scoreLevel(cogScore), ...(a.statuses[crewId]?.topSignals.filter((s) => COG_KEYS.includes(s.key)).map((s) => s.level) ?? [])),
      not: 'sürekli izlenen ölçümler (PVT, ruh hali ve stres skorları, konuşma)',
    });
  }
  const seviye = worstLevel(...etkenler.map((f) => f.seviye));
  const name = shortName(crewId);
  const bad = etkenler.filter((f) => f.seviye !== 'normal').map((f) => f.kisa);
  const ozet = !guncelTest
    ? `${name} için son 4 görev gününde test yok; durum yalnızca Katman 1'in sürekli ölçümlerine dayanıyor.`
    : bad.length
      ? `${name}: ${bad.length > 1 ? `${bad.slice(0, -1).join(', ')} ve ${bad[bad.length - 1]}` : bad[0]} izlenmeli.`
      : `${name}: test sonuçları ve bilişsel ölçümler olağan aralıkta.`;
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
