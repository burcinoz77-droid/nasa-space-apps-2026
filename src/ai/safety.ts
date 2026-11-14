// Parça 4 · Güvenlik süzgeci: modelin cevabı teşhis, ilaç ya da doz içeriyorsa gösterilmez.
// client.ts cevabı göstermeden önce isSafeAnswer() çağırır; güvensizse yedek cevap gösterilir
// ve konsola yazılır. Reddetme cümleleri ("Teşhis koyamam", "İlaç öneremem") güvenlidir.

/** Bu kalıplar nerede geçerse geçsin cevabı engeller (ilaç dozu ve doz talimatı). */
const ALWAYS_BLOCK: RegExp[] = [
  /\d\s*(mg|mcg|miligram|mikrogram)(?![a-zçğıöşü])/, // "400 mg"
  /doz(?:u|unu)?\s+(?:al|ver|uygula)(?:y?ın|y?in|sın|sin|malı|meli)/, // "doz alın", "dozu verin"
];

/** Bu ifadeler bir reddetme cümlesinde geçmiyorsa cevabı engeller. */
const MED_OR_DIAGNOSIS =
  /(ilaç|ilac|tablet|kapsül|antibiyotik|ibuprofen|parasetamol|aspirin|ağrı kesici|enjeksiyon|teşhis|tanı koy|tanısı|aritmi(?:si)? var|aritmi geçiriyor|kalp krizi geçiriyor|kriz geçiriyor|enfeksiyon(?:u)? var)/;

/** Reddetme ya da yönlendirme kalıpları ("öneremem", "koyamam", "yetkim yok"). */
const REFUSAL =
  /(öneremem|önermem|önermiyorum|öneremiyorum|veremem|koyamam|koymam|koyamıyorum|koymuyorum|söyleyemem|yapamam|edemem|değilim|yetkim yok|yetkisi yok|mümkün değil|uçuş doktorunun (?:işi|kararı|sorumluluğu|kararıdır))/;

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
    const m = s.match(MED_OR_DIAGNOSIS);
    if (m && !REFUSAL.test(s)) return { safe: false, reason: `teşhis/ilaç ifadesi: "${m[0]}"` };
  }
  return { safe: true };
}

export function isSafeAnswer(text: string): boolean {
  return checkAnswer(text).safe;
}
