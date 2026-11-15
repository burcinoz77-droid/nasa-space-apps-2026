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
  `(ilaç|ilac|tablet|kapsül|hap(?!${W})|antibiyotik|ibuprofen|parasetamol|aspirin|ağrı kesici|ateş düşürücü|enjeksiyon|iğne(?!${W})|serum|medication|medicine|drug(?!${W})|drugs|pill|pills|capsule|antibiotic|paracetamol|acetaminophen|painkiller|pain reliever|injection|iv fluids)`,
);

/**
 * Öneri ya da talimat bildiren fiiller, tam kelime olarak ("verin", "alsın", "kullanılmalı").
 * Açık liste: "için", "alınan", "önerilir" gibi sık kelimeler yanlışlıkla yakalanmasın.
 */
const ADVISE = new RegExp(
  `(?<!${W})(verin|versin|verilsin|verilmeli|verilmelidir|verilebilir|verebilirsiniz|vermelisiniz|alın|alsın|alınmalı|alınmalıdır|alınabilir|almalı|almalıdır|alabilir|kullanın|kullansın|kullanılmalı|kullanılmalıdır|kullanılabilir|kullanmalı|kullanabilir|içsin|içmeli|içirin|içirilmeli|uygulayın|uygulansın|uygulanmalı|uygulanabilir|başlayın|başlansın|başlanmalı|başlanabilir|öneriyorum|önerebilirim|öneririz|give|should take|take|administer|should be given|should receive|start|prescribe|i recommend|recommend taking|use)(?!${W})`,
);

/** İlaç cümlesini güvenli yapan olumsuzluk ya da reddetme. */
const MED_REFUSAL = /(öneremem|önermem|öneremiyorum|önermiyorum|veremem|söyleyemem|yetkim yok|yetkili değil|vermeyin|kullanmayın|almayın|içmeyin|önerilmez|uygun değil|cannot recommend|can't recommend|can not recommend|do not recommend|don't recommend|not able to recommend|unable to recommend|cannot advise|not authorized|do not take|don't take|should not)/;

/** Durum ve hastalık adları. */
const CONDITION =
  '(aritmi|ritim bozukluğu|kalp krizi|enfarktüs|hipoksi|hiperkapni|hipertermi|ısı çarpması|dehidratasyon|anksiyete|depresyon|enfeksiyon|radyasyon hastalığı|akut radyasyon sendromu|sendrom|arrhythmia|heart attack|myocardial infarction|infarction|hypoxia|hypercapnia|hyperthermia|heat stroke|dehydration|anxiety|depression|infection|radiation sickness|acute radiation syndrome|syndrome)';

/** "X var / X geçiriyor / X tespit edildi" — soru biçimi ("geçiriyor mu") hariç. */
const DEFINITE_CLAIM = new RegExp(
  `${CONDITION}${W}*\\s+(var|vardır|geçiriyor|geçirmektedir|yaşıyor|yaşamaktadır|tespit edildi|teşhis edildi|kesinleşti)(?!${W})(?!\\s+m[ıiuü](?!${W}))`,
);

/** İngilizce kesin iddia: "has hypoxia", "is suffering from", "hypoxia is present / confirmed". */
const DEFINITE_CLAIM_EN = new RegExp(
  `((has|is having|is suffering from|suffers from|is experiencing)\\s+(an?\\s+)?${CONDITION})|(${CONDITION}\\s+(is present|is confirmed|has been confirmed|has been detected|was detected))`,
);

/** İngilizce kesin dışlama: "not a heart attack", "no arrhythmia", "is not having a stroke". */
const DEFINITE_EXCLUSION_EN = new RegExp(`((is not|isn't|not|no|is not having|isn't having)\\s+(an?\\s+)?${LIFE_THREATENING_EN()})`);
function LIFE_THREATENING_EN() {
  return '(heart attack|infarction|arrhythmia|stroke)';
}

/** Hayati durumlar: bunlar için kesin dışlama ("kalp krizi değil") yanlış güven verir. */
const LIFE_THREATENING = '(kalp krizi|enfarktüs|aritmi|ritim bozukluğu|inme|felç|heart attack|infarction|arrhythmia|stroke)';

/** "kalp krizi değil / aritmi yok / kalp krizi geçirmiyor" — sadece hayati durumlar için. */
const DEFINITE_EXCLUSION = new RegExp(
  `${LIFE_THREATENING}${W}*\\s+(yok|yoktur|değil|değildir|geçirmiyor|geçirmemektedir)(?!${W})(?!\\s+m[ıiuü](?!${W}))`,
);

/** Kesinlik sözcükleri; bir durum adıyla aynı cümlede geçerse kesin iddiadır. */
const CERTAINTY = /(kesinlikle|şüphesiz|hiç şüphe yok|tanısı konuldu|teşhis edildi|kesin olarak|definitely|certainly|undoubtedly|without doubt|has been diagnosed|is diagnosed|diagnosed with)/;

/** Cümleyi ihtimal ya da reddetme hâline getiren ifadeler. */
const SOFTENER =
  /(olabilir(?!sin)|olası|olasılı|ihtimal|düşündür|uyumlu|işaret edebilir|akla getir|şüphe(?!siz)|değerlendirilmeli|söyleyemem|doğrulayamam|koyamam|bilemem|dışlayamam|kesin değil|teşhis yerine geçmez|emin olamam|may |might|could|possible|possibly|likely|consistent with|suggest|raises the possibility|cannot confirm|can't confirm|cannot say|cannot rule out|can't rule out|not certain|not a diagnosis|should be evaluated|unable to confirm)/;

export interface SafetyResult {
  safe: boolean;
  reason?: string;
}

export function checkAnswer(text: string): SafetyResult {
  const lower = text.toLowerCase();

  // Doz sayısı ya da doz talimatı: her zaman engellenir
  const dose =
    lower.match(new RegExp(`\\d\\s*(mg|mcg|miligram|mikrogram|milligrams?|micrograms?|ünite|units?)(?!${W})`)) ??
    lower.match(/doz(?:u|unu)?\s+(?:al|ver|uygula|artır)/) ??
    lower.match(/(?:take|give|increase|administer)\s+(?:a\s+|the\s+)?dose/);
  if (dose) return { safe: false, reason: `dose expression: "${dose[0]}"` };

  for (const s of lower.split(/(?<=[.!?;])\s+|\n+/)) {
    const med = s.match(MEDICATION);
    if (med && ADVISE.test(s) && !MED_REFUSAL.test(s)) return { safe: false, reason: `medication advice: "${med[0]}"` };

    const claim = s.match(DEFINITE_CLAIM) ?? s.match(DEFINITE_EXCLUSION) ?? s.match(DEFINITE_CLAIM_EN) ?? s.match(DEFINITE_EXCLUSION_EN);
    if (claim && !SOFTENER.test(s)) return { safe: false, reason: `definitive statement: "${claim[0]}"` };

    const certain = s.match(CERTAINTY);
    if (certain && new RegExp(CONDITION).test(s) && !/(söyleyemem|koyamam|doğrulayamam|bilemem|cannot say|cannot confirm|can't confirm|cannot give)/.test(s)) {
      return { safe: false, reason: `certainty word: "${certain[0]}"` };
    }
  }
  return { safe: true };
}

export function isSafeAnswer(text: string): boolean {
  return checkAnswer(text).safe;
}
