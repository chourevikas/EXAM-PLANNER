import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import { fileURLToPath } from 'node:url';

const frontendSrc = fileURLToPath(new URL('../frontend/src', import.meta.url));

// The SPA's global CSS pulls fonts from Google with a render-blocking @import.
// The marketing site self-hosts them via @fontsource instead, so drop those lines.
const stripGoogleFontImports = {
  name: 'strip-google-font-imports',
  enforce: 'pre',
  transform(code, id) {
    if (id.startsWith(frontendSrc) && id.endsWith('.css')) {
      return code.replace(/@import\s+url\(['"]?https:\/\/fonts\.googleapis\.com[^)]*\)\s*;?/g, '');
    }
  },
};

// Dev only: in production nginx sends app paths (/signin, /dashboard, ...) to the SPA. Locally those
// links hit this Astro server and 404, so hand them off to the SPA dev server.
const SPA_ORIGIN = process.env.SPA_ORIGIN || 'http://localhost:3000';
const SPA_PREFIXES = [
  '/signin', '/login', '/signup', '/register', '/dashboard', '/billing', '/practice-exam', '/guest-exam',
  '/verify-email', '/forgot-password', '/reset-password', '/change-password', '/sso-callback',
];
const redirectAppPathsToSpa = {
  name: 'redirect-app-paths-to-spa',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url || '';
      const path = url.split('?')[0];
      if (SPA_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
        res.statusCode = 302;
        res.setHeader('Location', `${SPA_ORIGIN}${url}`);
        res.end();
        return;
      }
      next();
    });
  },
};

export default defineConfig({
  site: 'https://examplanner.in',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  trailingSlash: 'never',
  server: { port: 4321, host: true },
  vite: {
    plugins: [stripGoogleFontImports, redirectAppPathsToSpa],
    resolve: {
      alias: { '@app': frontendSrc },
      // Shared SPA components must use this app's single copy of React.
      dedupe: ['react', 'react-dom', 'react-router-dom', 'lucide-react'],
    },
    server: {
      fs: { allow: ['..'] },
      proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } },
    },
  },
});
