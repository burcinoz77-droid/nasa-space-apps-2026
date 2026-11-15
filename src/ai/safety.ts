// Parça 4 · Güvenlik süzgeci. Modelin cevabı gösterilmeden önce client.ts checkAnswer() çağırır;
// güvensizse yedek cevap gösterilir, sebep ve orijinal cevap konsola yazılır.
//
// Tasarım: SADECE gerçekten tehlikeli üç şeyi engeller, geri kalan her şey serbesttir.
//   1) İlaç ya da doz önerisi:        "give 400 mg", "she should take a painkiller", "take the dose"
//   2) Kesin teşhis:                  "Kerem has hypoxia", "he is definitely having a heart attack"
//   3) Kesin dışlama (yanlış güven):  "this is not a heart attack", "there is no arrhythmia"
// Kelimenin geçmesi tek başına sorun değildir: "this is not a definitive diagnosis", "I cannot recommend medication",
// "... may be consistent with ...", "this does not replace a diagnosis" gibi cümleler her zaman geçer.
// Yeni bir yanlış engelleme görülürse cümleyi ai.test.ts'teki "geçmeli" listesine ekleyin.
// (Uygulama İngilizce olduğu için süzgeç İngilizce kelimelerle çalışır; docs/GLOSSARY.md.)

/** İlaç ve tıbbi uygulama adları. */
const MEDICATION =
  /\b(medication|medicine|drugs?|tablets?|pills?|capsules?|antibiotics?|ibuprofen|acetaminophen|paracetamol|aspirin|painkillers?|pain relievers?|analgesics?|antipyretics?|injections?|iv fluids?|saline|sedatives?|sleeping pills?|zolpidem|melatonin|promethazine|ondansetron)\b/;

/**
 * Öneri ya da talimat bildiren fiiller, tam kelime olarak ("give", "should take", "administer").
 * Açık liste: "for", "taken", "recommended" gibi sık kelimeler yanlışlıkla yakalanmasın.
 */
const ADVISE =
  /\b(give|gives|given to|administer|administered|prescribe|prescribed|take|takes|should take|must take|can take|may take|use|should use|start|start on|apply|swallow|inject|i recommend|i suggest|i advise|we recommend|is recommended|are recommended|should be given|should be taken|should receive)\b/;

/** İlaç cümlesini güvenli yapan olumsuzluk ya da reddetme. */
const MED_REFUSAL =
  /\b(cannot|can't|can not|won't|will not|do not|don't|does not|must not|should not|never|not able to|not authori[sz]ed|not my role|only the flight surgeon|flight surgeon decides|flight surgeon's decision|is not recommended|not appropriate)\b/;

/** Durum ve hastalık adları. */
const CONDITION =
  '(arrhythmia|rhythm disorder|heart attack|myocardial infarction|infarction|hypoxia|hypoxemia|hypercapnia|hyperthermia|heat stroke|heatstroke|dehydration|anxiety disorder|anxiety|depression|infection|radiation sickness|acute radiation syndrome|syndrome)';

/** "X has hypoxia / is having a heart attack / was diagnosed with X" — soru cümlesi hariç. */
const DEFINITE_CLAIM = new RegExp(
  `\\b(has|have|is having|are having|is suffering from|suffers from|is experiencing|was diagnosed with|diagnosed with|is in|has developed|developed)\\s+(an?\\s+|acute\\s+)?${CONDITION}\\b|\\b${CONDITION}\\s+(is|was|has been)\\s+(confirmed|detected|diagnosed|present|occurring)\\b`,
);

/** Hayati durumlar: bunlar için kesin dışlama ("not a heart attack") yanlış güven verir. */
const LIFE_THREATENING = '(heart attack|myocardial infarction|infarction|arrhythmia|rhythm disorder|stroke)';

/** "this is not a heart attack / there is no arrhythmia / heart attack ruled out" — sadece hayati durumlar için. */
const DEFINITE_EXCLUSION = new RegExp(
  `\\b(is not|isn't|is no|not|no|there is no|there's no|without)\\s+(an?\\s+|sign of\\s+(an?\\s+)?)?${LIFE_THREATENING}\\b|\\b${LIFE_THREATENING}\\s+(is|has been|can be)\\s+(ruled out|excluded)\\b|\\bruled out\\s+(an?\\s+)?${LIFE_THREATENING}\\b`,
);

/** Kesinlik sözcükleri; bir durum adıyla aynı cümlede geçerse kesin iddiadır. */
const CERTAINTY = /\b(definitely|certainly|undoubtedly|without (a |any )?doubt|no doubt|diagnosed|confirmed diagnosis|for sure|clearly has)\b/;

/** Cümleyi ihtimal ya da reddetme hâline getiren ifadeler. */
const SOFTENER =
  /\b(may|might|could|possible|possibly|possibility|likely|unlikely|consistent with|suggests?|suggestive|raises?|points? to|concern|suspect|suspected|should be evaluated|cannot say|can't say|cannot confirm|can't confirm|cannot diagnose|can't diagnose|cannot rule out|can't rule out|not certain|not definitive|uncertain|does not replace|is not a diagnosis|not a diagnosis)\b/;

/** Cümle soru mu? ("Is Kerem having a heart attack?") */
const isQuestion = (s: string) => /\?\s*$/.test(s.trim());

export interface SafetyResult {
  safe: boolean;
  reason?: string;
}

export function checkAnswer(text: string): SafetyResult {
  const lower = text.toLocaleLowerCase('en-US');

  // Doz sayısı ya da doz talimatı: her zaman engellenir
  const dose =
    lower.match(/\d\s*(mg|mcg|µg|milligrams?|micrograms?|units?|ml)\b/) ??
    lower.match(/\b(take|give|administer|increase|double)\s+(the|a|one|two)?\s*doses?\b/);
  if (dose) return { safe: false, reason: `dose phrase: "${dose[0]}"` };

  for (const s of lower.split(/(?<=[.!?;])\s+|\n+/)) {
    if (isQuestion(s)) continue;
    const med = s.match(MEDICATION);
    if (med && ADVISE.test(s) && !MED_REFUSAL.test(s)) return { safe: false, reason: `medication advice: "${med[0]}"` };

    const claim = s.match(DEFINITE_CLAIM) ?? s.match(DEFINITE_EXCLUSION);
    if (claim && !SOFTENER.test(s)) return { safe: false, reason: `definitive statement: "${claim[0]}"` };

    const certain = s.match(CERTAINTY);
    if (certain && new RegExp(CONDITION).test(s) && !/\b(cannot|can't|unable to|not able to)\s+(say|confirm|diagnose|know)\b/.test(s)) {
      return { safe: false, reason: `certainty word: "${certain[0]}"` };
    }
  }
  return { safe: true };
}

export function isSafeAnswer(text: string): boolean {
  return checkAnswer(text).safe;
}
