# ASTRA · Katman 2 (yapay zekâ) nasıl çalışır

ASTRA, ARES-1 mürettebatının gemideki sağlık asistanıdır. Katman 1'in açtığı olayları 2–3 cümleyle
açıklar ve mürettebatın sorularını **sadece veriye dayanarak** Türkçe cevaplar. Dünya'daki uçuş
doktoruna mesajın gidip dönmesi 6–44 dakika sürer (NASA Mars Relay Network); ASTRA bu aralıkta
mürettebata destek olur.

## Yapamadıkları (kodda da geçerli)

| Kural | Nerede uygulanıyor |
| --- | --- |
| Uyarı açamaz, olay kapatamaz | Uyarıyı sadece Katman 1 (`src/engine/`) açar. `src/ai/` yalnızca `explanations` ve `chat` alanlarına yazar. |
| Veriyi değiştiremez, sistem çalıştıramaz | Sunucu fonksiyonu sadece metin döndürür; otonom adımları Katman 1 başlatır. |
| Teşhis koymaz, ilaç ya da doz önermez | Sistem talimatı + `src/ai/safety.ts` güvenlik süzgeci: "400 mg", "doz alın", "aritmi var" gibi ifadeler içeren cevap gösterilmez, yerine yedek cevap gelir ve konsola yazılır. "Teşhis koyamam", "İlaç öneremem" gibi reddetme cümleleri geçer. |
| Sayı uyduramaz | `src/ai/verify.ts`: cevaptaki her sayı modele giden veride aranır. Hepsi varsa yeşil **Sayılar doğrulandı**, yoksa amber **Sayıları kontrol et** rozeti. |
| İnternet yoksa susmaz | `src/ai/fallback.ts`: veriden kural tabanlı Türkçe cevap üretir; gri **Yedek mod · çevrimdışı** etiketiyle gösterilir. |

## Akış

```
Soru / yeni olay
  → src/ai/context.ts   kısa veri özeti (≈ 900–1.500 token)
  → src/ai/client.ts    60 sn önbellek, 12 sn zaman aşımı
  → POST /api/astra     (api/astra.ts: Gemini ya da Claude, fetch ile; anahtar sadece sunucuda)
  → src/ai/safety.ts    teşhis / ilaç süzgeci
  → src/ai/verify.ts    sayı doğrulama
  → ekranda mor kutu    (hata ya da bağlantı yoksa → src/ai/fallback.ts)
```

**Veri özeti** (`context.ts`): durumu normal olan kişi için 8 ana ölçüm (nabız, SpO₂, solunum,
çekirdek sıcaklık, doz hızı, toplam doz, CO₂, uyku); durumu normal olmayan, soruda adı geçen ya da
olayda etkilenen kişi için 33 ölçümün tamamı ve en çok sapan 3 sinyal. Ayrıca cevapta geçebilecek
sabitler: kariyer doz limiti 600 mSv (NASA-STD-3001), CO₂ dikkat/kritik sınırı 2,3 / 3,0 mmHg
(OCHMO-TB-004), Dünya gecikmesi. Herkes kritik olsa bile 3.000 token altında kalır (testli).

**Yedek mod şablonları**: olay türüne göre (RADIATION, CO2, FATIGUE, THERMAL, HYPOXIA, CARDIO,
STRESS, MULTI) güncel değerlerle; sohbette anahtar kelimeye göre (kim dinlenmeli, neden kritik,
radyasyon, CO₂, gecikme, belirli bir ölçüm, ilaç, teşhis, komut, rol dışı istek).

## Sağlayıcı geçişi

`.env` (yerel) ve Vercel ortam değişkenleri:

```
ASTRA_PROVIDER=gemini          # demo günü: claude
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.8-flash
GEMINI_FALLBACK_MODELS=gemini-3.5-flash-lite,gemini-3.7-flash  # ana model 503/429 verirse ya da 6 sn cevap vermezse sırayla denenir
ANTHROPIC_API_KEY=...
CLAUDE_MODEL=claude-haiku-5-5
```

Claude'da düşünme kapalı (`thinking: disabled`, `effort: low`); model bu alanları tanımazsa kod bir kez
onlarsız tekrar dener. Anahtar yoksa sunucu modeli hiç çağırmadan 503 döner, arayüz yedek moda geçer.
Vercel'de değişkeni değiştirdikten sonra **Redeploy** gerekir.

## Diğer parçalar için: olay açıklama kutusu

```tsx
import { AstraExplanation } from '../components/AstraExplanation';

<AstraExplanation incidentId={incident.id} />
```

Parça 3 bunu kritik olay bandının altına, Parça 2 Raporlar'daki olay satırının altına koyar. Aynı
olay iki yerde gösterilse de modele **bir kez** sorulur; sonuç `useAstra((s) => s.explanations[id])`
alanında saklanır.

## Testler

- `npm run test`: güvenlik süzgeci, sayı doğrulama, veri özeti boyutu, 10 test sorusunun yedek mod
  cevapları, olay şablonları, istemci (sahte fetch) ve sunucu fonksiyonu. Kota harcamaz.
- Canlı model testi: `docs/test-sorulari.md`.
