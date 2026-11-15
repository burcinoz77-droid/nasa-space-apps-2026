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
  { id: 'zolpidem', name: 'Zolpidem', use: 'Uyku', unit: 'tablet', full: 60, stock: 9, min: 12 },
  { id: 'melatonin', name: 'Melatonin', use: 'Uyku ritmi', unit: 'tablet', full: 90, stock: 41, min: 15 },
  { id: 'ibuprofen', name: 'İbuprofen', use: 'Kas ve eklem ağrısı', unit: 'tablet', full: 80, stock: 34, min: 15 },
  { id: 'paracetamol', name: 'Parasetamol', use: 'Baş ağrısı, ateş', unit: 'tablet', full: 80, stock: 27, min: 15 },
  { id: 'pseudoephedrine', name: 'Psödoefedrin', use: 'Burun tıkanıklığı', unit: 'tablet', full: 40, stock: 18, min: 8 },
  { id: 'loratadine', name: 'Loratadin', use: 'Alerji', unit: 'tablet', full: 40, stock: 22, min: 8 },
  { id: 'promethazine', name: 'Prometazin', use: 'Bulantı, uzay tutması', unit: 'doz', full: 20, stock: 11, min: 4 },
  { id: 'hydrocortisone', name: 'Hidrokortizon krem', use: 'Deri döküntüsü', unit: 'tüp', full: 6, stock: 2, min: 2 },
  { id: 'ors', name: 'Oral rehidrasyon tuzu', use: 'Sıvı ve elektrolit', unit: 'paket', full: 40, stock: 19, min: 10 },
];

export const MED_BY_ID = Object.fromEntries(MED_KIT.map((m) => [m.id, m])) as Record<MedId, MedItem>;

export const MED_SOURCE = {
  label: 'Wotring 2015, FASEB J',
  note: "ISS'teki 24 astronotun ilaç kaydı: en sık uyku, ağrı, burun tıkanıklığı ve alerji ilaçları",
  url: 'https://ntrs.nasa.gov/api/citations/20140017010/downloads/20140017010.pdf',
};

// Revir kapasitesi (ekip taslağı): aynı anda bakım alabilecek astronot sayısı.
export const INFIRMARY_BEDS = 4;

// Uçuş cerrahının yer istasyonu (kurgusal kişi; gerçek bir doktorun adı kullanılmaz).
export const GROUND = { name: 'Dr. Can Aydın', role: 'Uçuş cerrahı', station: 'Houston' } as const;

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
    diagnosis: 'Güneş parçacık olayı: yüksek radyasyon maruziyeti',
    order: 'Doz hızı normale dönene kadar sığınakta kalın. Bulantı ya da kusma olursa hemen yazın; dozimetreyi saat başı gönderin.',
  },
  CO2: {
    diagnosis: 'Kabin CO₂ yükselmesine bağlı baş ağrısı ve dikkat azalması riski',
    order:
      'Havalandırmayı artırın, yedek CO₂ temizleyiciyi devreye alın. Baş ağrısı için kitten parasetamol kullanılabilir; doz ilaç kartındaki protokole göre.',
    med: 'paracetamol',
  },
  CARDIO: {
    diagnosis: 'Kalp ritmi düzensizliği şüphesi',
    order: 'Fiziksel aktiviteyi bırakın, yatar pozisyonda dinlenin. 15 dakikada bir EKG ve tansiyon gönderin; göğüs ağrısı olursa hemen yazın.',
  },
  HYPOXIA: {
    diagnosis: 'Düşük oksijen doygunluğu (hipoksemi) şüphesi',
    order: "Ek oksijen maskesini takın, SpO₂'yi 5 dakikada bir bildirin. Değer %90'ın altına inerse EVA'yı bitirip habitata dönün.",
  },
  THERMAL: {
    diagnosis: 'Isı yükü ve sıvı kaybı (dehidratasyon) riski',
    order: "EVA'ya ara verin, soğutma giysisi akışını en yükseğe alın. Bir paket oral rehidrasyon tuzu içirin.",
    med: 'ors',
  },
  FATIGUE: {
    diagnosis: 'Uyku borcu ve yorgunluk',
    order: 'Bu gece 8 saat uyku planlayın, ışık programını uygulayın. Uykuya dalmak için kitten melatonin kullanılabilir.',
    med: 'melatonin',
  },
  STRESS: {
    diagnosis: 'Psikolojik zorlanma belirtileri',
    order: 'İş yükünü bugün hafifletin. Bir sonraki iletişim penceresinde psikolog görüşmesi planlıyoruz.',
  },
  MULTI: {
    diagnosis: 'Birden çok sistemde eş zamanlı sapma',
    order: 'Revire alın, tüm verileri 10 dakikada bir gönderin. Ekip sağlık sorumlusu başında kalsın.',
  },
  NONE: {
    diagnosis: 'Belirgin bulgu yok',
    order: 'Mesajınız ulaştı. Gönderdiğiniz değerler kişisel normal aralığında; izlemeye devam ediyoruz.',
  },
};
