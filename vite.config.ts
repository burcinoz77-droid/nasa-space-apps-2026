import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// Yerel geliştirmede POST /api/astra isteğini api/astra.ts dosyasına yönlendirir.
// Vercel'de aynı dosya kendi başına çalışır; böylece kod tek, davranış aynı.
// .env içindeki değişkenler SADECE sunucu tarafına (process.env) yüklenir.
// UYARI: Anahtar değişkenlerine asla VITE_ ön eki koymayın; VITE_ olanlar tarayıcıya gider.
function astraDevApi(): Plugin {
  return {
    name: 'astra-dev-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '');
      for (const [key, value] of Object.entries(env)) {
        if (!key.startsWith('VITE_') && process.env[key] === undefined) process.env[key] = value;
      }
      server.middlewares.use('/api/astra', async (req, res) => {
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const mod = await server.ssrLoadModule('/api/astra.ts');
          const request = new Request('http://localhost/api/astra', {
            method: req.method,
            headers: { 'content-type': 'application/json' },
            body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
          });
          const response: Response = await mod.default.fetch(request);
          res.statusCode = response.status;
          res.setHeader('content-type', response.headers.get('content-type') ?? 'application/json');
          res.end(await response.text());
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), astraDevApi()],
});
