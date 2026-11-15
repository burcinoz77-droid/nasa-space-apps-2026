// Parça 2 · Katman 1: anomali tespiti, erken uyarı, otonom güvenli adımlar, olay kaydı.
// Gemide internetsiz çalışır. Uyarıyı SADECE bu katman açar; Katman 2 (yapay zekâ) açamaz.
//
// Her ölçümde (process):
//  1. Kişisel baseline: her astronot × her ölçüm için ilk 30 ölçümün ortalaması ve sd'si (Welford), sonra dondurulur.
//  2. Yönlü z-skoru: z = (değer − ortalama) / max(sd, taban); riskli yön metrics.ts'teki badWhen.
//     NASA'nın kesin sınırı olan ölçümlerde (ppCO₂, toplam doz, SpO₂, çekirdek sıcaklık) mutlak eşik önce gelir.
//  3. Seviye ancak 3 ardışık ölçüm aynı yönde kalırsa değişir: tek sıçrama alarm vermez.
//  4. Sağlık skoru: alan skoru = 100 − 12 × Σ max(0, riskZ − 1); healthScore = 5 alanın ortalaması.
//  5. Olay kuralları (rules.ts): aynı kişi/yer + aynı tür için tek açık olay; seviye yükselirse olay yükselir.
//  6. Otonom adım (sadece 3 tür) olay başına en fazla bir kez; newActions → loop.ts → simülasyon.
//  7. Bütün sinyaller 10 ölçüm normal kalırsa olay "çözüldü". Hepsi olay kaydına (ledger) düşer.
import { CREW, CREW_BY_ID, CREW_IDS } from '../crew';
import { METRICS, readMetric, type MetricKey } from '../metrics';
import type {
  AutoAction,
  CrewId,
  CrewLocation,
  CrewStatus,
  Detector,
  DetectorOutput,
  Domain,
  Incident,
  Level,
  LedgerEntry,
  MetricScore,
  ShipState,
  Telemetry,
} from '../types';
import { normalRangeFor } from '../sim/parameters';
import { MetricTracker } from './baseline';
import { BASELINE_MIN_WINDOW, BASELINE_WINDOW, LEVEL_RANK, RESOLVE_AFTER, SCORE_WEIGHT, Z_EXCLUDED } from './config';
import { ACTION_LABELS, names } from './labels';
import { type CrewEval, type Rule, type RuleHit, RULES } from './rules';

export { ACTION_LABELS, DOMAIN_LABELS, INCIDENT_LABELS } from './labels';

const DOMAINS: Domain[] = ['cardio', 'resp', 'biochem', 'cog', 'env'];
const KEYS = METRICS.map((m) => m.key);
const Z_KEYS = KEYS.filter((k) => !Z_EXCLUDED.has(k));
const domainOf = (key: MetricKey) => key.split('.')[0] as Domain;
const maxLevel = (a: Level, b: Level): Level => (LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const MAX_INCIDENTS = 200;

interface CrewTrack {
  id: CrewId;
  location: CrewLocation;
  trackers: Record<MetricKey, MetricTracker>;
  irregularStreak: number;
  lastLevel: Partial<Record<MetricKey, Level>>; // son verilen seviye (normal aralık kuralı için)
  n: number;
  frozen: boolean; // baseline donduruldu mu
}

interface OpenIncident {
  inc: Incident;
  rule: Rule;
  location: CrewLocation;
  clearStreak: number; // tüm sinyaller kaç ölçümdür normal
}

function newTrack(id: CrewId): CrewTrack {
  const trackers = {} as Record<MetricKey, MetricTracker>;
  for (const k of KEYS) trackers[k] = new MetricTracker(k);
  return { id, location: CREW_BY_ID[id].location, trackers, irregularStreak: 0, lastLevel: {}, n: 0, frozen: false };
}

function freezeTrack(track: CrewTrack) {
  for (const k of KEYS) track.trackers[k].freeze();
  track.frozen = true;
}

/** Bir astronotun ölçümünü işler, kuralların girdisini (CrewEval) üretir. */
function evaluate(track: CrewTrack, t: Telemetry): CrewEval {
  track.n++;
  const scores = {} as Record<MetricKey, MetricScore>;
  const riskZ = {} as Record<MetricKey, number>;
  const domainLevels: Record<Domain, Level> = { cardio: 'normal', resp: 'normal', biochem: 'normal', cog: 'normal', env: 'normal' };
  for (const k of KEYS) {
    const tr = track.trackers[k];
    const value = readMetric(t, k);
    const s = tr.push(value);
    // Resmi kaynağın normal aralığındaki değer yeni bir uyarı başlatmaz (z ekranda kalır).
    // Uyarı zaten açıksa seviye, Katman 1'in histerezisiyle iner; aralık içinde asla yükselmez.
    const range = normalRangeFor(k, track.location);
    const inRange = range !== undefined && value >= range[0] && value <= range[1];
    const prev = track.lastLevel[k] ?? 'normal';
    const level: Level = inRange ? (prev === 'normal' ? 'normal' : LEVEL_RANK[s.level] <= LEVEL_RANK[prev] ? s.level : prev) : s.level;
    track.lastLevel[k] = level;
    scores[k] = level === s.level ? s : { ...s, level };
    riskZ[k] = inRange && level === 'normal' ? 0 : tr.riskZ;
    const d = domainOf(k);
    domainLevels[d] = maxLevel(domainLevels[d], s.level);
  }
  track.irregularStreak = t.cardio.ecg_rhythm === 'irregular' ? track.irregularStreak + 1 : 0;
  if (track.n >= BASELINE_WINDOW) track.frozen = true;
  return {
    id: track.id,
    location: track.location,
    calibrated: track.frozen,
    scores,
    riskZ,
    domainLevels,
    irregularStreak: track.irregularStreak,
  };
}

/** Sağlık skoru: alan skoru = 100 − 12 × Σ max(0, riskZ − 1), 0–100; healthScore = 5 alanın ortalaması. */
export function scoreDomains(riskZ: Record<MetricKey, number>): { domainScores: Record<Domain, number>; healthScore: number } {
  const sum: Record<Domain, number> = { cardio: 0, resp: 0, biochem: 0, cog: 0, env: 0 };
  for (const k of Z_KEYS) sum[domainOf(k)] += Math.max(0, (riskZ[k] ?? 0) - 1);
  const domainScores = {} as Record<Domain, number>;
  for (const d of DOMAINS) domainScores[d] = Math.round(clamp(100 - SCORE_WEIGHT * sum[d], 0, 100));
  const healthScore = Math.round(DOMAINS.reduce((a, d) => a + domainScores[d], 0) / DOMAINS.length);
  return { domainScores, healthScore };
}

export function createDetector(): Detector {
  let epoch = '';
  let seq = 0;
  let ticks = 0;
  let baselineAnnounced = false;
  let tracks = {} as Record<CrewId, CrewTrack>;
  let evals: Partial<Record<CrewId, CrewEval>> = {};
  let statuses = {} as Record<CrewId, CrewStatus>;
  let incidents: Incident[] = []; // en yeni başta
  let open = new Map<string, OpenIncident>(); // "CO2:KOKPIT" / "FATIGUE:elif" -> açık olay
  let restBy = new Map<CrewId, string>(); // zorunlu dinlenme verilen kişi -> olay id

  function init() {
    epoch = Date.now().toString(36);
    seq = 0;
    ticks = 0;
    baselineAnnounced = false;
    tracks = Object.fromEntries(CREW_IDS.map((id) => [id, newTrack(id)])) as Record<CrewId, CrewTrack>;
    evals = {};
    statuses = {} as Record<CrewId, CrewStatus>;
    incidents = [];
    open = new Map();
    restBy = new Map();
  }
  init();

  const nextId = (prefix: string) => `${prefix}-${epoch}-${++seq}`;

  function entry(at: number, kind: LedgerEntry['kind'], text: string, extra: Partial<LedgerEntry> = {}): LedgerEntry {
    return { id: nextId('L'), at, kind, text, ...extra };
  }

  /** Bir kuralın bu ölçümdeki bulgularını gruplar: yer kapsamlı kurallar Kokpit/Gezegen başına, diğerleri kişi başına. */
  function groupHits(rule: Rule) {
    const groups = new Map<string, { location: CrewLocation; members: { id: CrewId; hit: RuleHit }[] }>();
    for (const id of CREW_IDS) {
      const e = evals[id];
      if (!e) continue;
      const hit = rule.evaluate(e);
      if (!hit) continue;
      const key = rule.scope === 'location' ? `${rule.type}:${e.location}` : `${rule.type}:${id}`;
      const g = groups.get(key) ?? { location: e.location, members: [] };
      g.members.push({ id, hit });
      groups.set(key, g);
    }
    return groups;
  }

  const worstOf = (members: { id: CrewId; hit: RuleHit }[]) =>
    [...members].sort((a, b) => LEVEL_RANK[b.hit.level] - LEVEL_RANK[a.hit.level] || b.hit.severity - a.hit.severity)[0];

  function runRules(at: number, ledger: LedgerEntry[], actions: AutoAction[]) {
    for (const rule of RULES) {
      // 1) Olay aç / güncelle / yükselt
      for (const [key, g] of groupHits(rule)) {
        const worst = worstOf(g.members);
        const level = worst.hit.level;
        const memberIds = CREW_IDS.filter((id) => g.members.some((m) => m.id === id));
        let o = open.get(key);
        if (!o) {
          const inc: Incident = {
            id: nextId('inc'),
            type: rule.type,
            level,
            crewIds: memberIds,
            openedAt: at,
            title: rule.title(memberIds, worst.hit, g.location),
            signals: worst.hit.signals,
            autoActions: [],
            status: 'open',
          };
          o = { inc, rule, location: g.location, clearStreak: 0 };
          open.set(key, o);
          incidents.unshift(inc);
          ledger.push(entry(at, 'INCIDENT_OPENED', inc.title, { incidentId: inc.id, crewIds: [...memberIds] }));
        } else {
          const inc = o.inc;
          const joined = memberIds.filter((id) => !inc.crewIds.includes(id));
          if (joined.length) {
            inc.crewIds = CREW_IDS.filter((id) => inc.crewIds.includes(id) || joined.includes(id));
            ledger.push(entry(at, 'SYSTEM', `Olaya eklendi (${names(joined)}): ${inc.title}`, { incidentId: inc.id, crewIds: joined }));
          }
          if (LEVEL_RANK[level] > LEVEL_RANK[inc.level]) {
            inc.level = level;
            inc.title = rule.title(inc.crewIds, worst.hit, g.location);
            inc.status = 'open'; // onaylanmış olay kritikleşirse yeniden onay ister
            ledger.push(entry(at, 'SYSTEM', `Olay kritik seviyeye yükseldi: ${inc.title}`, { incidentId: inc.id, crewIds: [...inc.crewIds] }));
          }
          inc.signals = worst.hit.signals; // olay açıkken sinyaller canlı güncellenir
        }

        // 2) Otonom güvenli adım: olay başına en fazla bir kez
        const inc = o.inc;
        const actionable = g.members.filter((m) => m.hit.actionable);
        if (rule.action && actionable.length && !inc.autoActions.includes(rule.action)) {
          const w = worstOf(actionable);
          const crewIds =
            rule.scope === 'location' ? CREW.filter((c) => c.location === g.location).map((c) => c.id) : actionable.map((m) => m.id);
          const action: AutoAction = { type: rule.action, crewIds, at, reason: rule.reason(memberIds, w.hit, g.location), incidentId: inc.id };
          inc.autoActions = [...inc.autoActions, rule.action];
          actions.push(action);
          ledger.push(entry(at, 'AUTO_ACTION', `${ACTION_LABELS[rule.action]} · otomatik — ${action.reason}`, { incidentId: inc.id, crewIds }));
          if (rule.action === 'MANDATORY_REST') for (const id of crewIds) restBy.set(id, inc.id);
        }
      }

      // 3) Çözülme: olayın bütün sinyalleri RESOLVE_AFTER ölçüm boyunca normal
      for (const [key, o] of open) {
        if (o.rule !== rule) continue;
        const clear = o.inc.crewIds.every((id) => {
          const e = evals[id];
          return e ? rule.isClear(e) : true;
        });
        o.clearStreak = clear ? o.clearStreak + 1 : 0;
        if (o.clearStreak < RESOLVE_AFTER) continue;
        o.inc.status = 'resolved';
        open.delete(key);
        ledger.push(
          entry(at, 'INCIDENT_RESOLVED', `Çözüldü: ${o.inc.title} — sinyaller ${RESOLVE_AFTER} ölçümdür normal`, {
            incidentId: o.inc.id,
            crewIds: [...o.inc.crewIds],
          }),
        );
        for (const id of o.inc.crewIds) if (restBy.get(id) === o.inc.id) restBy.delete(id);
      }
    }
  }

  function buildStatus(id: CrewId): CrewStatus {
    const e = evals[id];
    if (!e) {
      return (
        statuses[id] ?? {
          crewId: id,
          level: 'normal',
          healthScore: 0,
          domainScores: { cardio: 0, resp: 0, biochem: 0, cog: 0, env: 0 },
          topSignals: [],
          restRequired: false,
        }
      );
    }
    const { domainScores, healthScore } = scoreDomains(e.riskZ);
    let level: Level = 'normal';
    for (const k of KEYS) level = maxLevel(level, e.scores[k].level);
    // Açık olay kişinin seviyesini taşır; sinyalleri normale döndüyse (çözülme sayacı işliyor) artık taşımaz
    for (const o of open.values()) if (o.inc.crewIds.includes(id) && !o.rule.isClear(e)) level = maxLevel(level, o.inc.level);
    const topSignals = KEYS.map((k) => e.scores[k])
      .filter((s) => !Z_EXCLUDED.has(s.key) || s.level !== 'normal')
      .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || e.riskZ[b.key] - e.riskZ[a.key])
      .slice(0, 3);
    return { crewId: id, level, healthScore, domainScores, topSignals, restRequired: restBy.has(id) };
  }

  /** Store'a giden kopya: React seçicileri değişikliği görsün, içerideki durum dışarıdan bozulmasın. */
  const snapshot = (inc: Incident): Incident => ({ ...inc, crewIds: [...inc.crewIds], signals: [...inc.signals], autoActions: [...inc.autoActions] });

  return {
    process(ship: ShipState, telemetry: Telemetry[]): DetectorOutput {
      const at = ship.t;
      const ledger: LedgerEntry[] = [];
      const actions: AutoAction[] = [];

      if (ticks === 0) {
        ledger.push(
          entry(
            at,
            'SYSTEM',
            `Katman 1 devrede: kişisel baseline için ilk ${BASELINE_WINDOW} ölçüm toplanıyor. Bu sürede sadece mutlak eşikler (CO₂, SpO₂, sıcaklık, toplam doz) izleniyor.`,
          ),
        );
      }
      ticks++;

      // Senaryo kalibrasyon bitmeden başladıysa: baseline'ı anomaliyle kirletmeden erken dondur
      if (ship.scenario !== 'NORMAL' && !baselineAnnounced) {
        const early = CREW_IDS.filter((id) => !tracks[id].frozen && tracks[id].n >= BASELINE_MIN_WINDOW);
        for (const id of early) freezeTrack(tracks[id]);
        if (early.length) {
          ledger.push(
            entry(at, 'SYSTEM', `Senaryo kalibrasyon bitmeden başladı: ${early.length === CREW_IDS.length ? 'tüm mürettebatın' : `${names(early)} için`} baseline'ı ${tracks[early[0]].n} ölçümle erken donduruldu.`, {
              crewIds: early,
            }),
          );
        }
      }

      for (const t of telemetry) {
        const track = tracks[t.crewId];
        if (track) evals[t.crewId] = evaluate(track, t);
      }

      if (!baselineAnnounced && CREW_IDS.every((id) => tracks[id].frozen)) {
        baselineAnnounced = true;
        ledger.push(
          entry(at, 'SYSTEM', `Kişisel baseline'lar kuruldu ve donduruldu: ${CREW_IDS.length} astronot × ${Z_KEYS.length} ölçüm. Z-skoru ve erken uyarı devrede.`),
        );
      }

      runRules(at, ledger, actions);

      for (const id of CREW_IDS) statuses[id] = buildStatus(id);
      if (incidents.length > MAX_INCIDENTS) incidents = incidents.filter((i, n) => n < MAX_INCIDENTS || i.status !== 'resolved');

      return {
        statuses: { ...statuses },
        incidents: incidents.map(snapshot),
        newLedger: ledger,
        newActions: actions,
      };
    },

    acknowledge(incidentId: string): LedgerEntry | null {
      const inc = incidents.find((i) => i.id === incidentId);
      if (!inc || inc.status !== 'open') return null;
      inc.status = 'acknowledged';
      return entry(Date.now(), 'ACK', `Mürettebat onayladı: ${inc.title}`, { incidentId, crewIds: [...inc.crewIds] });
    },

    reset() {
      init();
    },
  };
}
