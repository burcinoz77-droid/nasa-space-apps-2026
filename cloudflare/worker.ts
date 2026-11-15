// Cloudflare Workers girişi: vercel.app'e ulaşamayan ağlar (bazı Türkiye sağlayıcıları) için
// sitenin ve ASTRA sunucusunun aynı adreste çalışan kopyası.
// - /api/astra → api/astra.ts (Vercel'deki dosyanın aynısı, değiştirilmedi)
// - geri kalan her şey → dist/ içindeki derlenmiş site (wrangler.jsonc "assets")
// Anahtarlar Cloudflare'de "secret" olarak durur (npx wrangler secret put GEMINI_API_KEY);
// nodejs_compat bayrağı sayesinde api/astra.ts bunları process.env'den okur.
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
