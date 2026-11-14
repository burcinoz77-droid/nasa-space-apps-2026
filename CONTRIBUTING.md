# Ekip Çalışma Kuralları

## 1. Repoyu bilgisayarına indir (bir kez)
```bash
git clone https://github.com/burcinoz77-droid/nasa-space-apps-2026.git
cd nasa-space-apps-2026
```

## 2. Her işe kendi branch'inde başla
`main`'e doğrudan push yapma. Kendi branch'ini aç:
```bash
git checkout main
git pull
git checkout -b isim/ozellik     # örnek: ayse/veri-isleme
```

## 3. Kodunu kaydet ve gönder
```bash
git add .
git commit -m "Ne yaptığını kısaca yaz"
git push -u origin isim/ozellik
```

## 4. Pull Request aç
GitHub'da repoya gir, "Compare & pull request" butonuna bas.
Bir ekip arkadaşı bakıp onaylayınca `main`'e merge edilir.

## Klasör düzeni (öneri)
- `src/`  → kodlar
- `data/` → küçük örnek veriler (büyük dosyaları repoya koyma, link paylaş)
- `docs/` → sunum, notlar, görseller

## İpuçları
- İşe başlamadan önce `git pull` yap.
- Şifre, API anahtarı veya `.env` dosyasını asla commit etme.
