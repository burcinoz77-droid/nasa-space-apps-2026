// Parça 2 · Katman 1: anomali tespiti, erken uyarı, otonom güvenli adımlar, olay kaydı
// ŞU AN: v0 — herkes "normal", olay yok. Ekranlar çalışsın diye var.
// PARÇA 2'NİN İŞİ: kişisel baseline + z-skoru + ardışık ölçüm kuralı + olay açma +
// otonom adımlar + kayıt defteri. Adımlar planın "2 · Katman 1 Anomali" sekmesinde.
import { CREW_IDS } from '../crew';
import type { CrewId, CrewStatus, Detector, DetectorOutput, Incident, LedgerEntry } from '../types';

export function createDetector(): Detector {
  let incidents: Incident[] = [];

  return {
    process(_ship, telemetry): DetectorOutput {
      const statuses = {} as Record<CrewId, CrewStatus>;
      for (const id of CREW_IDS) {
        const has = telemetry.some((t) => t.crewId === id);
        statuses[id] = {
          crewId: id,
          level: 'normal',
          healthScore: has ? 90 : 0,
          domainScores: { cardio: 90, resp: 90, biochem: 90, cog: 90, env: 90 },
          topSignals: [],
          restRequired: false,
        };
      }
      return { statuses, incidents, newLedger: [], newActions: [] };
    },
    acknowledge(incidentId): LedgerEntry | null {
      const inc = incidents.find((i) => i.id === incidentId);
      if (!inc) return null;
      inc.status = 'acknowledged';
      return { id: `ack-${incidentId}`, at: Date.now(), kind: 'ACK', text: `${inc.title} — mürettebat onayladı`, incidentId };
    },
    reset() {
      incidents = [];
    },
  };
}
