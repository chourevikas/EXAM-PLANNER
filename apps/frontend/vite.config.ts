import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
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
      tailwindcss(),
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
  };
});

