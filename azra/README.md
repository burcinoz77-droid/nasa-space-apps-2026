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
| `src/psych/` | Psikolojik testler: NASA-TLX, Samn-Perelli, PVT-B (resmi maddeler, puanlama, test planı, psikolojik durum) |
| `src/ai/testdata.ts`, `src/ui/components/PsychTests.tsx` | Test sonuçlarının ASTRA'ya giden kopyası; Astronot Ekranı "Testler" sekmesi |
| `src/ai/*.test.ts`, `src/psych/psych.test.ts` | Testler (`npm run test`) ve canlı model testi |
| `docs/`, `README.md` | ASTRA belgeleri, test tablosu, yapay zekâ beyanı |

## Durum

- ASTRA yayında Gemini ile çalışıyor (Vercel ve Cloudflare); Claude'a geçiş seçeneği kodda duruyor ama kullanılmadı.
- Yerelde denemek için: `.env` dosyasına `GEMINI_API_KEY` yaz, `npm run dev`, sohbette hazır sorulardan birine bas.
- Canlı model testi (10 soru): `docs/test-sorulari.md`.

## Kalan işler

1. 30 saniyelik demo videosu (İngilizce altyazılı) ve en fazla 7 slaytlık İngilizce sunum.
2. Video ve sunum linklerini ana `README.md`'deki iki tabloya eklemek.
