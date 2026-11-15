# Cloudflare backup (for access from Türkiye)

Some internet providers in Türkiye reset connections to `*.vercel.app` addresses (`ERR_CONNECTION_RESET`).
This folder runs an **identical** copy of the site and the ASTRA server on Cloudflare Workers, at a single address.
Gemini is live here too; that is the difference from the GitHub Pages backup.

- `cloudflare/worker.ts`: sends `/api/astra` requests to `api/astra.ts` (the same file as on Vercel) and serves everything else from `dist/`.
- `wrangler.jsonc`: Worker settings. The key is not here; it is stored in Cloudflare as a secret.

## First setup (repository owner, once, ~10 min)

```bash
git checkout main
git pull
npm install
npm run build
npx wrangler login                     # a browser opens: sign up / log in to Cloudflare → Allow
npx wrangler deploy                    # the first time it may ask for a workers.dev subdomain; type a name
npx wrangler secret put GEMINI_API_KEY # paste the key when asked, Enter (it is not shown on screen)
```

After the last command the site is live at `https://nasa-space-apps-2026.<subdomain>.workers.dev`.

## Updating (when new code is merged into main)

```bash
git pull
npm run build
npx wrangler deploy
```

The key is saved once and does not need to be entered on every update. To switch to Claude:
`npx wrangler secret put ANTHROPIC_API_KEY`, set `ASTRA_PROVIDER` → `claude` in `wrangler.jsonc`, then `npx wrangler deploy`.
