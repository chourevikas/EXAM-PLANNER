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

export default defineConfig({
  site: 'https://examplanner.in',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  trailingSlash: 'never',
  server: { port: 4321, host: true },
  vite: {
    plugins: [stripGoogleFontImports],
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
