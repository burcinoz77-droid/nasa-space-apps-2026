// Part 4 · Made-up number check: is every number in the answer present in the data sent to the model?
// If all are, a green "Numbers verified" badge is shown; otherwise an amber "Check the numbers".
// The Turkish format is recognized too: "36,8 °C", "%87", "12 dk 30 sn".

/** Finds the numbers in a text. The sign is ignored ("6-44 min" -> 6 and 44). */
export function numbersIn(text: string): number[] {
  return (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((s) => Number(s.replace(',', '.')));
}

/**
 * @param answer  the model's answer
 * @param context the data summary sent to the model
 * @param question the user's question (repeating a number from the question is not making it up)
 */
export function verifyNumbers(answer: string, context: unknown, question = ''): boolean {
  const known = numbersIn(`${JSON.stringify(context)} ${question}`);
  return numbersIn(answer).every((n) => known.some((k) => Math.abs(k - n) <= Math.max(0.051, Math.abs(k) * 0.005)));
}
