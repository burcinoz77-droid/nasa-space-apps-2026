// Parça 4 · Modele gönderilecek kısa veri özeti (yaklaşık 3.000 token altında kalsın).
// Kural: durumu normal olan kişi için 8 ana ölçüm; durumu normal olmayan, soruda adı
// geçen ya da olayda etkilenen kişi için tüm ölçümler. Model bilmediği sayıyı yazamaz;
// bu yüzden cevapta geçebilecek sabitler (kariyer doz limiti, CO₂ sınırları, gecikme)
// de buraya konur. Değerler ekranda gösterildiği gibi yuvarlanır.
import { CREW } from '../crew';
import { METRICS, METRIC_BY_KEY, readMetric, type MetricKey } from '../metrics';
import { PARAMS } from '../sim/parameters';
import type { AstraState } from '../store';
import type { CrewId, Incident, MetricScore } from '../types';
import { ACTION_TR, crewInText, delayText, INCIDENT_TR, LEVEL_TR, SCENARIO_TR, shortName } from './labels';

/** Normal durumdaki kişi için gönderilen 8 ana ölçüm. */
export const KEY_METRICS: MetricKey[] = [
  'cardio.hr_bpm',
  'cardio.spo2_pct',
  'resp.rr_bpm',
  'resp.coreTemp_C',
  'env.doseRate_uSv_h',
  'env.doseCumulative_mSv',
  'env.ppCO2_mmHg',
  'env.sleepLastNight_h',
];

/** Model için güvenli üst sınır: JSON uzunluğu / 4 ≈ token. */
export const MAX_CONTEXT_TOKENS = 3000;

const round = (v: number, d: number) => Number(v.toFixed(d));

/** PARAMS'tan değer okur; anahtar o dalda yoksa plandaki (kaynaklı) değere düşer. */
function param(key: string, fallback: number): number {
  return (PARAMS as Record<string, { value: number } | undefined>)[key]?.value ?? fallback;
}

export interface ContextOptions {
  /** Sohbet sorusu: adı geçen kişilerin tüm ölçümleri eklenir. */
  question?: string;
  /** Olay açıklaması: olaydaki kişilerin tüm ölçümleri ve olayın ayrıntısı eklenir. */
  incident?: Incident;
}

function metricLabel(key: MetricKey): string {
  const m = METRIC_BY_KEY[key];
  return m ? `${m.label} (${m.unit})` : key;
}

function signalSummary(sig: MetricScore) {
  const m = METRIC_BY_KEY[sig.key];
  const d = m?.decimals ?? 1;
  return {
    olcum: m?.label ?? sig.key,
    deger: round(sig.value, d),
    birim: m?.unit ?? '',
    kisiselNormal: round(sig.mean, d),
    z: round(sig.z, 1),
    seviye: LEVEL_TR[sig.level],
  };
}

function incidentSummary(i: Incident) {
  return {
    olayId: i.id,
    tur: INCIDENT_TR[i.type] ?? i.type,
    baslik: i.title,
    seviye: LEVEL_TR[i.level],
    durum: i.status === 'acknowledged' ? 'mürettebat onayladı' : 'açık',
    kisiler: i.crewIds.map(shortName),
    sinyaller: i.signals.slice(0, 4).map(signalSummary),
    otonomAdimlar: i.autoActions.map((a) => ACTION_TR[a] ?? a),
  };
}

function crewSummary(s: AstraState, id: CrewId, detailed: boolean, keysOnly: boolean) {
  const m = CREW.find((c) => c.id === id)!;
  const t = s.telemetry[id];
  const st = s.statuses[id];
  const keys = detailed && !keysOnly ? METRICS.map((x) => x.key) : KEY_METRICS;
  const olcumler: Record<string, number | string> = {};
  if (t) {
    for (const key of keys) olcumler[metricLabel(key)] = round(readMetric(t, key), METRIC_BY_KEY[key].decimals);
    if (detailed) olcumler['EKG ritmi'] = t.cardio.ecg_rhythm === 'sinus' ? 'sinüs (normal)' : 'düzensiz';
  }
  const careerLimit = param('careerDoseLimit', 600);
  return {
    ad: shortName(id),
    tamAd: m.name,
    rol: m.role,
    konum: m.location === 'KOKPIT' ? 'Kokpit (yörüngedeki gemi)' : 'Gezegen yüzeyi (EVA giysisi)',
    kisiselHassasiyet: m.sensitivity,
    durum: st ? LEVEL_TR[st.level] : 'veri yok',
    saglikSkoru_pct: st ? Math.round(st.healthScore) : undefined,
    bilisselSkor_pct: st ? Math.round(st.domainScores.cog) : undefined,
    zorunluDinlenme: st?.restRequired ?? false,
    kariyerDozLimitininYuzdesi_pct: t ? Math.round((t.env.doseCumulative_mSv / careerLimit) * 100) : undefined,
    olcumler,
    ...(detailed && st?.topSignals.length ? { enCokSapanlar: st.topSignals.slice(0, 3).map(signalSummary) } : {}),
  };
}

export function buildContext(s: AstraState, opts: ContextOptions = {}): Record<string, unknown> {
  const named = new Set<CrewId>([...crewInText(opts.question ?? ''), ...(opts.incident?.crewIds ?? [])]);
  const isDetailed = (id: CrewId) => named.has(id) || (s.statuses[id]?.level ?? 'normal') !== 'normal';

  const delay = s.ship?.commDelayOneWay_s;
  const delayMin = param('commDelayMin', 180) / 60;
  const delayMax = param('commDelayMax', 1344) / 60;
  const openIncidents = s.incidents.filter((i) => i.status !== 'resolved').slice(0, 5);

  const make = (keysOnly: boolean) => ({
    gorev: 'ARES-1 Mars görevi',
    gorevGunu: s.ship?.missionDay,
    senaryo: s.ship ? SCENARIO_TR[s.ship.scenario] : undefined,
    aktifOlaylarGemi: s.ship?.activeEvents.length ? s.ship.activeEvents : undefined,
    dunyaGecikmesi:
      delay !== undefined
        ? {
            tekYon: delayText(delay),
            tekYon_dk: round(delay / 60, 1),
            gidisDonus_dk: round((delay * 2) / 60, 1),
            // NASA Mars Relay Network: tek yön 3-22,4 dk, gidiş-dönüş 6-44 dk
            olasiAralik: `tek yön ${round(delayMin, 0)}-${round(delayMax, 1)} dk, gidiş-dönüş ${Math.round(delayMin * 2)}-${Math.floor(delayMax * 2)} dk`,
          }
        : undefined,
    sabitler: {
      kariyerDozLimiti_mSv: param('careerDoseLimit', 600), // NASA-STD-3001
      co2DikkatSiniri_mmHg: param('co2CautionLimit', 2.3), // OCHMO-TB-004
      co2KritikSiniri_mmHg: param('co2CriticalLimit', 3.0), // OCHMO-TB-004
      issCo2Medyani_mmHg: param('cabinCO2Median', 1.9), // OSDR EDA
    },
    murettebat: CREW.map((m) => crewSummary(s, m.id, isDetailed(m.id), keysOnly)),
    acikOlaylar: openIncidents.map(incidentSummary),
    ...(opts.incident ? { olayId: opts.incident.id, aciklanacakOlay: incidentSummary(opts.incident) } : {}),
  });

  // Önce tam hâli dene; çok uzunsa ayrıntılı kişileri de 8 ölçüme indir.
  const full = make(false);
  if (estimateTokens(full) <= MAX_CONTEXT_TOKENS) return full;
  return make(true);
}

/** Kaba token tahmini (plan: JSON.stringify(ctx).length / 4). */
export function estimateTokens(ctx: unknown): number {
  return Math.ceil(JSON.stringify(ctx).length / 4);
}
