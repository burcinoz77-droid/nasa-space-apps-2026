// Parça 4 · Yedek mod: internet ya da model yoksa, veriden kural tabanlı Türkçe cevap üretir.
// Sabit metin yerine güncel değerlerle doldurulan şablon kullanın; böylece yedek cevap da doğru olur.
// TODO Parça 4: olay türüne göre (RADIATION, CO2, FATIGUE ...) şablonlar ekleyin.
import type { AstraAnswer, AstraRequest } from '../types';

export function fallbackAnswer(req: AstraRequest): AstraAnswer {
  const text =
    req.mode === 'incident'
      ? 'Bağlantı yok; olay Katman 1 tarafından açıldı ve kayda geçti. Olay kartındaki değerleri kontrol edin ve önerilen güvenli adımı uygulayın. Bu konuda uçuş doktoruna danışmayı öneririm.'
      : 'Şu an dil modeline ulaşılamıyor; yedek moddayım. Ekrandaki Katman 1 uyarıları güncel ve geçerli. Bu konuda uçuş doktoruna danışmayı öneririm.';
  return { text, source: 'fallback', verified: true, latencyMs: 0 };
}
