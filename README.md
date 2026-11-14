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
| `docs/` | Sunum, kaynaklar | Parça 4 |

## Veri ve kaynaklar

Tüm astronot verileri sentetiktir (simülasyon). Parametreler NASA ve hakemli kaynaklardan
alınmıştır; her sabitin kaynağı `src/sim/parameters.ts` içinde yazılıdır. Kaynağı olmayan
değerler arayüzde "Varsayım" olarak işaretlenir.

## Yapay zekâ kullanım beyanı

- Uygulamanın içinde: Katman 2 için Google Gemini (geliştirme) ve Anthropic Claude Haiku 5.5 (demo).
- Geliştirme sırasında: planlama, kod iskeleti ve kaynak taraması için Claude kullanıldı.
- Katman 1'in karar mantığı (eşikler, kurallar) ekip tarafından yazılmıştır; dil modeli uyarı açamaz, veriyi değiştiremez.

## Lisans

Apache 2.0 — bkz. `LICENSE`.
