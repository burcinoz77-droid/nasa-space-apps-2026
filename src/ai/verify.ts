// Parça 4 · Uydurma sayı kontrolü: cevaptaki her sayı, modele gönderilen veride var mı?
// Hepsi varsa "Doğrulandı" rozeti gösterilir; yoksa "Kontrol et" uyarısı.

function numbersIn(text: string): number[] {
  return (text.match(/-?\d+(?:[.,]\d+)?/g) ?? []).map((s) => Number(s.replace(',', '.')));
}

export function verifyNumbers(answer: string, context: unknown): boolean {
  const known = numbersIn(JSON.stringify(context));
  return numbersIn(answer).every((n) =>
    known.some((k) => Math.abs(k - n) <= Math.max(0.051, Math.abs(k) * 0.005)),
  );
}
