# Screenshots Auto-Detect & Tile Maps Plan

> **To execute:** use the `executing-plans` skill. Steps use `- [ ]` for tracking.

**Goal:** (1) Nobody picks the screenshots folder repeatedly: the companion finds it by itself (OneDrive-aware) and only asks if truly missing; the browser transport remembers the picked folder across visits (pick once, ever). (2) Replace the schematic SVG base maps with tarkov.dev's baked-3D tile renders — visually far nicer, same calibration space — with automatic SVG fallback offline.

## Global Constraints

- **Offline exception (explicit):** tile imagery loads from `https://assets.tarkov.dev` at runtime; on tile error the canvas swaps to the bundled SVG overlay (and maps with no SVG show the no-map notice offline). Quest data stays fully bundled. README documents this as the one runtime network dependency.
- Tile grid math = existing CRS math (rotation + affine + 2^z scale, tile = floor(px/tileSize)); per-variant `tileSize` respected (labs = 175).
- Companion detection order: `[Environment]::GetFolderPath('MyDocuments')` via PowerShell (respects OneDrive folder redirection) → `%USERPROFILE%\Documents` → `%USERPROFILE%\OneDrive\Documents`, each + `Escape from Tarkov\Screenshots`; else readline prompt; the answer is saved to `~/.raidplanner-watcher.json` and reused.
- Browser: `FileSystemDirectoryHandle` persisted in IndexedDB; on load `queryPermission({mode:'read'})` — `granted` → resume watching silently, `prompt` → one-click "Resume watching" button (`requestPermission` needs a user gesture), else normal picker. jsdom has no `indexedDB`: the helper no-ops when it's absent.

### Task 1: companion folder auto-detect
- [ ] `apps/watcher/src/index.ts`: `detectScreenshotsDir()` per constraints (spawnSync powershell, candidates, saved config, readline fallback); friendly logs ("Found your screenshots at …"). Manual verify against the real machine (folder exists → no prompt).
- [ ] Commit.

### Task 2: browser pick-once persistence
- [ ] `apps/web/src/lib/handleStore.ts` (raw IndexedDB get/put of the handle, guarded no-op without `indexedDB`); extend `fsAccess.d.ts` with `queryPermission`/`requestPermission`; `useLiveWatcher`: save handle on successful connect, on mount try stored handle (`granted` → start watching, `prompt` → expose `resume()` + `canResume`), refactor watch-start into a shared internal `startWatching(handle)`; `LivePanel`: "Resume watching" button when `canResume`.
- [ ] Suite + build green (existing FSA tests unchanged), commit.

### Task 3: tile base maps with SVG fallback
- [ ] Snapshot: calibration gains `tiles?: { url: string; tileSize: number; minZoom: number; maxZoom: number }` from the interactive variant's `tilePath` (prefer variants that have it; svg fields kept when present); renderable = calibration present AND (tiles or svg) — the-lab/the-labyrinth/icebreaker become renderable (aliases untouched); regenerate + validator adjusted (svg check only when svgFile set; require tiles-or-svg).
- [ ] `MapCanvas`: when `cal.tiles` → `L.tileLayer(url, { tileSize, bounds, maxNativeZoom, minNativeZoom, className: 'map-tiles' })`; first `tileerror` → remove tile layer, add SVG overlay if available (one-way swap per mount); no tiles → SVG overlay as today.
- [ ] Tests: MapCanvas smoke keeps passing (customs has both svg+tiles — assert tile layer element present instead of img overlay); README (nicer maps + offline exception + newly renderable maps; limitations updated).
- [ ] Suite + build green, commit.

### Task 4: land
- [ ] Full verification, merge to main (pre-authorized), memory update.
