import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Same-origin API access: the browser only ever talks to this origin, and /api is proxied to the
// backend (Vite here, nginx in production). No CORS and no cross-site cookies are involved.
const apiProxy = {
  '/api': {
    target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000',
    changeOrigin: true,
    // Same header the production nginx sets; the backend uses it to tell which app a request came through.
    headers: { 'X-Client-App': 'superadmin' },
  },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 3001, proxy: apiProxy },
  preview: { port: 4174, proxy: apiProxy },
});
