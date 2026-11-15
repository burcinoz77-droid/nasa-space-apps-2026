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
| Kesin teşhis koymaz, ilaç ya da doz önermez | `src/ai/safety.ts` sadece gerçekten tehlikeli üç şeyi engeller: ilaç ya da doz önerisi ("400 mg verin", "ağrı kesici alsın"), kesin teşhis ("Kerem'de hipoksi var", "kesinlikle kalp krizi geçiriyor") ve hayati durumlarda kesin dışlama ("kalp krizi değil"). Kelimenin geçmesi sorun değildir: "kesin bir teşhis olmayıp", "İlaç öneremem", "... ile uyumlu olabilir" geçer. Engellenen cevabın yerine yedek cevap gelir; ekranda "Yedek cevap · güvenlik süzgeci" yazar, sebep konsolda görünür. `ai.test.ts`'te 19 "geçmeli" ve 10 "engellenmeli" gerçekçi cümle var; yeni bir yanlış engelleme görülürse o cümle listeye eklenir. |
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
olayda etkilenen kişi için 36 ölçümün tamamı ve en çok sapan 3 sinyal. Ayrıca cevapta geçebilecek
sabitler: kariyer doz limiti 600 mSv (NASA-STD-3001), CO₂ dikkat/kritik sınırı 2,3 / 3,0 mmHg
(OCHMO-TB-004), Dünya gecikmesi. Herkes kritik olsa bile 3.000 token altında kalır (testli).

**Yedek mod şablonları**: olay türüne göre (RADIATION, CO2, FATIGUE, THERMAL, HYPOXIA, CARDIO,
STRESS, MULTI) güncel değerlerle; sohbette anahtar kelimeye göre (kim dinlenmeli, neden kritik,
radyasyon, CO₂, gecikme, belirli bir ölçüm, ilaç, teşhis, komut, rol dışı istek).

## Araç kullanımı, bağlam ve çok turlu sohbet

Mentor önerisiyle ASTRA üç yetenekle çalışır:

| Yetenek | Ne yapar | Nerede |
| --- | --- | --- |
| **Araç kullanımı (tool calling)** | Model, cevap için gereken ayrıntıyı 6 salt-okur araçla kendisi çeker: `get_crew_member` (bir astronotun 36 ölçümü kişisel normalleriyle, skorları, açık olayları), `get_metric_trend` (yakın ve uzun dönem gidiş: artıyor / azalıyor / sabit), `assess_possible_conditions` (veriye dayalı olası durumlar), `list_incidents`, `get_event_log`, `lookup_reference` (eşik, limit ve bilimsel kaynak). Gemini'de `functionCall`, Claude'da `tool_use` ile; en fazla 3 tur. Kullanılan araçlar cevabın altında "⚙ Kullanılan araçlar" satırında görünür. | `api/astra.ts` (`TOOLS`, `runTool`) |
| **Bağlam (context)** | Her soruda kısa bir canlı veri özeti (herkes için 8 ana ölçüm, sorunlu kişilerin en çok sapan sinyalleri, açık olaylar, sabitler) + araçların okuduğu anlık veri kopyası + NASA ve hakemli kaynaklı bilgi tabanı. | `src/ai/context.ts`, `src/ai/tooldata.ts`, `src/ai/knowledge.ts` |
| **Çok turlu sohbet (multi-turn)** | Son 10 mesaj modele gider; "Peki Kerem?" gibi devam soruları anlaşılır. Sohbet sayfa yenilense de devam eder. | `src/ai/client.ts`, `api/astra.ts` (`cleanHistory`) |

Araçlar hiçbir şeyi değiştiremez: sadece tarayıcının gönderdiği veri kopyasını okur. Model araç tanımlarını kabul
etmezse sunucu araçsız ve ayrıntılı veriyle bir kez daha sorar. Olay açıklamaları hız için araçsız, tek adımdır.

## Olası durum tahmini (kesin teşhis değil)

Ekip kararıyla ASTRA, değişen değerlere dayanarak olası durumları söyleyebilir. `src/ai/conditions.ts` her
astronotun ölçümlerini kişisel normaliyle karşılaştırır (z ≥ 2,5 ya da mutlak eşik) ve 9 kuraldan uyanları
döndürür: CO₂ birikmesi (hiperkapni), hipoksi, ısı stresi ve aşırı efor, sıvı-elektrolit kaybı, kalp ritim
düzensizliği olasılığı, uyku yoksunluğu ve yorgunluk, akut stres yükü, SANS şüphesi, radyasyon maruziyetinde
artış. Her sonuçta dayanak sinyaller (güncel değer + kişisel normal), olasılık (düşük / orta; asla "kesin"),
önerilen kontrol ve kaynak bulunur. Model bunu `assess_possible_conditions` aracıyla okur ve şu sırayla
anlatır: hangi değerler nasıl değişti → "... ile uyumlu olabilir" → kesin olmadığı ve medikal kontrol.
Normal günde 200 ölçüm boyunca yanlış tahmin çıkmadığı testlidir.

## Ortam ölçümleri ve sistemde ölçülmeyen konular

NASA HRP'nin "kapalı ortam" tehlikesini karşılamak için çevre grubuna üç canlı ölçüm eklendi (toplam 36 ölçüm):

| Ölçüm | Normal değer | Dayanak |
|---|---|---|
| Ortam sıcaklığı (`env.ambientTemp_C`) | 22,5 °C | NASA-STD-3001 performans bölgesi 20–25 °C, sağlık sınırı 18–27 °C (OCHMO-TB-002) |
| Ortam nemi (`env.humidity_pct`) | %45 | Performans bölgesi %30–60, sağlık sınırı %25–75 (OCHMO-TB-002) |
| Ortam gürültüsü (`env.noise_dBA`) | 55 dBA (varsayım) | Sürekli gürültü sınırı NC-50, yaklaşık 58 dBA (OCHMO-TB-035); ISS sınırı 16 sa çalışmada 72 dBA, 8 sa uykuda 62 dBA |

Senaryolar bu üç ölçümü değiştirmez; normal değerlerinde kalırlar.

**Resmi normal aralık kuralı (Katman 1):** Kaynağında açık bir normal aralık olan ölçümlerde değer bu aralıktaysa yeni
uyarı açılmaz; açık bir uyarı varsa histerezisle iner (`src/sim/parameters.ts` → `normalRangeFor`, `src/engine/index.ts`).
Aralıklar: SpO₂ %96–100 (NIH), dinlenme solunumu 12–20/dk ve EtCO₂ 35–45 mmHg (JEMS), EVA nabzı 100–110 bpm (NASA Apollo),
kabin CO₂ ≤ 2,3 mmHg (OCHMO), ortam 20–25 °C ve nem %30–60 (NASA-STD-3001), gürültü ≤ 72 dBA (ISS). Ayarlar'daki
"Veri kaynakları" tablosunda "Normal aralık" sütununda görünür.

Kemik, bağışıklık, denge, ekip uyumu, kabin mikropları ve göz yapısı (SANS) sistemde ölçülmez. ASTRA bunlar
sorulunca önce ölçülmediğini söyler, sonra `lookup_reference` (`kemik`, `goz`, `olculmeyenler`, `yercekimi`, `ortam`)
ya da bağlamdaki `sabitler` alanından NASA'nın genel bilgisini kaynağıyla ve "kişisel ölçüm değil, tahmin" diyerek verir.
Örnek: kemik yoğunluğu kaybı NASA'ya göre ayda %1–1,5; 180. gün için kabaca %6–9 (`boneLossEstimate`).
Yedek mod da aynı cevapları kurallı olarak verir.

## Hafıza

- **Veri hafızası** (`src/ai/memory.ts`): 36 ölçümün kişisel normali (ilk 30 ölçüm) ve her 5 ölçümde bir
  kayıtla en fazla 72 kayıtlık uzun geçmiş (yaklaşık 60 saat görev süresi). `get_metric_trend` yakın ve uzun
  dönem gidişi birlikte verir. "Simülasyonu sıfırla" ile sıfırlanır.
- **Sohbet hafızası**: son 10 mesaj modele gider. Sohbet tarayıcıda saklanır (`src/ai/chatStore.ts`); panel
  kapatılıp açılınca ya da sayfa yenilenince devam eder. Panelin altındaki **Sohbeti sıfırla** düğmesi temizler.

## Üslup ve sohbet

ASTRA resmî ve saygılı konuşur ("siz" dili, emoji ve günlük ifade yok) ama cevabın biçimini soruya göre
ayarlar: selama kısa bir tanıtımla, tek değer sorusuna değer + birimle, "neden" sorusuna gözlem → önem →
yapılacak adım sırasıyla cevap verir. Sohbetin son 10 mesajı modele gider; "Peki Kerem?" gibi devam soruları
anlaşılır. Örnek cevaplar `api/astra.ts` içindeki `SYSTEM_PROMPT`'ta.

## Sağlayıcı geçişi

`.env` (yerel) ve Vercel ortam değişkenleri:

```
ASTRA_PROVIDER=gemini          # demo günü: claude
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.8-flash
GEMINI_FALLBACK_MODELS=gemini-3.5-flash-lite,gemini-3.7-flash  # ana model 503/429 verirse ya da 12 sn cevap vermezse sırayla denenir
GEMINI_MODEL_TIMEOUT_MS=12000  # bir isteğin bekleme süresi; canlıda ölçülen ~6,7 sn, bunun altına indirmeyin
ANTHROPIC_API_KEY=...
CLAUDE_MODEL=claude-haiku-5-5
```

Claude'da düşünme kapalı (`thinking: disabled`, `effort: low`); model bu alanları tanımazsa kod bir kez
onlarsız tekrar dener. Anahtar yoksa sunucu modeli hiç çağırmadan 503 döner, arayüz yedek moda geçer.
Vercel'de değişkeni değiştirdikten sonra **Redeploy** gerekir.

**Süreler:** Canlı sitede Gemini bir isteğe yaklaşık 6,7 sn'de cevap veriyor. Bir isteğin bekleme süresi 12 sn,
toplam süre 35 sn (araç kullanan sorular 2 istek sürer); yedek modele ancak en az 8 sn kalmışsa geçilir.
İstemci 38 sn bekler. Vercel'de fonksiyon süre sınırı `vercel.json`'da 60 sn. Sunucu terminalinde (ya da Vercel
loglarında) `[ASTRA] gemini-... cevap verdi: X sn` satırı gerçek süreyi gösterir.

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
