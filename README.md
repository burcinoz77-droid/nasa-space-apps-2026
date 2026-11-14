# Orbitalis · ASTRA — astronot sağlık izleme ve karar desteği

NASA Space Apps Challenge 2026 · Bursa · Takım FLOW
Challenge: *Create Health Monitoring Software for Astronauts on Space Missions*

> "Uçuş doktoru 44 dakikaya kadar uzakta. ASTRA ise tam burada."

ASTRA, ARES-1 Mars görevindeki 6 astronotun 5 veri grubundaki ölçümlerini canlı izler.
**Katman 1** gemide internetsiz çalışır: kişisel baseline, z-skoru, erken uyarı ve önceden
onaylı güvenli adımlar. **Katman 2** bir dil modelidir: olayları Türkçe açıklar ve soruları
sadece veriye dayanarak cevaplar. Karar her zaman mürettebatındır.

## Çalıştırma

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env  — sonra anahtarı yazın
npm run dev               # http://localhost:5173
```

Anahtar yoksa da çalışır: ASTRA sohbeti yedek moda geçer.

| Komut | Ne yapar |
| --- | --- |
| `npm run dev` | Uygulama + yerel `/api/astra` |
| `npm run build` | Yayın paketi (`dist/`) |
| `npm run typecheck` | Tip kontrolü |
| `npm run test` | Vitest testleri |
| `ASTRA_LIVE=1 npx vitest run src/ai/astra.live.test.ts` | 10 test sorusunu gerçek modele sorar (bkz. `docs/test-sorulari.md`) |

## Klasörler ve sahipleri

| Yol | Ne | Sahibi |
| --- | --- | --- |
| `src/types.ts` | Ortak veri sözleşmesi | Herkes (değiştirmeden önce gruba yaz) |
| `src/metrics.ts`, `src/crew.ts` | Ölçüm kataloğu, mürettebat | Parça 1 |
| `src/sim/` | Simülasyon motoru, `parameters.ts`, senaryolar | Parça 1 |
| `src/engine/` | Katman 1: anomali tespiti, olaylar, otonom adımlar | Parça 2 |
| `src/ui/` | Ekranlar, renk sistemi | Parça 3 (Raporlar: Parça 2, Ayarlar: Parça 1, Görevler: Parça 4) |
| `api/astra.ts`, `src/ai/` | Katman 2: ASTRA yapay zekâsı | Parça 4 |
| `src/loop.ts`, `src/store.ts` | Parçaları bağlayan döngü ve ortak durum | Herkes (gruba yaz) |
| `docs/` | Sunum, kaynaklar, ASTRA belgeleri | Parça 4 |

## ASTRA (Katman 2) kısaca

- Olay açıklaması ve sohbet: Türkçe, en fazla 4 cümle, sadece veriye dayanır. Ayrıntı: `docs/ASTRA.md`.
- Kesin teşhis koymaz: değişen değerlere dayanarak olası durumları ihtimal diliyle söyler ("... ile uyumlu olabilir") ve medikal kontrol önerir. İlaç önermez, uyarı açamaz, veriyi değiştiremez. Güvenlik süzgeci kesin ifade ya da ilaç içeren cevabı göstermez.
- Araç kullanımı (6 salt-okur araç), kaynaklı bilgi tabanı, uzun dönem veri hafızası ve son 10 mesajı hatırlayan sohbet; sohbet sayfa yenilense de devam eder, "Sohbeti sıfırla" ile temizlenir.
- Cevaptaki her sayı veride aranır: **Sayılar doğrulandı** / **Sayıları kontrol et** rozeti.
- İnternet ya da anahtar yoksa **Yedek mod**: cevaplar veriden kural tabanlı üretilir; gemideki döngü zaten internetsiz çalışır.
- Diğer ekranlarda olay açıklaması: `<AstraExplanation incidentId={incident.id} />`.

## Veri ve kaynaklar

Tüm astronot verileri sentetiktir (simülasyon). Parametreler NASA ve hakemli kaynaklardan
alınmıştır; her sabitin kaynağı `src/sim/parameters.ts` içinde yazılıdır. Kaynağı olmayan
değerler arayüzde "Varsayım" olarak işaretlenir.

## Yapay zekâ kullanım beyanı

NASA Space Apps kuralı gereği kullanılan veri, araç ve yapay zekâ burada belirtilir.

**Uygulamanın içinde (ürünün parçası)**
- Katman 2 (ASTRA): Google Gemini (`gemini-3.8-flash`, geliştirme) ve Anthropic Claude Haiku 5.5 (`claude-haiku-5-5`, demo). Sunucu fonksiyonundan REST ile çağrılır; anahtarlar yalnızca sunucuda durur.
- Dil modeli yalnızca okur: olayları açıklar, soruları cevaplar ve veriye dayalı olası durumları ihtimal olarak belirtir. Uyarı açamaz, telemetriyi, olayları ya da otonom adımları değiştiremez. Kesin teşhis ve ilaç içeren cevaplar güvenlik süzgecinde durdurulur; cevaptaki sayılar veriyle karşılaştırılır.

**Geliştirme sırasında**
- Anthropic Claude: planlama, kod iskeleti, kaynak taraması ve Parça 4 (ASTRA) kodunun yazımında yardımcı olarak kullanıldı. Üretilen kod ekip tarafından gözden geçirildi ve testlerle (`npm run test`) doğrulandı.
- Katman 1'in karar mantığı (eşikler, kurallar) ekip tarafından yazılmıştır.

**Veri ve görseller**
- Tüm astronot verileri sentetiktir (simülasyon); gerçek bir kişinin sağlık verisi kullanılmaz. Parametre kaynakları `src/sim/parameters.ts` içindedir (NASA HRP, NASA-STD-3001, OCHMO-TB-004, OSDR EDA, DONKI, hakemli çalışmalar).
- Görevler sayfasındaki görsel, projeye özel temsilî bir SVG çizimdir. NASA logosu ya da NASA'ya ait görsel kullanılmamıştır; proje NASA tarafından onaylanmış değildir.

## Lisans

Apache 2.0 — bkz. `LICENSE`.
