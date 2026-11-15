# Berat · Parça 3 · Arayüz

Sahibi: @beyazitberatyusuf-afk · Dal: `berat/arayuz`

Kod bu klasörde değil, ortak yapıda duruyor: `src/App.tsx`, `src/index.css`, `src/ui/` (Raporlar, Ayarlar ve Görevler hariç).
Arayüz veri üretmez, karar vermez: sadece `useAstra`'dan okur, `controls.setScenario / acknowledge / reset` çağırır.

## Ne yapıldı

| Adım | Nerede | Not |
| --- | --- | --- |
| Ortak bileşenler | `src/ui/components/` | `Card`, `StatTile`, `Sparkline` (Recharts) + `TrendLine` (hafif SVG), `SourceBadge`, `ProgressRing`, `LevelBadge`, `BodyMap`, `Planet`, `Icons` |
| İskelet | `src/App.tsx` | Orbitalis logosu, ASTRA-MED OS, 6 sayfa; sol altta "Dünya bağlantısı" (`ship.commDelayOneWay_s` → 12 dk 30 sn) ve "Simülasyonu sıfırla"; üst barda senaryo hapları (aktif = `ship.scenario`), canlı saat + görev günü, zil (açık olay sayısı, kritikse kırmızı, tıklayınca Raporlar), profil kartı. İlk 30 ölçümde saatin altında "Baseline 12/30" yazar: senaryoyu bundan sonra başlatın |
| Kokpit | `src/ui/pages/Kokpit.tsx` | Üç kutu (aktif astronot, ortalama sağlık, görev durumu: açık kritik olay varsa kırmızı "Müdahale gerekiyor"), Kokpit/Gezegen ekip listesi ve ekip ortalamaları, dönen gezegen (bilerek kırmızı değil), görev ilerleme halkası (Gün 180 / ~900, NASA DRA 5.0) |
| Astronot Ekranı | `src/ui/pages/AstronotEkrani.tsx` | Astronot hapları, 2B SVG vücut haritası (baş = grup 4, göğüs = grup 1–2, deri = grup 2–3, çevre halkası = grup 5), sağlık kartı (skor, nabız, sıcaklık, SpO₂ + nabız grafiği), stres faktörleri (radyasyon doz hızı + toplam doz / 600 mSv çubuğu, CO₂ eşik çizgileriyle, uyku, PVT), sekmeler: Genel bakış / Sağlık / Performans / Çevre |
| Astronotlar | `src/ui/pages/Astronotlar.tsx` | İki ekip başlığı (ortalama sağlıkla), 6 kart: rol, birim, hassasiyet, skor, seviye, nabız grafiği. Karta tıklayınca o kişinin Astronot Ekranı açılır (seçili kişi `App.tsx`'te) |
| Olay deneyimi | `src/ui/components/IncidentBanner.tsx` | Kritik olay: üstte yapışkan kırmızı bant (başlık, etkilenenler, otonom adım "Havalandırma artırıldı · otomatik", **Onayla**); altında sinyaller (değer + birim + kişisel normal + z) ve Parça 4'ün mor ASTRA açıklaması. Onaylanınca ince şerit olur. Dikkat: amber tek satır, "Ayrıntı" ile açılır. Senaryo başlar başlamaz mavi "Gemi olayı" satırı görünür |
| Biçim ve erişilebilirlik | `src/ui/theme.ts`, `src/ui/format.ts` | Sayılar Türkçe (`36,8 °C`, `%87`, `12 dk 30 sn`); her seviye renk + simge + yazı (● NORMAL, ▲ DİKKAT, ■ KRİTİK); en küçük yazı 14 px; `prefers-reduced-motion` desteklenir |

Kaynak rozeti (`SourceBadge`) her sayının yanında: NASA-STD-3001 / OSDR / Curiosity RAD / NASA HRP / hakemli çalışma (ör. "Norsk 2015") / gri "Varsayım". Tıklayınca `PARAMS`'taki kaynak linki açılır. Gezegen ekibinde doz hızı rozeti yüzey ölçümüne (Mars yüzeyi RAD), basınç ve O₂ rozeti giysi kaynağına döner.

## Sürüm 2 (Kokpit ve 3B astronot)

- **Kokpit** görev kontrol konsolu düzenine geçti: tek parça durum şeridi, mürettebat tablosu (nabız trendi, SpO₂, sıcaklık), tel çerçeve Mars yörünge ekranı (gemi işareti Kokpit ekibinin, EVA işareti Gezegen ekibinin durum rengini taşır), yaşam ortamı (kabin ve giysiler) ve son kayıtlar.
- **Astronot Ekranı**'nda vücut haritası 3B astronot modeli oldu (`src/ui/components/Astronaut3D.tsx`, three.js, sayfa açılınca ayrı yüklenir). Model yavaşça döner, fareyle sürüklenir. Bölgeler: **baş** (kask: bilişsel ve göz), **göğüs** (gövde, kollar, sırt çantası: kalp ve solunum), **alt gövde** (kalça ve bacaklar: metabolizma, ter ve ısı) ve ayak altındaki **çevre** halkası. İmleç bir bölgenin üstüne gelince risk kutusu (seviye, skor, en çok sapan ölçüm) çıkar; tıklayınca bölgenin bütün ölçümleri açılır. WebGL yoksa 2B çizime düşer.
- Model `src/ui/assets/astronaut.glb`; Draco kod çözücüsü three paketinden gelir. İkisi de derlemeye gömülü, internet gerekmez.
- Yazı tipi Barlow / Barlow Semi Condensed (`@fontsource`, çevrimdışı).

## Nasıl denenir

```bash
npm install
npm run dev          # http://localhost:5173
```

1. Uygulamayı ~40 sn açık bırakın (saatin altındaki "Baseline 30/30" dolsun).
2. Üst bardaki **CO₂ arızası** hapına basın: hemen mavi "Gemi olayı" satırı, ~18 sn sonra amber DİKKAT, ~40 sn sonra kırmızı KRİTİK bant ve "Havalandırma artırıldı · otomatik".
3. Banttaki **Kerem**'e basın → Kerem'in Astronot Ekranı; vücut haritasında göğüs ve çevre halkası renk değiştirir.
4. **Onayla** → bant ince şeride döner, Raporlar'da "Mürettebat onayladı" satırı çıkar.
5. **EVA aşırı efor** → Mert kritik; nabız grafiği kırmızı, Sağlık sekmesinde sapan ölçümler ■ ile işaretli.

## Kontrol sonuçları (Pazar sabahı adımı)

Başsız Chrome ile 1280×800 ve 1024×768'de altı sayfa ve iki senaryo açıldı:

- Yatay taşma yok, 14 px altında yazı yok (Ayarlar hariç, aşağıya bakın), konsolda hata yok.
- Ekranda "ISS", "408 km" ya da NASA logosu yok (Ayarlar'daki kaynak tablosu hariç, aşağıya bakın).
- "Onayla" olay kaydına düşüyor.
- Parça 4'ün dalı (`azra/ai`, PR #3) ile birlikte birleştirilip denendi: derleniyor, 96 test geçiyor, mor ASTRA açıklaması bandın altında görünüyor.

## Ekibe notlar

- **Birleştirme sırası** planla aynı: Parça 1 → 2 → 4 → **3 en son**. ASTRA açıklaması `AstraSlot.tsx` içinden glob ile yüklenir (Raporlar'daki yöntem); Parça 4 birleşmeden de derleme bozulmaz.
- **10 saniye kriteri (Parça 1 + 2):** Arayüz durumu her ölçümde (1,2 sn) çiziyor; mavi gemi olayı satırı 1,2 sn'de görünüyor. Ama Katman 1'in olayı CO₂ arızasında ~18 sn'de (dikkat) ve ~40 sn'de (kritik) açılıyor, çünkü ppCO₂ 90 ölçümde yükseliyor ve 3 ardışık ölçüm kuralı var. Demoda daha hızlı istenirse `CO2_SCRUBBER_FAIL.json`'daki `rampTicks` kısaltılabilir.
- **Ayarlar (Parça 1):** kaynak tablosunda "ISS RR-19 medyan" ve "OSDR EDA (ISS çevre verisi)" yazıları ile 12 px (`text-xs`) yazılar var. "Ekranda ISS kalmasın" ve "en küçük yazı 14 px" kriterleri için bakılabilir.
- **Yeni sabit:** görev süresi (~900 gün, NASA Mars DRA 5.0) `src/ui/params.ts`'te, `PARAMS` biçiminde. Parça 1 isterse `parameters.ts`'e taşıyabilir.
- **Vücut haritası eşikleri:** alan skoru < 85 → DİKKAT, < 60 → KRİTİK (`theme.ts`). Normal günde 5 dakika boyunca hiçbir alan 88'in altına inmediği ölçüldü; yanlış alarm yok. Asıl uyarıyı yine Katman 1 açar.
- `LevelBadge` artık 14 px; Raporlar ve Görevler de bundan faydalanır. `theme.ts`'teki mevcut adlar (`COLORS`, `fmt`, `LEVEL_*`) değişmedi, sadece eklendi.
- Ekran görüntüsü 2–7'deki prototipin kodu elimizde yoktu; sayfalar kitteki v0'dan plandaki tarife göre geliştirildi.
