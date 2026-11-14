# Azra – çalışma klasörü

Sahibi: @azracetin335815-ux · **Parça 4 · ASTRA AI (Katman 2)** · dal: `azra/ai`

Plan gereği kod bu klasörde değil, ortak uygulamanın içinde. Parça 4'ün dosyaları:

| Dosya | Ne yapar |
| --- | --- |
| `api/astra.ts` | Sunucu fonksiyonu: sistem talimatı, Gemini ↔ Claude, anahtar kontrolü |
| `src/ai/context.ts` | Modele giden kısa veri özeti (8 ana ölçüm / tüm ölçümler, sabitler) |
| `src/ai/client.ts` | Önbellek, zaman aşımı, güvenlik süzgeci, yedek moda geçiş |
| `src/ai/safety.ts` | Teşhis / ilaç / doz süzgeci |
| `src/ai/verify.ts` | Cevaptaki sayıları veriyle karşılaştırır |
| `src/ai/fallback.ts` | Yedek mod: güncel değerli Türkçe şablonlar |
| `src/ai/explain.ts`, `src/ui/components/AstraExplanation.tsx` | Olay kartındaki mor "ASTRA açıklaması" |
| `src/ui/components/AstraChatPanel.tsx` | Sohbet paneli |
| `src/ui/pages/Gorevler.tsx` | Görevler sayfası |
| `src/ai/*.test.ts` | Testler (`npm run test`) ve canlı model testi |
| `docs/`, `README.md` | ASTRA belgeleri, test tablosu, yapay zekâ beyanı |

## Sıradaki adımlar

1. `.env` dosyasına `GEMINI_API_KEY` yaz, `npm run dev`, sohbette hazır sorulardan birine bas.
2. 10 soruyu gerçek modelle test et: `docs/test-sorulari.md`.
3. Pazar 12.00: `.env` ve Vercel'de `ASTRA_PROVIDER=claude` + `ANTHROPIC_API_KEY`, Vercel'de Redeploy, testi tekrar çalıştır.
