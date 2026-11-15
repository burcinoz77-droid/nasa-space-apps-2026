# Cloudflare yedeği (Türkiye'den erişim için)

Bazı Türkiye internet sağlayıcıları `*.vercel.app` adreslerine bağlantıyı kesiyor (`ERR_CONNECTION_RESET`).
Bu klasör, sitenin ve ASTRA sunucusunun **aynısını** Cloudflare Workers'ta tek adreste çalıştırır.
Gemini burada da canlıdır; GitHub Pages yedeğinden farkı budur.

- `cloudflare/worker.ts`: `/api/astra` isteğini `api/astra.ts`'e (Vercel'deki dosyanın aynısı) yollar, gerisini `dist/`ten sunar.
- `wrangler.jsonc`: Worker ayarları. Anahtar burada değil, Cloudflare'de "secret" olarak durur.

## İlk kurulum (repo sahibi, bir kez, ~10 dk)

```bash
git checkout main
git pull
npm install
npm run build
npx wrangler login                     # tarayıcı açılır: Cloudflare'e kaydol / giriş yap → Allow
npx wrangler deploy                    # ilk seferde workers.dev alt adı sorarsa bir ad yaz
npx wrangler secret put GEMINI_API_KEY # sorunca anahtarı yapıştır, Enter (ekranda görünmez)
```

Son komuttan sonra site `https://nasa-space-apps-2026.<alt-ad>.workers.dev` adresinde canlıdır.

## Güncelleme (main'e yeni kod girdiğinde)

```bash
git pull
npm run build
npx wrangler deploy
```

Anahtar bir kez kaydedilir, her güncellemede tekrar girilmez. Claude'a geçerken:
`npx wrangler secret put ANTHROPIC_API_KEY` ve `wrangler.jsonc` içinde `ASTRA_PROVIDER` → `claude`, sonra `npx wrangler deploy`.
