// Part 4 · Data snapshot read by the tools (tool calling). Sent to the server with the chat request;
// the tools in api/astra.ts ONLY read it (they cannot change it or raise alerts).
// It is not sent to the model directly: the model calls a tool to get the part it needs.
import { CREW } from '../crew';
import { GROUP_NAMES, METRICS, readMetric } from '../metrics';
import type { AstraState } from '../store';
import { CONDITION_DISCLAIMER, possibleConditions } from './conditions';
import { incidentSummary, signalSummary } from './context';
import { REFERENCES } from './knowledge';
import { LEVEL_TR, shortName } from './labels';
import { longHistory, longHistorySpanHours, MISSION_MIN_PER_TICK, personalNormal } from './memory';
import { buildTestData } from './testdata';
import { LICENSED_NOTE, LICENSED_SIM_KEYS } from '../psych/instruments';

/** Sample every how many readings from the history, and the maximum number of points sent. */
const TREND_STRIDE = 6;
const TREND_POINTS = 10;

const round = (v: number, d: number) => Number(v.toFixed(d));

export function buildToolData(s: AstraState) {
  const murettebat = Object.fromEntries(
    CREW.map((m) => {
      const t = s.telemetry[m.id];
      const st = s.statuses[m.id];
      return [
        m.id,
        {
          ad: shortName(m.id),
          tamAd: m.name,
          rol: m.role,
          konum: m.location === 'KOKPIT' ? 'Orbit (IVA, inside the spacecraft)' : 'Mars surface (EVA suit)',
          birim: m.unit,
          kisiselHassasiyet: m.sensitivity,
          durum: st ? LEVEL_TR[st.level] : 'no data',
          saglikSkoru_pct: st ? Math.round(st.healthScore) : undefined,
          alanSkorlari_pct: st
            ? {
                kalpDamar: Math.round(st.domainScores.cardio),
                solunumMetabolik: Math.round(st.domainScores.resp),
                biyokimya: Math.round(st.domainScores.biochem),
                bilissel: Math.round(st.domainScores.cog),
                cevre: Math.round(st.domainScores.env),
              }
            : undefined,
          zorunluDinlenme: st?.restRequired ?? false,
          ekgRitmi: t ? (t.cardio.ecg_rhythm === 'sinus' ? 'sinus (normal)' : 'irregular') : undefined,
          olcumler: t
            ? METRICS.map((mi) => {
                const pn = personalNormal(m.id, mi.key);
                return {
                  anahtar: mi.key,
                  ad: mi.label,
                  birim: mi.unit,
                  grup: GROUP_NAMES[mi.group],
                  deger: round(readMetric(t, mi.key), mi.decimals),
                  ...(pn ? { kisiselNormal: round(pn.mean, mi.decimals) } : {}),
                  ...(mi.cadence === 'daily' ? { olcumSikligi: 'once a day' } : {}),
                  ...(LICENSED_SIM_KEYS.includes(mi.key) ? { not: LICENSED_NOTE } : {}),
                };
              })
            : [],
          enCokSapanlar: st?.topSignals.slice(0, 3).map(signalSummary) ?? [],
          olasiDurumlar: possibleConditions(s, m.id),
        },
      ];
    }),
  );

  // Latest values of the live readings (oldest to newest), one sample every TREND_STRIDE readings.
  const gecmis = Object.fromEntries(
    CREW.map((m) => {
      const h = s.history[m.id] ?? [];
      const sample = h.filter((_, i) => (h.length - 1 - i) % TREND_STRIDE === 0).slice(-TREND_POINTS);
      return [
        m.id,
        Object.fromEntries(
          METRICS.filter((mi) => mi.cadence === 'live').map((mi) => [mi.key, sample.map((t) => round(readMetric(t, mi.key), mi.decimals))]),
        ),
      ];
    }),
  );

  // Long term: at most 12 evenly spaced points + summary from ASTRA's memory (src/ai/memory.ts).
  const uzunGecmis = Object.fromEntries(
    CREW.map((m) => [
      m.id,
      Object.fromEntries(
        METRICS.map((mi) => {
          const all = longHistory(m.id, mi.key);
          if (all.length < 2) return [mi.key, undefined];
          const step = Math.max(1, Math.ceil(all.length / 12));
          const points = all.filter((_, i) => (all.length - 1 - i) % step === 0).map((v) => round(v, mi.decimals));
          const mean = all.reduce((a, b) => a + b, 0) / all.length;
          return [
            mi.key,
            { degerler: points, enDusuk: round(Math.min(...all), mi.decimals), enYuksek: round(Math.max(...all), mi.decimals), ortalama: round(mean, mi.decimals) },
          ];
        }).filter(([, v]) => v),
      ),
    ]),
  );

  return {
    murettebat,
    olasiDurumUyarisi: CONDITION_DISCLAIMER,
    gecmis,
    gecmisAraligi: `latest values, oldest to newest; one sample every ${TREND_STRIDE} readings (1 reading = ${MISSION_MIN_PER_TICK} min of mission time)`,
    uzunGecmis,
    uzunGecmisKapsami_saat: round(longHistorySpanHours(), 1),
    olaylar: s.incidents.slice(0, 15).map(incidentSummary),
    kayit: s.ledger.slice(0, 12).map((e) => ({ saat: new Date(e.at).toLocaleTimeString('en-GB'), tur: e.kind, metin: e.text })),
    bilgi: REFERENCES,
    testler: buildTestData(s),
  };
}

export type ToolData = ReturnType<typeof buildToolData>;
