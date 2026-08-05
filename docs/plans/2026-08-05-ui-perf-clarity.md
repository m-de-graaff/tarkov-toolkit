# UI Clarity & Performance Implementation Plan (Roadmap Slice 5, safe subset)

> **To execute:** use the `executing-plans` skill. Steps use `- [ ]` for tracking.

**Goal:** Stop the unsolicited ~16MB price re-downloads; give the mobile nav a
scroll affordance and adequate touch targets; make the manifest's offline
promise real with a precaching service worker.

**Deferred (user WIP in those files):** MarketPage loading/failed/empty states,
table remeasure/virtualization, MarketPage exhaustive-deps disables.

### Task 1: prices fetch policy — cache-first, no interval
**Files:** `apps/web/src/lib/usePrices.ts`; Test: `usePrices.test.tsx` (new).
- Auto-fetch ONLY when no cache exists for the mode (first visit keeps
  working); a stale cache renders as-is — `refresh()` (the pages' button) is
  the only way to re-download. Remove the 30-minute interval refetch
  (an idle tab was pulling 32MB/hour).
- [x] Tests (mock `./prices`): no fetch when cache exists (fresh OR stale);
  fetch when absent; manual refresh fetches. Implement; green; commit.

### Task 2: TopNav mobile polish
**Files:** `apps/web/src/components/TopNav.tsx`.
- Edge-fade mask on the scrollable tab strip (mobile only) so cut-off tabs
  read as scrollable; `md:` removes it.
- GameModeToggle buttons meet the 24px minimum target (py-1).
- [x] Implement; existing App tests still green; commit.

### Task 3: real PWA — precaching service worker
**Files:** `apps/web/vite.config.ts`, `apps/web/package.json`
(devDep `vite-plugin-pwa`), keep `public/manifest.webmanifest` (plugin
`manifest: false`).
- `VitePWA({ registerType: 'autoUpdate', injectRegister: 'auto',
  manifest: false, workbox: { globPatterns:
  ['**/*.{js,css,html,svg,png,woff2,ico,webmanifest}'],
  navigateFallback: '/index.html',
  navigateFallbackDenylist: [/^\/api\//],
  maximumFileSizeToCacheInBytes: 3_000_000 } })`
- Precaches the app shell + 1.3MB data snapshot + 1.5MB map SVGs (3.8MB dist
  total) → installed app genuinely works offline; deploys auto-update
  (skipWaiting/clientsClaim) which also retires the stale-chunk failure mode.
- [x] Build; verify `dist/sw.js` exists and precache manifest includes the
  snapshot chunk and maps; web tests green; commit.
