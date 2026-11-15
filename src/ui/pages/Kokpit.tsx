// Parça 3 · Kokpit: sağlık konsolu. Ekibin taslağındaki düzen, tek ekranda:
//
//   ┌ Kokpit ─────┬ ASTRA iletileri ┬ Revir (ilaç · teşhis · tedavi) ┬ Seçili astronot ┐
//   │ görev, revir │ olaylar, kayıt  │                               │ 3B model        │
//   ├ Astronotlar ─┴─────────────────┼ Ana istasyon (Dünya)          │ önemli durum    │
//   │ 6 kişi, gemide / EVA'da        │ uçuş cerrahı · ASTRA sohbet   │ sağlık verileri │
//   └────────────────────────────────┴───────────────────────────────┴─────────────────┘
//
// Düzen index.css'teki .astra-console ızgarasıyla kurulur (dar ekranda iki sütun, telefonda tek sütun).
// Sayfa id'si 'kokpit' kalır: Parça 1'in demo turu buraya NAVIGATE_EVENT ile gelir.
import type { CrewId } from '../../types';
import { AiFeed } from '../console/AiFeed';
import { CrewDetail } from '../console/CrewDetail';
import { CrewGrid } from '../console/CrewGrid';
import { EarthTile } from '../console/EarthTile';
import { MedicalTile } from '../console/MedicalTile';
import { MissionTile } from '../console/MissionTile';

export function Kokpit({ crewId, onSelect }: { crewId: CrewId; onSelect: (id: CrewId) => void }) {
  return (
    <div className="astra-console overflow-hidden rounded-md border border-space-border bg-space-border">
      <MissionTile />
      <AiFeed onSelect={onSelect} />
      <MedicalTile />
      <CrewDetail crewId={crewId} />
      <CrewGrid selected={crewId} onSelect={onSelect} />
      <EarthTile crewId={crewId} />
    </div>
  );
}
