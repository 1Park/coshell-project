import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

interface ApiModule {
  handleApi: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
}

/**
 * Mounts server/api.mjs inside the Vite dev server so `npm run dev` needs no
 * second process. Production uses scripts/server.mjs instead.
 */
function apiRoutes(): Plugin {
  return {
    name: 'coshell-api-routes',
    apply: 'serve',
    async configureServer(server) {
      const { handleApi } = (await import('./server/api.mjs')) as ApiModule;
      server.middlewares.use((req, res, next) => {
        handleApi(req as IncomingMessage, res as ServerResponse).then(
          (handled) => {
            if (!handled) next();
          },
          (error: unknown) => next(error),
        );
      });
    },
  };
}

export default defineConfig({
  plugins: [apiRoutes(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});