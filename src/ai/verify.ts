// Parça 4 · Uydurma sayı kontrolü: cevaptaki her sayı, modele gönderilen veride var mı?
// Hepsi varsa yeşil "Sayılar doğrulandı" rozeti gösterilir; yoksa amber "Sayıları kontrol et".
// İngilizce biçim: "36.8 °C", "87%", "12 min 30 s"; binlik ayırıcı virgül ("1,344" -> 1344).

/** Metindeki sayıları bulur. İşaret dikkate alınmaz ("6-44 min" -> 6 ve 44). */
export function numbersIn(text: string): number[] {
  return (text.match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g) ?? []).map((s) => Number(s.replace(/,/g, '')));
}

/**
 * @param answer  modelin cevabı
 * @param context modele gönderilen veri özeti
 * @param question kullanıcının sorusu (soruda geçen sayıyı tekrar etmek uydurma değildir)
 */
export function verifyNumbers(answer: string, context: unknown, question = ''): boolean {
  const known = numbersIn(`${JSON.stringify(context)} ${question}`);
  return numbersIn(answer).every((n) => known.some((k) => Math.abs(k - n) <= Math.max(0.051, Math.abs(k) * 0.005)));
}
