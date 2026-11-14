// Parça 4 · Güvenlik süzgeci. Modelin cevabı gösterilmeden önce client.ts checkAnswer() çağırır;
// güvensizse yedek cevap gösterilir, sebep ve orijinal cevap konsola yazılır.
//
// Tasarım: SADECE gerçekten tehlikeli üç şeyi engeller, geri kalan her şey serbesttir.
//   1) İlaç ya da doz önerisi:        "400 mg verin", "ağrı kesici alsın", "dozu alın"
//   2) Kesin teşhis:                  "Kerem'de hipoksi var", "kesinlikle kalp krizi geçiriyor"
//   3) Kesin dışlama (yanlış güven):  "kalp krizi değil", "aritmi yok"
// Kelimenin geçmesi tek başına sorun değildir: "kesin bir teşhis olmayıp", "İlaç öneremem",
// "... ile uyumlu olabilir", "teşhis yerine geçmez" gibi cümleler her zaman geçer.
// Yeni bir yanlış engelleme görülürse cümleyi ai.test.ts'teki "geçmeli" listesine ekleyin.

const W = '[a-zçğıöşü]'; // Türkçe harf (ek sınırı için)

/** İlaç ve tıbbi uygulama adları. */
const MEDICATION = new RegExp(
  `(ilaç|ilac|tablet|kapsül|hap(?!${W})|antibiyotik|ibuprofen|parasetamol|aspirin|ağrı kesici|ateş düşürücü|enjeksiyon|iğne(?!${W})|serum)`,
);

/**
 * Öneri ya da talimat bildiren fiiller, tam kelime olarak ("verin", "alsın", "kullanılmalı").
 * Açık liste: "için", "alınan", "önerilir" gibi sık kelimeler yanlışlıkla yakalanmasın.
 */
const ADVISE = new RegExp(
  `(?<!${W})(verin|versin|verilsin|verilmeli|verilmelidir|verilebilir|verebilirsiniz|vermelisiniz|alın|alsın|alınmalı|alınmalıdır|alınabilir|almalı|almalıdır|alabilir|kullanın|kullansın|kullanılmalı|kullanılmalıdır|kullanılabilir|kullanmalı|kullanabilir|içsin|içmeli|içirin|içirilmeli|uygulayın|uygulansın|uygulanmalı|uygulanabilir|başlayın|başlansın|başlanmalı|başlanabilir|öneriyorum|önerebilirim|öneririz)(?!${W})`,
);

/** İlaç cümlesini güvenli yapan olumsuzluk ya da reddetme. */
const MED_REFUSAL = /(öneremem|önermem|öneremiyorum|önermiyorum|veremem|söyleyemem|yetkim yok|yetkili değil|vermeyin|kullanmayın|almayın|içmeyin|önerilmez|uygun değil)/;

/** Durum ve hastalık adları. */
const CONDITION =
  '(aritmi|ritim bozukluğu|kalp krizi|enfarktüs|hipoksi|hiperkapni|hipertermi|ısı çarpması|dehidratasyon|anksiyete|depresyon|enfeksiyon|radyasyon hastalığı|akut radyasyon sendromu|sendrom)';

/** "X var / X geçiriyor / X tespit edildi" — soru biçimi ("geçiriyor mu") hariç. */
const DEFINITE_CLAIM = new RegExp(
  `${CONDITION}${W}*\\s+(var|vardır|geçiriyor|geçirmektedir|yaşıyor|yaşamaktadır|tespit edildi|teşhis edildi|kesinleşti)(?!${W})(?!\\s+m[ıiuü](?!${W}))`,
);

/** Hayati durumlar: bunlar için kesin dışlama ("kalp krizi değil") yanlış güven verir. */
const LIFE_THREATENING = '(kalp krizi|enfarktüs|aritmi|ritim bozukluğu|inme|felç)';

/** "kalp krizi değil / aritmi yok / kalp krizi geçirmiyor" — sadece hayati durumlar için. */
const DEFINITE_EXCLUSION = new RegExp(
  `${LIFE_THREATENING}${W}*\\s+(yok|yoktur|değil|değildir|geçirmiyor|geçirmemektedir)(?!${W})(?!\\s+m[ıiuü](?!${W}))`,
);

/** Kesinlik sözcükleri; bir durum adıyla aynı cümlede geçerse kesin iddiadır. */
const CERTAINTY = /(kesinlikle|şüphesiz|hiç şüphe yok|tanısı konuldu|teşhis edildi|kesin olarak)/;

/** Cümleyi ihtimal ya da reddetme hâline getiren ifadeler. */
const SOFTENER =
  /(olabilir(?!sin)|olası|olasılı|ihtimal|düşündür|uyumlu|işaret edebilir|akla getir|şüphe(?!siz)|değerlendirilmeli|söyleyemem|doğrulayamam|koyamam|bilemem|dışlayamam|kesin değil|teşhis yerine geçmez|emin olamam)/;

export interface SafetyResult {
  safe: boolean;
  reason?: string;
}

export function checkAnswer(text: string): SafetyResult {
  const lower = text.toLocaleLowerCase('tr-TR');

  // Doz sayısı ya da doz talimatı: her zaman engellenir
  const dose = lower.match(new RegExp(`\\d\\s*(mg|mcg|miligram|mikrogram|ünite)(?!${W})`)) ?? lower.match(/doz(?:u|unu)?\s+(?:al|ver|uygula|artır)/);
  if (dose) return { safe: false, reason: `doz ifadesi: "${dose[0]}"` };

  for (const s of lower.split(/(?<=[.!?;])\s+|\n+/)) {
    const med = s.match(MEDICATION);
    if (med && ADVISE.test(s) && !MED_REFUSAL.test(s)) return { safe: false, reason: `ilaç önerisi: "${med[0]}"` };

    const claim = s.match(DEFINITE_CLAIM) ?? s.match(DEFINITE_EXCLUSION);
    if (claim && !SOFTENER.test(s)) return { safe: false, reason: `kesin ifade: "${claim[0]}"` };

    const certain = s.match(CERTAINTY);
    if (certain && new RegExp(CONDITION).test(s) && !/(söyleyemem|koyamam|doğrulayamam|bilemem)/.test(s)) {
      return { safe: false, reason: `kesinlik sözcüğü: "${certain[0]}"` };
    }
  }
  return { safe: true };
}

export function isSafeAnswer(text: string): boolean {
  return checkAnswer(text).safe;
}
