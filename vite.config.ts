import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// In local development, routes POST /api/astra requests to api/astra.ts.
// On Vercel the same file runs on its own; so there is one codebase and the same behavior.
// Variables in .env are loaded ONLY on the server side (process.env).
// WARNING: never put the VITE_ prefix on key variables; anything with VITE_ is sent to the browser.
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

// BASE_PATH is only set for the GitHub Pages backup (.github/workflows/pages.yml).
// On Vercel and in local development it stays empty, and the site runs at the root ('/').
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss(), astraDevApi()],
});
