# Kaynak kontrolü (Parça 1)

`src/sim/parameters.ts` içindeki her kaynak linki 14 Kasım 2026'da tek tek kontrol edildi: link açılıyor mu, ekrandaki sayı kaynakta geçiyor mu?

| Sayı | Değer | Kaynak | Sonuç |
| --- | --- | --- | --- |
| Mars yolu doz hızı | 1,84 mSv/gün | Curiosity RAD (Zeitlin 2013, SwRI); Space.com | Doğrulandı (1,8 cruise; 1,84 Space.com) |
| Mars yüzeyi doz hızı | 0,64 mSv/gün | Space.com, Hassler 2013 | Doğrulandı |
| Kariyer limiti | 600 mSv | NASA OCHMO radyasyon teknik özeti | Doğrulandı (olay başına 250 mSv da yazıyor) |
| CO₂ eşikleri | 2,3 / 3,0 mmHg | OCHMO-TB-004 | Kısmen: 3,0 (1 saatlik) ve 2,5 (7 günlük) özette var; 2,3 NASA NTRS'ten (belirtilerin başladığı seviye). Birim açıklaması düzeltildi |
| ISS kabin CO₂ medyanı | 1,9 mmHg | OSDR EDA | Link doğrulandı (EDA uygulaması) |
| Uzayda uyku | 6,09 sa | Barger 2014 (EurekAlert) | Doğrulandı |
| Dünya gecikmesi | 3–22,4 dk | NASA NTRS, ASCEND 2022 | Link değiştirildi: eski NASA linki doğrulanamadı. 54,6–401 milyon km ÷ ışık hızı = 3,0–22,3 dk |
| Çekirdek sıcaklık artışı | +1 °C, egzersizde > 40 °C | Stahn 2017 | Doğrulandı |
| Tansiyon düşüşü | 8–10 mmHg | Norsk 2015 | Doğrulandı |
| HRV (RMSSD) | 42 ± 15 ms, 19–75 | Nunan 2010 | Doğrulandı |
| PVT dikkat kaybı eşiği | 355 ms | Basner 2011 | Doğrulandı |
| PVT ve uyku eksikliği | — | Jones 2022 | Doğrulandı |
| BSI-18 genel nüfus | 4,7 | Franke 2017 | Doğrulandı (GSI 4,66) |
| PANAS | 33,3 / 17,4 | Watson 1988 | Doğrulandı (haftalık normlar) |
| Ter kortizol, laktat, sodyum | 8–140 ng/mL, 5–20 mM, 10–100 mM | Ter biyobelirteçleri tablosu (PMC8985157) | Doğrulandı |
| EtCO₂, solunum | 35–45 mmHg, 12–20/dk | JEMS | Doğrulandı |
| EVA giysisi | 4,3 psia (29,6 kPa), %100 O₂ | NASA NTRS ICES-2023 | Doğrulandı |
| Kabin atmosferi | 14,7 psia (101,3 kPa), %21 O₂ | NASA NTRS ICES-2024 | Link değiştirildi: eski link doğrulanamadı |
| Nefes VOC (E-nose) | ölçek varsayım | IAC-18 | Link doğrulandı (uzayda nefesten oksidatif stres ölçümü) |
| NASA HRP risk sayfaları | — | nasa.gov/reference/... | Doğrulandı |
| Güneş fırtınası zamanları | Mayıs 2024 | NASA DONKI | Ham veri kaydedildi, hash ile doğrulandı (`donki_sep_2024-05.json`) |

Kaynağı olmayan 16 sayı uygulamada "Varsayım" rozetiyle gösterilir ve jüriye öyle söylenir.
