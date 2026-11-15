// Part 4 · Safety filter. client.ts calls checkAnswer() before the model's answer is shown;
// if unsafe, an offline answer is shown and the reason and original answer are logged to the console.
//
// Design: blocks ONLY three genuinely dangerous things; everything else is allowed.
//   1) Medication or dose advice:      "give 400 mg", "he should take a painkiller", "take the dose"
//   2) Definitive diagnosis:           "Kerem has hypoxia", "he is definitely having a heart attack"
//   3) Definitive exclusion (false reassurance): "not a heart attack", "no arrhythmia"
// The word appearing is not a problem by itself: "this is not a definitive diagnosis", "I cannot recommend medication",
// "... may be consistent with", "does not replace a diagnosis" and similar sentences always pass.
// If a new false block shows up, add the sentence to the "should pass" list in ai.test.ts.

const W = '[a-zçğıöşü]'; // Turkish letters (for suffix boundaries)

/** Medication and medical procedure names. */
const MEDICATION = new RegExp(
  `(ilaç|ilac|tablet|kapsül|hap(?!${W})|antibiyotik|ibuprofen|parasetamol|aspirin|ağrı kesici|ateş düşürücü|enjeksiyon|iğne(?!${W})|serum|medication|medicine|drug(?!${W})|drugs|pill|pills|capsule|antibiotic|paracetamol|acetaminophen|painkiller|pain reliever|injection|iv fluids)`,
);

/**
 * Verbs that express advice or an instruction, as whole words ("give", "should take", "must be used").
 * Explicit list, so common words like "for", "taken", "is recommended" are not caught by mistake.
 */
const ADVISE = new RegExp(
  `(?<!${W})(verin|versin|verilsin|verilmeli|verilmelidir|verilebilir|verebilirsiniz|vermelisiniz|alın|alsın|alınmalı|alınmalıdır|alınabilir|almalı|almalıdır|alabilir|kullanın|kullansın|kullanılmalı|kullanılmalıdır|kullanılabilir|kullanmalı|kullanabilir|içsin|içmeli|içirin|içirilmeli|uygulayın|uygulansın|uygulanmalı|uygulanabilir|başlayın|başlansın|başlanmalı|başlanabilir|öneriyorum|önerebilirim|öneririz|give|should take|take|administer|should be given|should receive|start|prescribe|i recommend|recommend taking|use)(?!${W})`,
);

/** Negation or refusal that makes a medication sentence safe. */
const MED_REFUSAL = /(öneremem|önermem|öneremiyorum|önermiyorum|veremem|söyleyemem|yetkim yok|yetkili değil|vermeyin|kullanmayın|almayın|içmeyin|önerilmez|uygun değil|cannot recommend|can't recommend|can not recommend|do not recommend|don't recommend|not able to recommend|unable to recommend|cannot advise|not authorized|do not take|don't take|should not)/;

/** Condition and disease names. */
const CONDITION =
  '(aritmi|ritim bozukluğu|kalp krizi|enfarktüs|hipoksi|hiperkapni|hipertermi|ısı çarpması|dehidratasyon|anksiyete|depresyon|enfeksiyon|radyasyon hastalığı|akut radyasyon sendromu|sendrom|arrhythmia|heart attack|myocardial infarction|infarction|hypoxia|hypercapnia|hyperthermia|heat stroke|dehydration|anxiety|depression|infection|radiation sickness|acute radiation syndrome|syndrome)';

/** "has X / is having X / X was detected" — excluding the question form ("is he having"). */
const DEFINITE_CLAIM = new RegExp(
  `${CONDITION}${W}*\\s+(var|vardır|geçiriyor|geçirmektedir|yaşıyor|yaşamaktadır|tespit edildi|teşhis edildi|kesinleşti)(?!${W})(?!\\s+m[ıiuü](?!${W}))`,
);

/** English definitive claim: "has hypoxia", "is suffering from", "hypoxia is present / confirmed". */
const DEFINITE_CLAIM_EN = new RegExp(
  `((has|is having|is suffering from|suffers from|is experiencing)\\s+(an?\\s+)?${CONDITION})|(${CONDITION}\\s+(is present|is confirmed|has been confirmed|has been detected|was detected))`,
);

/** English definitive exclusion: "not a heart attack", "no arrhythmia", "is not having a stroke". */
const DEFINITE_EXCLUSION_EN = new RegExp(`((is not|isn't|not|no|is not having|isn't having)\\s+(an?\\s+)?${LIFE_THREATENING_EN()})`);
function LIFE_THREATENING_EN() {
  return '(heart attack|infarction|arrhythmia|stroke)';
}

/** Life-threatening conditions: a definitive exclusion for these ("not a heart attack") gives false reassurance. */
const LIFE_THREATENING = '(kalp krizi|enfarktüs|aritmi|ritim bozukluğu|inme|felç|heart attack|infarction|arrhythmia|stroke)';

/** "not a heart attack / no arrhythmia / is not having a heart attack" — only for life-threatening conditions. */
const DEFINITE_EXCLUSION = new RegExp(
  `${LIFE_THREATENING}${W}*\\s+(yok|yoktur|değil|değildir|geçirmiyor|geçirmemektedir)(?!${W})(?!\\s+m[ıiuü](?!${W}))`,
);

/** Certainty words; in the same sentence as a condition name they make a definitive claim. */
const CERTAINTY = /(kesinlikle|şüphesiz|hiç şüphe yok|tanısı konuldu|teşhis edildi|kesin olarak|definitely|certainly|undoubtedly|without doubt|has been diagnosed|is diagnosed|diagnosed with)/;

/** Phrases that turn a sentence into a possibility or a refusal. */
const SOFTENER =
  /(olabilir(?!sin)|olası|olasılı|ihtimal|düşündür|uyumlu|işaret edebilir|akla getir|şüphe(?!siz)|değerlendirilmeli|söyleyemem|doğrulayamam|koyamam|bilemem|dışlayamam|kesin değil|teşhis yerine geçmez|emin olamam|may |might|could|possible|possibly|likely|consistent with|suggest|raises the possibility|cannot confirm|can't confirm|cannot say|cannot rule out|can't rule out|not certain|not a diagnosis|should be evaluated|unable to confirm)/;

export interface SafetyResult {
  safe: boolean;
  reason?: string;
}

export function checkAnswer(text: string): SafetyResult {
  const lower = text.toLowerCase();

  // A dose number or dose instruction: always blocked
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
