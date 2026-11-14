// Parça 4 · Modele gönderilecek kısa veri özeti (yaklaşık 3.000 token altında kalsın).
// Değerler ekranda gösterildiği gibi yuvarlanır; böylece model ekranla aynı sayıları kullanır.
import { CREW } from '../crew';
import { METRICS, readMetric } from '../metrics';
import type { AstraState } from '../store';

const round = (v: number, d: number) => Number(v.toFixed(d));

export function buildContext(s: AstraState): Record<string, unknown> {
  return {
    gorevGunu: s.ship?.missionDay,
    senaryo: s.ship?.scenario,
    dunyaGecikmesiTekYon_dk: s.ship ? round(s.ship.commDelayOneWay_s / 60, 1) : undefined,
    murettebat: CREW.map((m) => {
      const t = s.telemetry[m.id];
      const st = s.statuses[m.id];
      return {
        ad: m.name,
        konum: m.location === 'KOKPIT' ? 'Kokpit (gemi)' : 'Gezegen yüzeyi (EVA)',
        durum: st?.level,
        saglikSkoru: st?.healthScore,
        zorunluDinlenme: st?.restRequired,
        olcumler: t ? Object.fromEntries(METRICS.map((mi) => [`${mi.label} (${mi.unit})`, round(readMetric(t, mi.key), mi.decimals)])) : {},
        enCokSapanlar: st?.topSignals.map((x) => `${x.key}: z=${round(x.z, 1)}`),
      };
    }),
    acikOlaylar: s.incidents
      .filter((i) => i.status !== 'resolved')
      .map((i) => ({ baslik: i.title, seviye: i.level, otonomAdimlar: i.autoActions })),
  };
}
