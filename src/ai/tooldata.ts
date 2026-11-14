// Parça 4 · Araçların (tool calling) okuduğu anlık veri kopyası. Sohbet isteğiyle birlikte sunucuya
// gider; api/astra.ts'teki araçlar SADECE bunu okur (değiştiremez, uyarı açamaz).
// Modele doğrudan gitmez: model hangi parçaya ihtiyaç duyarsa aracı çağırıp o parçayı alır.
import { CREW } from '../crew';
import { GROUP_NAMES, METRICS, readMetric } from '../metrics';
import type { AstraState } from '../store';
import { incidentSummary, signalSummary } from './context';
import { REFERENCES } from './knowledge';
import { LEVEL_TR, shortName } from './labels';

/** Geçmişten kaç ölçümde bir örnek alınır ve en fazla kaç nokta gönderilir. */
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
          konum: m.location === 'KOKPIT' ? 'Kokpit (yörüngedeki gemi)' : 'Gezegen yüzeyi (EVA giysisi)',
          birim: m.unit,
          kisiselHassasiyet: m.sensitivity,
          durum: st ? LEVEL_TR[st.level] : 'veri yok',
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
          ekgRitmi: t ? (t.cardio.ecg_rhythm === 'sinus' ? 'sinüs (normal)' : 'düzensiz') : undefined,
          olcumler: t
            ? METRICS.map((mi) => ({
                anahtar: mi.key,
                ad: mi.label,
                birim: mi.unit,
                grup: GROUP_NAMES[mi.group],
                deger: round(readMetric(t, mi.key), mi.decimals),
                ...(mi.cadence === 'daily' ? { olcumSikligi: 'günde bir' } : {}),
              }))
            : [],
          enCokSapanlar: st?.topSignals.slice(0, 3).map(signalSummary) ?? [],
        },
      ];
    }),
  );

  // Canlı ölçümlerin son değerleri (eskiden yeniye), her TREND_STRIDE ölçümde bir örnek.
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

  return {
    murettebat,
    gecmis,
    gecmisAraligi: `son değerler eskiden yeniye; her ${TREND_STRIDE} ölçümde bir örnek`,
    olaylar: s.incidents.slice(0, 15).map(incidentSummary),
    kayit: s.ledger.slice(0, 12).map((e) => ({ saat: new Date(e.at).toLocaleTimeString('tr-TR'), tur: e.kind, metin: e.text })),
    bilgi: REFERENCES,
  };
}

export type ToolData = ReturnType<typeof buildToolData>;
