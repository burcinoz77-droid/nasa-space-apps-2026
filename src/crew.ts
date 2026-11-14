// ARES-1 mürettebatı (ekran görüntülerindeki altı kurgusal astronot).
// Gerçek bir astronotun adı ve sağlık verisi kullanılmaz.
import type { CrewId, CrewMember } from './types';

export const CREW: CrewMember[] = [
  { id: 'elif', name: 'Dr. Elif Yılmaz', role: 'Uzay Biyoloğu', location: 'KOKPIT', unit: 'IVA-01', sensitivity: 'EVA radyasyon hassasiyeti' },
  { id: 'kerem', name: 'Kerem Demir', role: 'Mühendis', location: 'KOKPIT', unit: 'IVA-02', sensitivity: 'Yüksek kabin CO₂ duyarlılığı' },
  { id: 'zeynep', name: 'Zeynep Arslan', role: 'Pilot', location: 'KOKPIT', unit: 'IVA-03', sensitivity: 'Yüksek G ve kardiyak dayanıklılık' },
  { id: 'emir', name: 'Muhammed Emir', role: 'Bilim İnsanı', location: 'GEZEGEN', unit: 'xEMU-01', sensitivity: 'Sirkadiyen ve yüzey radyasyon izlemi' },
  { id: 'deniz', name: 'Deniz Özkan', role: 'Mühendis', location: 'GEZEGEN', unit: 'xEMU-02', sensitivity: 'Düşük yerçekimi kas-iskelet yükü' },
  { id: 'mert', name: 'Mert Şahin', role: 'Uzman', location: 'GEZEGEN', unit: 'xEMU-03', sensitivity: 'Yüzey keşfi ve metabolik adaptasyon' },
];

export const CREW_IDS = CREW.map((c) => c.id) as CrewId[];
export const CREW_BY_ID = Object.fromEntries(CREW.map((c) => [c.id, c])) as Record<CrewId, CrewMember>;
