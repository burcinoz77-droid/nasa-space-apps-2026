// Parça 4 · Güvenlik süzgeci: modelin cevabı ilaç ya da doz öneriyorsa veya KESİN teşhis koyuyorsa gösterilmez.
// client.ts cevabı göstermeden önce checkAnswer() çağırır; güvensizse yedek cevap gösterilir ve konsola yazılır.
//
// Kural (ekip kararı): ASTRA olası durumları İHTİMAL diliyle söyleyebilir ("... ile uyumlu olabilir",
// "... olasılığını düşündürüyor"); kesin ifade ("aritmi var", "kesinlikle hipoksi") kullanamaz.
// Reddetme cümleleri ("Kesin teşhis koyamam", "İlaç öneremem") her zaman güvenlidir.

/** Bu kalıplar nerede geçerse geçsin cevabı engeller (ilaç dozu ve doz talimatı). */
const ALWAYS_BLOCK: RegExp[] = [
  /\d\s*(mg|mcg|miligram|mikrogram)(?![a-zçğıöşü])/, // "400 mg"
  /doz(?:u|unu)?\s+(?:al|ver|uygula)(?:y?ın|y?in|sın|sin|malı|meli)/, // "doz alın", "dozu verin"
];

/** İlaç önerisi: reddetme cümlesi değilse engellenir. */
const MEDICATION = /(ilaç|ilac|tablet|kapsül|antibiyotik|ibuprofen|parasetamol|aspirin|ağrı kesici|enjeksiyon)/;

/** Hastalık ve teşhis ifadeleri: ihtimal dili ya da reddetme yoksa engellenir. */
const CONDITION =
  /(teşhis|tanı koy|tanısı|aritmi|ritim bozukluğu|kalp krizi|enfarktüs|hipoksi|hiperkapni|hipertermi|ısı çarpması|ısı stresi|dehidratasyon|anksiyete|depresyon|enfeksiyon|radyasyon hastalığı|sendrom)/;

/** Kesinlik bildiren ifadeler: ihtimal dili olsa bile engellenir. */
const DEFINITIVE = /(kesinlikle|şüphesiz|açıkça görül|tanısı konul|teşhis edil|teşhisi budur|kesin olarak)/;

/** İhtimal dili. */
const HEDGE = /(olabilir|olası|olasılı|ihtimal|düşündür|uyumlu|işaret edebilir|akla getir|şüphe|değerlendirilmeli|kesin değil|teşhis yerine geçmez)/;

/** Reddetme ya da yönlendirme kalıpları ("öneremem", "koyamam", "yetkim yok"). */
const REFUSAL =
  /(öneremem|önermem|önermiyorum|öneremiyorum|veremem|koyamam|koymam|koyamıyorum|koymuyorum|söyleyemem|doğrulayamam|yapamam|edemem|değilim|yetkim yok|yetkisi yok|mümkün değil|uçuş doktorunun (?:işi|kararı|sorumluluğu|kararıdır))/;

export interface SafetyResult {
  safe: boolean;
  reason?: string;
}

export function checkAnswer(text: string): SafetyResult {
  const lower = text.toLocaleLowerCase('tr-TR');
  for (const re of ALWAYS_BLOCK) {
    const m = lower.match(re);
    if (m) return { safe: false, reason: `yasak ifade: "${m[0]}"` };
  }
  const sentences = lower.split(/(?<=[.!?])\s+|\n+/);
  for (const s of sentences) {
    const med = s.match(MEDICATION);
    if (med && !REFUSAL.test(s)) return { safe: false, reason: `ilaç ifadesi: "${med[0]}"` };
    const cond = s.match(CONDITION);
    if (!cond) continue;
    const def = s.match(DEFINITIVE);
    if (def && !REFUSAL.test(s)) return { safe: false, reason: `kesin ifade: "${def[0]}"` };
    if (!HEDGE.test(s) && !REFUSAL.test(s)) return { safe: false, reason: `ihtimal dili olmadan durum adı: "${cond[0]}"` };
  }
  return { safe: true };
}

export function isSafeAnswer(text: string): boolean {
  return checkAnswer(text).safe;
}
