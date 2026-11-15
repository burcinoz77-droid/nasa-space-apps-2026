// Cloudflare Workers entry: for networks that cannot reach vercel.app (some providers in Turkiye),
// a copy of the site and the ASTRA server running at a single address.
// - /api/astra → api/astra.ts (the same file as on Vercel, unchanged)
// - everything else → the built site in dist/ (wrangler.jsonc "assets")
// Keys are stored in Cloudflare as secrets (npx wrangler secret put GEMINI_API_KEY);
// thanks to the nodejs_compat flag, api/astra.ts reads them from process.env.
import astra from '../api/astra';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/astra') return astra.fetch(request);
    return env.ASSETS.fetch(request);
  },
};
