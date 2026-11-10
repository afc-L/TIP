import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 6000,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        royale: resolve(__dirname, 'royale/index.html'),
      },
    },
  },
});
