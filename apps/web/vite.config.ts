import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // the ~1.7MB data snapshot and leaflet dominate the bundle; splitting
        // them lets the app shell load and cache independently
        manualChunks(id: string) {
          if (id.includes('generated/snapshot.json')) return 'snapshot';
          if (id.includes('node_modules/leaflet')) return 'leaflet';
          if (id.includes('node_modules/react')) return 'react';
        },
      },
    },
  },
  test: {
    setupFiles: ['./src/test/setup.ts'],
  },
});
