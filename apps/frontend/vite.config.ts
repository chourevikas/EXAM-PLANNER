import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const rootDir = path.resolve(__dirname, '../..');
  const frontendDir = __dirname;

  // Load envs: root first, then frontend overrides
  const rootEnv = loadEnv(mode, rootDir, '');
  const frontendEnv = loadEnv(mode, frontendDir, '');
  const mergedEnv = { ...rootEnv, ...frontendEnv };

  // Expose VITE_ variables to import.meta.env
  const processEnvDefines: Record<string, string> = {};
  for (const [key, val] of Object.entries(mergedEnv)) {
    if (key.startsWith('VITE_')) {
      processEnvDefines[`import.meta.env.${key}`] = JSON.stringify(val);
    }
  }

  return {
    plugins: [
      react(),
      {
        name: 'watch-root-env',
        configureServer(server) {
          server.watcher.add(path.resolve(rootDir, '.env*'));
        },
      },
    ],
    define: processEnvDefines,
    server: {
      port: 3000,
      open: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('recharts')) {
                return 'vendor-recharts';
              }
              if (id.includes('@clerk')) {
                return 'vendor-clerk';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-lucide';
              }
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
                return 'vendor-react';
              }
            }
          },
        },
      },
    },
  };
});

