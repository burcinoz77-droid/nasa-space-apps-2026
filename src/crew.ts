// ARES-1 mürettebatı: altı kurgusal astronot. Görev unvanları gerçek mürettebat unvanlarıdır
// (Komutan, Uçuş Mühendisi, Görev Uzmanı, Sağlık Sorumlusu). Gerçek bir astronotun adı ve sağlık verisi kullanılmaz.
import type { CrewId, CrewMember } from './types';

export const CREW: CrewMember[] = [
  { id: 'elif', name: 'Dr. Elif Yılmaz', role: 'Görev Uzmanı · Sağlık Sorumlusu', location: 'KOKPIT', unit: 'IVA-01', sensitivity: 'EVA radyasyon hassasiyeti' },
  { id: 'kerem', name: 'Kerem Demir', role: 'Uçuş Mühendisi', location: 'KOKPIT', unit: 'IVA-02', sensitivity: 'Yüksek kabin CO₂ duyarlılığı' },
  { id: 'zeynep', name: 'Zeynep Arslan', role: 'Komutan', location: 'KOKPIT', unit: 'IVA-03', sensitivity: 'Yüksek G ve kardiyak dayanıklılık' },
  { id: 'emir', name: 'Emir Çelik', role: 'Görev Uzmanı · Bilim İnsanı', location: 'GEZEGEN', unit: 'xEMU-01', sensitivity: 'Sirkadiyen ve yüzey radyasyon izlemi' },
  { id: 'deniz', name: 'Deniz Özkan', role: 'Uçuş Mühendisi · Yüzey Sistemleri', location: 'GEZEGEN', unit: 'xEMU-02', sensitivity: 'Düşük yerçekimi kas-iskelet yükü' },
  { id: 'mert', name: 'Mert Şahin', role: 'Görev Uzmanı · Jeolog', location: 'GEZEGEN', unit: 'xEMU-03', sensitivity: 'Yüzey keşfi ve metabolik adaptasyon' },
];

export const CREW_IDS = CREW.map((c) => c.id) as CrewId[];
export const CREW_BY_ID = Object.fromEntries(CREW.map((c) => [c.id, c])) as Record<CrewId, CrewMember>;
