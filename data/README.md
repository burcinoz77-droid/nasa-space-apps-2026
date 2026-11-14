Kaydedilmiş NASA verileri (DONKI, OSDR EDA) buraya JSON olarak konur. Demo internetsiz de çalışsın diye uygulama bu dosyaları kullanır, canlı API'yi çağırmaz.

| Dosya | Ne | Kaynak | Alındığı tarih |
| --- | --- | --- | --- |
| `donki_sep_2024-05.json` | Mayıs 2024 güneş parçacık olayları (SEP): 14 kayıt, 4'ü model tahmini. Ham API cevabı, değiştirilmedi. | https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP?startDate=2024-05-01&endDate=2024-05-31 | 14 Kasım 2026 |

Güneş fırtınası senaryosu (`src/sim/scenarios/SOLAR_STORM.json`) olay sırasını ve UTC zamanlarını bu kayıtlardan alır:

| UTC | DONKI kaydı |
| --- | --- |
| 10 May 2024 06:54 | X3.9 güneş patlaması zirvesi (FLR 30666) |
| 10 May 2024 13:35 | GOES >10 MeV parçacık olayı (SEP 30677) |
| 11 May 2024 01:23 | X5.8 güneş patlaması zirvesi (FLR 30711) |
| 11 May 2024 02:10 | GOES >100 MeV parçacık olayı (SEP 30714) |
| 13 May 2024 14:00 | GOES >10 MeV ikinci dalga (SEP 30817) |

DONKI olayın zamanını verir, doz değerini vermez. Senaryodaki doz çarpanları varsayımdır.
