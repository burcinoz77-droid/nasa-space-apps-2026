// Part 2 · Layer 1: anomaly detection, early warning, autonomous safe actions, incident log.
// Runs onboard without internet. ONLY this layer raises alerts; Layer 2 (AI) cannot.
//
// On every reading (process):
//  1. Personal baseline: mean and SD of the first 30 readings for each astronaut × metric (Welford), then frozen.
//  2. Directional z-score: z = (value − mean) / max(sd, floor); the risky direction is badWhen in metrics.ts.
//     For metrics with a firm NASA limit (ppCO₂, total dose, SpO₂, core temperature) the absolute threshold takes precedence.
//  3. The level only changes if 3 consecutive readings stay in the same direction: a single spike raises no alarm.
//  4. Health score: domain score = 100 − 12 × Σ max(0, riskZ − 1); healthScore = mean of the 5 domains.
//  5. Incident rules (rules.ts): one open incident per person/location + type; if the level rises, the incident escalates.
//  6. Autonomous action (only 3 types) at most once per incident; newActions → loop.ts → simulation.
//  7. If all signals stay nominal for 10 readings, the incident is "resolved". Everything goes to the incident log (ledger).
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
  lastLevel: Partial<Record<MetricKey, Level>>; // last level given (for the reference-range rule)
  n: number;
  frozen: boolean; // has the baseline been frozen
}

interface OpenIncident {
  inc: Incident;
  rule: Rule;
  location: CrewLocation;
  clearStreak: number; // for how many readings all signals have been nominal
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

/** Processes one astronaut's reading and produces the rules' input (CrewEval). */
function evaluate(track: CrewTrack, t: Telemetry): CrewEval {
  track.n++;
  const scores = {} as Record<MetricKey, MetricScore>;
  const riskZ = {} as Record<MetricKey, number>;
  const domainLevels: Record<Domain, Level> = { cardio: 'normal', resp: 'normal', biochem: 'normal', cog: 'normal', env: 'normal' };
  for (const k of KEYS) {
    const tr = track.trackers[k];
    const value = readMetric(t, k);
    const s = tr.push(value);
    // A value within the official source's reference range does not start a new alert (z stays on screen).
    // If an alert is already open, the level drops with Layer 1's hysteresis; it never rises inside the range.
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

/** Health score: domain score = 100 − 12 × Σ max(0, riskZ − 1), 0–100; healthScore = mean of the 5 domains. */
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
  let incidents: Incident[] = []; // newest first
  let open = new Map<string, OpenIncident>(); // "CO2:KOKPIT" / "FATIGUE:elif" -> open incident
  let restBy = new Map<CrewId, string>(); // person placed on mandatory crew rest -> incident id

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

  /** Groups a rule's findings for this reading: location-scoped rules per orbit/surface, the others per person. */
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
      // 1) Raise / update / escalate an incident
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
            ledger.push(entry(at, 'SYSTEM', `Added to incident (${names(joined)}): ${inc.title}`, { incidentId: inc.id, crewIds: joined }));
          }
          if (LEVEL_RANK[level] > LEVEL_RANK[inc.level]) {
            inc.level = level;
            inc.title = rule.title(inc.crewIds, worst.hit, g.location);
            inc.status = 'open'; // an acknowledged incident that escalates to Warning needs acknowledging again
            ledger.push(entry(at, 'SYSTEM', `Incident escalated to Warning: ${inc.title}`, { incidentId: inc.id, crewIds: [...inc.crewIds] }));
          }
          inc.signals = worst.hit.signals; // while the incident is open, the signals update live
        }

        // 2) Autonomous safe action: at most once per incident
        const inc = o.inc;
        const actionable = g.members.filter((m) => m.hit.actionable);
        if (rule.action && actionable.length && !inc.autoActions.includes(rule.action)) {
          const w = worstOf(actionable);
          const crewIds =
            rule.scope === 'location' ? CREW.filter((c) => c.location === g.location).map((c) => c.id) : actionable.map((m) => m.id);
          const action: AutoAction = { type: rule.action, crewIds, at, reason: rule.reason(memberIds, w.hit, g.location), incidentId: inc.id };
          inc.autoActions = [...inc.autoActions, rule.action];
          actions.push(action);
          ledger.push(entry(at, 'AUTO_ACTION', `${ACTION_LABELS[rule.action]} · automatic — ${action.reason}`, { incidentId: inc.id, crewIds }));
          if (rule.action === 'MANDATORY_REST') for (const id of crewIds) restBy.set(id, inc.id);
        }
      }

      // 3) Resolution: all of the incident's signals nominal for RESOLVE_AFTER readings
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
          entry(at, 'INCIDENT_RESOLVED', `Resolved: ${o.inc.title} — signals nominal for ${RESOLVE_AFTER} readings`, {
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
    // An open incident carries the person's level; once its signals are back to nominal (resolution counter running) it no longer does
    for (const o of open.values()) if (o.inc.crewIds.includes(id) && !o.rule.isClear(e)) level = maxLevel(level, o.inc.level);
    const topSignals = KEYS.map((k) => e.scores[k])
      .filter((s) => !Z_EXCLUDED.has(s.key) || s.level !== 'normal')
      .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || e.riskZ[b.key] - e.riskZ[a.key])
      .slice(0, 3);
    return { crewId: id, level, healthScore, domainScores, topSignals, restRequired: restBy.has(id) };
  }

  /** Copy sent to the store: so React selectors see the change and the internal state cannot be corrupted from outside. */
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
            `Layer 1 active: collecting the first ${BASELINE_WINDOW} readings for personal baselines. Until then only absolute limits (CO₂, SpO₂, temperature, cumulative dose) are monitored.`,
          ),
        );
      }
      ticks++;

      // If the scenario started before calibration ended: freeze the baseline early without contaminating it with the anomaly
      if (ship.scenario !== 'NORMAL' && !baselineAnnounced) {
        const early = CREW_IDS.filter((id) => !tracks[id].frozen && tracks[id].n >= BASELINE_MIN_WINDOW);
        for (const id of early) freezeTrack(tracks[id]);
        if (early.length) {
          ledger.push(
            entry(at, 'SYSTEM', `Scenario started before calibration finished: ${early.length === CREW_IDS.length ? 'all crew' : names(early)} baseline frozen early with ${tracks[early[0]].n} readings.`, {
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
          entry(at, 'SYSTEM', `Personal baselines built and frozen: ${CREW_IDS.length} astronauts × ${Z_KEYS.length} metrics. Z-scores and early warning active.`),
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
      return entry(Date.now(), 'ACK', `Crew acknowledged: ${inc.title}`, { incidentId, crewIds: [...inc.crewIds] });
    },

    reset() {
      init();
    },
  };
}
