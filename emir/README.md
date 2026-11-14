# Emir · Parça 2 · Katman 1 (anomali tespiti ve olay kaydı)

Sahibi: @emirruzunn · Dal: `emir/katman1`

Kod bu klasörde değil, ortak yapıda duruyor:

| Dosya | Ne yapar |
| --- | --- |
| `src/engine/config.ts` | Eşikler, sd tabanları, kural sabitleri. NASA eşiklerinin kaynak linki eşiğin yanında |
| `src/engine/baseline.ts` | Kişisel baseline (Welford, ilk 30 ölçüm, sonra donar), yönlü z-skoru, 3 ardışık ölçüm kuralı |
| `src/engine/rules.ts` | Olay kuralları: RADIATION, CO2, HYPOXIA, CARDIO, THERMAL, FATIGUE, STRESS, MULTI |
| `src/engine/index.ts` | `createDetector()`: sağlık skoru, olay aç/yükselt/çöz, otonom adım, olay kaydı |
| `src/engine/labels.ts` | Türkçe olay ve otonom adım adları (`INCIDENT_LABELS`, `ACTION_LABELS`) |
| `src/engine/*.test.ts` | 23 birim testi + 10 uçtan uca test (`npm run test`) |
| `src/ui/pages/Raporlar.tsx` | Raporlar sayfası: olay kaydı, filtre, anlık telemetri raporu, onay |

## Nasıl çalışır (jüriye 30 saniyede)

1. **Kişisel normal.** Her astronotun her ölçümü için ilk 30 ölçümün ortalaması ve sapması öğrenilir, sonra
   dondurulur. Böylece "Zeynep'in nabzı düşük" normaldir, alarm değildir.
2. **Sapma = z-skoru.** Sadece riskli yön sayılır (SpO₂ düşerse kötü, CO₂ artarsa kötü). z ≥ 2 dikkat, z ≥ 3 kritik.
3. **NASA sınırı önce gelir.** ppCO₂ (> 2,3 / > 3,0 mmHg, OCHMO-TB-004), toplam doz (480 / 600 mSv, NASA-STD-3001),
   SpO₂ (< 94 / < 90 %) ve çekirdek sıcaklık (38,5 / 39,0 °C) mutlak eşikle izlenir; bunlar baseline kurulmadan da çalışır.
4. **Tek sıçrama alarm vermez.** Seviye ancak 3 ardışık ölçüm aynı yönde kalırsa değişir (yanlış alarmı azaltır).
5. **Olay ve güvenli adım.** Kural tablosuna göre olay açılır; aynı kişi/yer + aynı tür için tek açık olay olur.
   Sadece üç adım otomatik: radyasyon sığınağı, havalandırma artırma, zorunlu dinlenme. Her olayda en fazla bir kez.
6. **Kendiliğinden çözülme.** Bütün sinyaller 10 ölçüm normal kalırsa olay "çözüldü" olur. Her şey olay kaydına düşer.
7. **Yapay zekâ uyarı açamaz.** Uyarıyı sadece Katman 1 açar; ASTRA sadece açıklar.

## Senaryolarda ne olur (Parça 1 simülasyonuyla denendi, seed 2026)

| Senaryo | Açılan olay | Otonom adım | İlk olay |
| --- | --- | --- | --- |
| Normal gün | Hiçbiri (10 seed × 6,6 dk denendi, 0 yanlış alarm) | — | — |
| Güneş fırtınası | Kokpit ve Gezegen radyasyon (kritik); Elif stres + çoklu sistem | Sığınak (iki ekip) | ~12 ölçüm |
| CO₂ arızası | Kokpit CO₂ (dikkat → kritik) | Havalandırma; CO₂ düşer, olay çözülür | ~14 ölçüm |
| Mars 180. gün | Elif yorgunluk + çoklu sistem; diğerleri sadece dikkat seviyesi | Elif zorunlu dinlenme | ~31 ölçüm |
| EVA aşırı efor | Mert çoklu sistem (kritik) + ısı yükü | Mert zorunlu dinlenme; sıcaklık düşer | ~22 ölçüm |

"Tüm mürettebatı stabilize et" sonrası bütün olaylar 10–30 ölçümde kendiliğinden çözülür.

## Demo notları

- Uygulama açıldıktan sonra **en az 36 saniye** (30 ölçüm) bekleyin: kayıtta "Kişisel baseline'lar kuruldu" yazınca senaryoyu başlatın.
  Erken başlatılırsa baseline o ana kadarki ölçümlerle (en az 10) erken dondurulur, kayıtta yazar; demo yine çalışır.
- Jüriye "varsayım" diye söylenecekler: sd tabanları, SpO₂ ve çekirdek sıcaklık eşikleri, MULTI kuralında çevre alanının sayılmaması.

## Diğer parçalar için

- **Parça 3:** olay bandında `incident.autoActions` için `ACTION_LABELS` (`src/engine`) kullanılabilir
  ("Havalandırma artırıldı · otomatik"). Kişinin `level` alanı, açık olayının sinyalleri sürdükçe olayın seviyesini taşır.
- **Parça 1:** Kokpit/Gezegen çapındaki adımlarda (sığınak, havalandırma) `AutoAction.crewIds` o yerdeki herkesi içerir.
- **Parça 4:** `AstraExplanation` bileşeni eklendiğinde Raporlar'daki olay satırlarında kendiliğinden görünür.
  Olay başlıkları teşhis koymaz; `incident.signals` içinde değer, kişisel ortalama ve z var.
