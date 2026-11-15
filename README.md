# Orbitalis · ASTRA — astronot sağlık izleme ve karar desteği

NASA Space Apps Challenge 2026 · Bursa · Takım FLOW
Challenge: *Create Health Monitoring Software for Astronauts on Space Missions*

> "Uçuş doktoru 44 dakikaya kadar uzakta. ASTRA ise tam burada."

ASTRA, ARES-1 Mars görevindeki 6 astronotun 5 veri grubundaki ölçümlerini canlı izler.
**Katman 1** gemide internetsiz çalışır: kişisel baseline, z-skoru, erken uyarı ve önceden
onaylı güvenli adımlar. **Katman 2** bir dil modelidir: olayları Türkçe açıklar ve soruları
sadece veriye dayanarak cevaplar. Karar her zaman mürettebatındır.

## English summary (for judges)

**Orbitalis** is a health-monitoring console for a 6-person crew on a Mars mission (ARES-1, day 180):
3 astronauts in orbit, 3 on the surface in EVA suits. Earth is up to 22 minutes away one way, so the
crew cannot wait for a flight surgeon.

- **Layer 1 (on board, no internet):** learns each astronaut's *personal normal* from the first 30
  readings, flags deviations with z-scores and NASA limits (NASA-STD-3001, OCHMO), opens alerts and
  runs three pre-approved safe steps on its own: radiation shelter, more ventilation, mandatory rest.
- **Layer 2, ASTRA (AI):** explains every alert and answers questions using only the live data,
  with source links and a "numbers verified" check. It never diagnoses, never prescribes and cannot
  open or change alerts. Without internet it falls back to rule-based answers.
- **Real NASA data:** the solar-storm scenario replays the real May 2024 storm (NASA DONKI event
  times, NASA/SDO footage of the X3.9 flare). Values come from NASA and peer-reviewed sources; every
  number in the app links to its source, and values without a source are marked "assumption".
- **Crew fatigue tests:** NASA-TLX (workload, NASA Ames), Samn-Perelli (fatigue) and a 3-minute
  PVT-B (alertness; flown on the ISS as the Reaction Self Test). Official items only, no AI-written questions.
- All crew data is simulated; no real person's health data is used. The interface is in Turkish.

| | Link |
| --- | --- |
| **Demo video (30 s)** | _to be added_ |
| **Presentation (slides)** | _to be added_ |
| **Live app** | https://nasa-space-apps-2026-tau.vercel.app |
| Live app, backup | https://nasa-space-apps-2026.orbitalis-astra.workers.dev |
| GitHub Pages (no AI server, ASTRA in backup mode) | https://burcinoz77-droid.github.io/nasa-space-apps-2026/ |

**Try it in 2 minutes:** wait ~40 s until the clock shows "Canlı" (personal baselines learned) →
top right **Simülasyon ▾ → Güneş fırtınası** (solar storm) → watch the cinematic, the red alert and
the automatic shelter step → click **ASTRA'ya sor** (ask ASTRA). For a hands-free tour:
**Ayarlar → ★ Jüri demosu**.

## Sunum, demo videosu ve canlı bağlantılar

| Ne | Link | Not |
| --- | --- | --- |
| Demo videosu (30 sn) | _eklenecek_ | İngilizce altyazılı |
| Sunum (slaytlar) | _eklenecek_ | İngilizce, en fazla 7 slayt |
| Ana yayın (Vercel) | https://nasa-space-apps-2026-tau.vercel.app | ASTRA canlı (Gemini) |
| Yedek (Cloudflare) | https://nasa-space-apps-2026.orbitalis-astra.workers.dev | ASTRA canlı |
| GitHub Pages | https://burcinoz77-droid.github.io/nasa-space-apps-2026/ | Sunucu yok: ASTRA yedek modda |

Bazı Türkiye ağları `.vercel.app` ve `.workers.dev` adreslerini engelliyor. Açılmazsa telefon
hotspot'u ya da yerel çalıştırma (`npm run dev`) kullanın.

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
| `src/ui/cinematic/` | Senaryo sinematikleri, jüri demo turu, kask vizörü | Parça 1 |
| `data/`, `public/media/` | Kaydedilmiş NASA DONKI verisi, kaynak kontrolü, NASA/SDO videosu | Parça 1 |
| `api/astra.ts`, `src/ai/` | Katman 2: ASTRA yapay zekâsı | Parça 4 |
| `src/psych/` | Psikolojik testler: NASA-TLX, Samn-Perelli, PVT-B | Parça 4 |
| `src/loop.ts`, `src/store.ts` | Parçaları bağlayan döngü ve ortak durum | Herkes (gruba yaz) |
| `docs/` | Sunum, kaynaklar, ASTRA belgeleri | Parça 4 |

## Uygulamada neler var

- **6 sayfa:** Kokpit (görev konsolu), Astronot Ekranı, Astronotlar, Görevler, Raporlar (olay kaydı), Ayarlar.
- **5 senaryo** (sağ üstte **Simülasyon ▾** menüsü): Normal gün, Güneş fırtınası, Mars 180. gün, CO₂ arızası, EVA aşırı efor.
  Kriz senaryolarında tam ekran sinematik oynar; güneş fırtınasında gerçek NASA/SDO görüntüsü ve DONKI olay saatleri kullanılır.
- **Jüri demo turu:** Ayarlar → **★ Jüri demosu**; turu baştan sona kendisi oynatır.
- **Kişisel normal:** ilk 30 ölçümde her astronotun kendi normali öğrenilir; resmi normal aralıktaki değerler uyarı vermez.
  Kriz bitince değerler kademeli olarak normale döner.
- **Astronot Ekranı:** 3B astronot (bölgeye göre renk), ölçüm grupları, resmi normal aralık göstergesi,
  yüzeydeki astronotlar için **kask vizörü** (HUD) ve **Testler** sekmesi.
- **Kaynak gösterimi:** her sayının yanında küçük gri (i); üstüne gelince kaynak adı çıkar, tıklayınca kaynak açılır.
  Kaynağı olmayan değerlerde gri "varsayım" yazar.

## ASTRA (Katman 2) kısaca

- Olay açıklaması ve sohbet: Türkçe, en fazla 4 cümle, sadece veriye dayanır. Ayrıntı: `docs/ASTRA.md`.
- Kesin teşhis koymaz: değişen değerlere dayanarak olası durumları ihtimal diliyle söyler ("... ile uyumlu olabilir") ve medikal kontrol önerir. İlaç önermez, uyarı açamaz, veriyi değiştiremez. Güvenlik süzgeci kesin ifade ya da ilaç içeren cevabı göstermez.
- Araç kullanımı (10 salt-okur araç; 4'ü psikolojik test sonuçları, test planı ve ekip karşılaştırması için), kaynaklı bilgi tabanı, uzun dönem veri hafızası ve son 10 mesajı hatırlayan sohbet; sohbet sayfa yenilense de devam eder, "Sohbeti sıfırla" ile temizlenir.
- Cevaptaki her sayı veride aranır: **Sayılar doğrulandı** / **Sayıları kontrol et** rozeti. Cevabın altında dayandığı kaynakların linkleri çıkar.
- İnternet ya da anahtar yoksa **Yedek mod**: cevaplar veriden kural tabanlı üretilir; gemideki döngü zaten internetsiz çalışır.
- Diğer ekranlarda olay açıklaması: `<AstraExplanation incidentId={incident.id} />`.

## Psikolojik testler

Astronot Ekranı → **Testler** sekmesi. Sorular resmi ölçeklerden aynen alınır (İngilizce asılları da gösterilir);
yapay zekâ soru yazmaz. Türkçe metinler ekibin çevirisidir, resmi Türkçe sürüm değildir.

| Test | Ne ölçer | Kaynak |
| --- | --- | --- |
| NASA-TLX | İş yükü, 6 alt ölçek, 0–100 (Raw TLX) | [NASA Ames](https://humansystems.arc.nasa.gov/groups/tlx/), [Hart 2006](https://humansystems.arc.nasa.gov/publications/HFES_2006_Paper.pdf) |
| Samn-Perelli | Yorgunluk, 1–7 | [Samn & Perelli 1982 maddeleri](https://pmc.ncbi.nlm.nih.gov/articles/PMC9286802), [NASA–easyJet çalışması](https://ntrs.nasa.gov/citations/20130001718) |
| PVT-B | 3 dk tepki testi; 355 ms ve üzeri dikkat kaybı | [Basner vd. 2011](https://pmc.ncbi.nlm.nih.gov/articles/PMC3197786), [NASA Spinoff 2013](https://spinoff.nasa.gov/Spinoff2013/hm_1.html) |

- ASTRA testleri 4 görev gününde bir önerir (ISS'teki Reaction Self Test sıklığı, [Jones vd. 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8919197));
  uyku 6 saatin altındaysa ya da Katman 1 bilişsel sapma görürse öne alır.
- PVT-B sonucu 1 görev günü boyunca telemetriye yazılır; uyarı gerekiyorsa onu Katman 1 açar.
- Kaynağı olmayan eşikler (Samn-Perelli ≥ 5, NASA-TLX ≥ 50) ekranda "varsayım" olarak işaretlidir.
- PANAS (APA telifi) ve BSI-18 (Pearson'un ticari ölçeği) test olarak kullanılmadı. Simülasyondaki PANAS ve BSI-18
  puanları yalnızca simüledir, soruları uygulamada yoktur; gerçek sistemde lisanslı ölçek gerekir.

## Veri ve kaynaklar

Tüm astronot verileri sentetiktir (simülasyon). Parametreler NASA ve hakemli kaynaklardan
alınmıştır; her sabitin kaynağı `src/sim/parameters.ts` içinde yazılıdır, linklerin kontrolü
`data/KAYNAK_KONTROLU.md` içindedir. Kaynağı olmayan değerler arayüzde "varsayım" olarak işaretlenir.

| Kullanılan NASA verisi ve standardı | Nerede |
| --- | --- |
| NASA DONKI (Mayıs 2024 güneş fırtınası olay saatleri) | Güneş fırtınası senaryosu, `data/donki_sep_2024-05.json` |
| NASA/SDO görüntüsü (X3.9 patlaması, [NASA SVS 5286](https://svs.gsfc.nasa.gov/5286/)) | Güneş fırtınası sinematiği |
| NASA OSDR EDA (ISS kabin ortamı) | Kabin CO₂ ve ortam değerleri |
| NASA-STD-3001 / OCHMO (CO₂, radyasyon, gürültü, ortam) | Katman 1 sınırları ve normal aralıklar |
| NASA Human Research Program | Risk konuları, ASTRA bilgi tabanı |
| Curiosity RAD (Mars yolu ve yüzeyi doz hızı) | Radyasyon değerleri |
| NASA 3D Resources, "Astronaut" modeli (DigitalSpace Corporation, [link](https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Astronaut)) | Astronot Ekranı'ndaki 3B astronot |

## Yapay zekâ kullanım beyanı

NASA Space Apps kuralı gereği kullanılan veri, araç ve yapay zekâ burada belirtilir.

**Uygulamanın içinde (ürünün parçası)**
- Katman 2 (ASTRA): Google Gemini (`gemini-3.8-flash`, geliştirme) ve Anthropic Claude Haiku 5.5 (`claude-haiku-5-5`, demo). Sunucu fonksiyonundan REST ile çağrılır; anahtarlar yalnızca sunucuda durur.
- Dil modeli yalnızca okur: olayları açıklar, soruları cevaplar ve veriye dayalı olası durumları ihtimal olarak belirtir. Uyarı açamaz, telemetriyi, olayları ya da otonom adımları değiştiremez. Kesin teşhis ve ilaç içeren cevaplar güvenlik süzgecinde durdurulur; cevaptaki sayılar veriyle karşılaştırılır.

**Geliştirme sırasında**
- Anthropic Claude: dört parçada da (simülasyon, Katman 1, arayüz, ASTRA) planlama, kod yazımı ve kaynak taramasında yardımcı olarak kullanıldı (commit'lerdeki `Co-Authored-By` satırları). Üretilen kod ekip tarafından gözden geçirildi ve testlerle (`npm run test`) doğrulandı.
- Katman 1'in eşikleri ve kuralları ekip tarafından seçildi ve kaynaklarıyla belgelendi (`src/engine/config.ts`).

**Veri ve görseller**
- Tüm astronot verileri sentetiktir (simülasyon); gerçek bir kişinin sağlık verisi kullanılmaz. Parametre kaynakları `src/sim/parameters.ts` içindedir (NASA HRP, NASA-STD-3001, OCHMO-TB-004, OSDR EDA, DONKI, hakemli çalışmalar).
- NASA görselleri kamu malıdır ve kaynak gösterilerek kullanıldı: NASA/SDO güneş patlaması videosu ve NASA 3D Resources'taki astronot modeli. Sinematiklerdeki astronot çizimleri ve Görevler sayfasındaki görsel projeye özel SVG çizimlerdir.
- NASA logosu kullanılmamıştır; proje NASA tarafından onaylanmış değildir.

## Lisans

Apache 2.0 — bkz. `LICENSE`.
