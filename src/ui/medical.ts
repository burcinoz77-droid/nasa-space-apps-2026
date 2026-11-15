// Parça 3 · Revir verisi: gemideki ilaç kiti ve Dünya'daki uçuş cerrahının yanıt kuralları.
//
// İlaç kararını ASTRA vermez (Parça 4 güvenlik kuralı: teşhis yok, ilaç yok). İlaç ve tedavi talimatı yalnızca
// "Ana istasyon" panelinden yazışılan uçuş cerrahından gelir; bu dosya o yanıtları senaryo için üretir.
// Yanıtlar simülasyondur: doz yazmaz, "doz ilaç kartındaki protokole göre" der.
import type { IncidentType } from '../types';

export type MedId = 'zolpidem' | 'melatonin' | 'ibuprofen' | 'paracetamol' | 'pseudoephedrine' | 'loratadine' | 'promethazine' | 'hydrocortisone' | 'ors';

export interface MedItem {
  id: MedId;
  name: string; // etken madde (marka adı değil)
  use: string; // ne için
  unit: string; // tablet, doz, paket ...
  full: number; // görev başındaki miktar
  stock: number; // görevin bu gününde kalan (senaryo varsayımı)
  min: number; // bunun altı: yeniden ikmal planlanmalı (dikkat)
}

// Kit içeriği: ISS'te uzun görevlerde en sık kullanılan ilaç grupları — uyku, ağrı, burun tıkanıklığı ve alerji;
// uyku ilacı kullanımı Dünya'dakinin ~10 katı (Wotring 2015). Deri döküntüsü ve EVA sonrası sıvı kaybı da
// sık görülen durumlar. Miktarlar ARES-1 senaryosu için varsayımdır; uyku ilacının azalmış olması bilerek.
export const MED_KIT: MedItem[] = [
  { id: 'zolpidem', name: 'Zolpidem', use: 'Sleep', unit: 'tablets', full: 60, stock: 9, min: 12 },
  { id: 'melatonin', name: 'Melatonin', use: 'Sleep timing', unit: 'tablets', full: 90, stock: 41, min: 15 },
  { id: 'ibuprofen', name: 'Ibuprofen', use: 'Muscle and joint pain', unit: 'tablets', full: 80, stock: 34, min: 15 },
  { id: 'paracetamol', name: 'Acetaminophen', use: 'Headache, fever', unit: 'tablets', full: 80, stock: 27, min: 15 },
  { id: 'pseudoephedrine', name: 'Pseudoephedrine', use: 'Nasal congestion', unit: 'tablets', full: 40, stock: 18, min: 8 },
  { id: 'loratadine', name: 'Loratadine', use: 'Allergy', unit: 'tablets', full: 40, stock: 22, min: 8 },
  { id: 'promethazine', name: 'Promethazine', use: 'Nausea, space motion sickness', unit: 'doses', full: 20, stock: 11, min: 4 },
  { id: 'hydrocortisone', name: 'Hydrocortisone cream', use: 'Skin rash', unit: 'tubes', full: 6, stock: 2, min: 2 },
  { id: 'ors', name: 'Oral rehydration salts', use: 'Fluids and electrolytes', unit: 'packets', full: 40, stock: 19, min: 10 },
];

export const MED_BY_ID = Object.fromEntries(MED_KIT.map((m) => [m.id, m])) as Record<MedId, MedItem>;

export const MED_SOURCE = {
  label: 'Wotring 2015, FASEB J',
  note: 'Medication records of 24 ISS astronauts: sleep, pain, congestion and allergy medications were used most',
  url: 'https://ntrs.nasa.gov/api/citations/20140017010/downloads/20140017010.pdf',
};

// Revir kapasitesi (ekip taslağı): aynı anda bakım alabilecek astronot sayısı.
export const INFIRMARY_BEDS = 4;

// Uçuş cerrahının yer istasyonu (kurgusal kişi; gerçek bir doktorun adı kullanılmaz).
export const GROUND = { name: 'Dr. Can Aydın', role: 'Flight Surgeon', station: 'MCC-Houston' } as const;

// Cerrahın mesajı okuyup yanıt yazması (görev süresi, saniye).
export const DOCTOR_REVIEW_S = 10 * 60;

export interface DoctorReply {
  diagnosis: string; // "Teşhisler" sekmesine düşer
  order: string; // mesaj metni ve "Tedavi" sekmesi
  med?: MedId; // kitten kullanılacak ilaç (varsa)
}

/** Uçuş cerrahının yanıtı: mesajın konusu olan astronotun en ağır açık olayına göre. */
export const DOCTOR_REPLIES: Record<IncidentType | 'NONE', DoctorReply> = {
  RADIATION: {
    diagnosis: 'Solar particle event: elevated radiation exposure',
    order: 'Stay in the storm shelter until the dose rate returns to normal. Report any nausea or vomiting right away and send dosimeter readings every hour.',
  },
  CO2: {
    diagnosis: 'Risk of headache and reduced attention from elevated cabin CO₂',
    order:
      'Increase ventilation and bring the backup CO₂ scrubber online. Acetaminophen from the medical kit may be used for headache; dose per the medication card protocol.',
    med: 'paracetamol',
  },
  CARDIO: {
    diagnosis: 'Suspected cardiac rhythm irregularity',
    order: 'Stop physical activity and rest lying down. Send ECG and blood pressure every 15 minutes; report chest pain immediately.',
  },
  HYPOXIA: {
    diagnosis: 'Suspected low oxygen saturation (hypoxemia)',
    order: 'Put on the supplemental oxygen mask and report SpO₂ every 5 minutes. If it drops below 90%, terminate the EVA and return to the habitat.',
  },
  THERMAL: {
    diagnosis: 'Risk of heat load and fluid loss (dehydration)',
    order: 'Pause the EVA and set suit cooling flow to maximum. Have one packet of oral rehydration salts.',
    med: 'ors',
  },
  FATIGUE: {
    diagnosis: 'Sleep debt and fatigue',
    order: 'Schedule 8 hours of sleep tonight and follow the lighting protocol. Melatonin from the medical kit may be used to help fall asleep.',
    med: 'melatonin',
  },
  STRESS: {
    diagnosis: 'Signs of psychological strain',
    order: 'Lighten the workload today. We are scheduling a psychologist conference for the next communication window.',
  },
  MULTI: {
    diagnosis: 'Simultaneous deviations in several systems',
    order: 'Move to the medical bay and send all data every 10 minutes. The Crew Medical Officer should stay with the crew member.',
  },
  NONE: {
    diagnosis: 'No significant findings',
    order: 'Message received. The values you sent are within the personal baseline; we continue to monitor.',
  },
};
