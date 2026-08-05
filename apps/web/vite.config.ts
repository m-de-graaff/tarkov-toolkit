import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // the manifest promises an installable app; the service worker makes it
    // real: the whole shell (incl. the data snapshot and offline map SVGs,
    // ~4MB) is precached, so the installed app works with no network and a
    // deploy can never strand a stale index.html pointing at rotated chunks
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false, // public/manifest.webmanifest stays the source of truth
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,ico,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        maximumFileSizeToCacheInBytes: 3_000_000,
      },
    }),
  ],
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
