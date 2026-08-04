# Tarkov Raid Planner — Implementation Plan

> **To execute:** use the `executing-plans` skill. Steps use `- [ ]` for tracking.

**Goal:** An offline-first web app where the user picks an Escape from Tarkov map, sees every quest relevant to that map (map-locked, multi-map, and anywhere-quests), selects several, picks their spawn point, and gets objective markers plus an optimized visiting route drawn on the map — with a quest tracker and a "which map should I play" recommendation on top.

**Architecture:** Turborepo monorepo with two workspaces. `packages/data` owns a dev-time snapshot script that pulls quest/map/trader data from `json.tarkov.dev`, merges English translations, prunes it to a typed `snapshot.json`, and downloads per-map SVG images from `assets.tarkov.dev`; the app never touches the network at runtime. `apps/web` is a static Vite + React SPA rendering the map with Leaflet using tarkov.dev's calibration data (affine transform + rotation from game coords to map coords), with all planning logic (quest indexing, availability, route optimization, recommendation) in pure, vitest-tested modules.

**Tech stack:** pnpm 11 workspaces, Turborepo ^2, TypeScript ^5 (strict), Vite ^5, React ^18, Leaflet ^1.9, Zustand ^4 (with `persist` middleware), Vitest ^2. No CSS framework — hand-rolled CSS custom properties with a Tarkov-inspired palette.

## Global Constraints

- Repo root: `D:\Development\raidplanner` (existing empty git repo). Package scope: `@raidplanner/*`.
- Node ≥ 20, pnpm 11 (installed: Node 24.18.1, pnpm 11.11.0). Windows host — scripts must be cross-platform Node, no bash-isms in package scripts.
- TypeScript `strict: true` everywhere; no `any` in exported signatures.
- **Zero runtime network requests.** All quest data and map images are bundled at build time. `pnpm snapshot` is the only thing that touches the network, and it is dev-time only.
- Output of `pnpm build` in `apps/web` must be a purely static `dist/` (hostable later on any static host).
- Maps without SVG calibration (`icebreaker`, `the-lab`, `the-labyrinth`, `terminal` if absent, plus virtual entries `transits`/`openworld`) are **out of scope for map rendering** in v1: their quests still appear in lists; the map pane shows a "no offline map available" notice.
- Data attribution: footer must credit tarkov.dev (data, CC-BY) and the-hideout/tarkov-dev-svg-maps contributors (map SVGs, MIT).
- Palette tokens (exact values, defined once in `apps/web/src/styles.css`):
  `--bg: #0f0e0c; --panel: #1b1917; --panel-raised: #2a2723; --border: #3d382f; --text: #c7c5b3; --text-dim: #8a8778; --accent: #c9a96a; --accent-dim: #9a8866; --danger: #a7452c; --ok: #5b7c5b; --route: #d4bb70;`
- Verified data sources (all checked 2026-08-04, HTTP 200):
  - `https://json.tarkov.dev/regular/tasks` + `.../regular/tasks_en` (510 tasks; names are translation keys resolved via the `_en` dict)
  - `https://json.tarkov.dev/regular/maps` + `.../regular/maps_en` (17 maps, spawns with `position/sides/categories/zoneName`)
  - `https://json.tarkov.dev/regular/traders` + `.../regular/traders_en` (16 traders)
  - `https://raw.githubusercontent.com/the-hideout/tarkov-dev/main/src/data/maps.json` (calibration: `transform`, `coordinateRotation`, `bounds`, `svgPath`, optional `svgBounds`)
  - SVG images at `https://assets.tarkov.dev/maps/svg/<Name>.svg` (e.g. StreetsOfTarkov.svg, 335KB, verified)
  - The old GraphQL endpoint `api.tarkov.dev/graphql` is **unavailable** — do not use it.
- Coordinate math (ported from tarkov-dev `src/pages/map/index.jsx`, MIT): Leaflet `CRS.Simple` extended with `L.Transformation(transform[0], transform[1], -transform[2], transform[3])` and a projection that rotates lat/lng by `coordinateRotation` degrees; a game position `{x,y,z}` maps to latLng `[z, x]`; a bounds pair `[[x1,z1],[x2,z2]]` becomes `L.latLngBounds([z1,x1],[z2,x2])`.

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`
- Create: `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/tsconfig.json`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/styles.css`
- Create: `packages/data/package.json`, `packages/data/tsconfig.json`, `packages/data/src/index.ts`, `packages/data/src/types.ts` (placeholder export)

**Interfaces:**
- Produces: workspace names `@raidplanner/web`, `@raidplanner/data`; root scripts `pnpm dev` (turbo dev), `pnpm build`, `pnpm test`; `apps/web` depends on `@raidplanner/data: workspace:*`.

- [x] **Step 1: Root files.** `package.json` (private, `"packageManager": "pnpm@11.11.0"`, devDependency `turbo@^2`, scripts `dev/build/test` → `turbo run dev|build|test`), `pnpm-workspace.yaml` listing `apps/*` and `packages/*`, `turbo.json` with `build` (dependsOn `^build`, outputs `dist/**`), `test` (dependsOn `^build`), `dev` (cache false, persistent). `.gitignore`: `node_modules/`, `dist/`, `.turbo/`.
- [x] **Step 2: Web app.** Hand-author Vite React-TS app: `index.html` (title "Tarkov Raid Planner", `<div id="root">`), `main.tsx` (createRoot render `<App/>`, import `styles.css`), `App.tsx` returning `<h1>Tarkov Raid Planner</h1>`, `styles.css` with the palette tokens from Global Constraints on `:root` plus `body { background: var(--bg); color: var(--text); }`. Deps: react, react-dom; dev: vite, @vitejs/plugin-react, typescript, vitest. Scripts: `dev` (vite), `build` (tsc --noEmit && vite build), `test` (vitest run --passWithNoTests).
- [x] **Step 3: Data package.** `packages/data/package.json` (name `@raidplanner/data`, `"type": "module"`, main/types → `src/index.ts` consumed directly by Vite — no build step; script `build`: `tsc --noEmit`, `test`: `node scripts/validate-snapshot.mjs || exit 0` placeholder for now). `src/types.ts` exports `export interface GamePosition { x: number; y: number; z: number }`. `src/index.ts` re-exports types.
- [x] **Step 4: Install and verify.** Run `pnpm install`, then `pnpm build` — expect turbo runs both workspaces green. Run `pnpm --filter @raidplanner/web dev` in background, `curl http://localhost:5173` returns HTML containing `Tarkov Raid Planner`, kill it.
- [x] **Step 5: Commit** (`chore: scaffold turborepo with web app and data package`).

---

### Task 2: Data snapshot pipeline

**Files:**
- Create: `packages/data/src/types.ts` (replace placeholder), `packages/data/scripts/snapshot.mjs`, `packages/data/scripts/validate-snapshot.mjs`
- Create (generated, committed): `packages/data/generated/snapshot.json`, `apps/web/public/maps/*.svg`
- Modify: `packages/data/package.json` (scripts), `packages/data/src/index.ts`

**Interfaces:**
- Produces (in `@raidplanner/data`):
  ```ts
  export interface GamePosition { x: number; y: number; z: number }
  export interface MapCalibration {
    transform: [number, number, number, number];
    coordinateRotation: number;
    bounds: [[number, number], [number, number]];
    svgBounds?: [[number, number], [number, number]];
    svgFile: string;             // e.g. "customs.svg", served from /maps/
  }
  export interface RpSpawn { position: GamePosition; sides: string[]; categories: string[]; zoneName: string }
  export interface RpMap {
    id: string; name: string; normalizedName: string; wiki?: string;
    calibration?: MapCalibration;   // absent => not renderable in v1
    spawns: RpSpawn[];
  }
  export interface RpZone { id: string; map: string; position: GamePosition }
  export interface RpObjective {
    id: string; type: string; description: string; optional: boolean;
    maps: string[];              // map ids ([] = anywhere)
    points: RpZone[];            // merged from zones[] and possibleLocations[].positions
    count?: number;
  }
  export interface RpTaskRequirement { taskId: string; status: string[] }
  export interface RpTask {
    id: string; name: string; normalizedName: string;
    trader: { id: string; name: string };
    mapId: string | null;        // task.map: quest is locked to this map
    minPlayerLevel: number; factionName: string;   // 'Any' | 'USEC' | 'BEAR'
    kappaRequired: boolean; wikiLink?: string; experience: number;
    taskRequirements: RpTaskRequirement[];
    objectives: RpObjective[];
  }
  export interface Snapshot { generatedAt: string; gameMode: 'regular'; maps: RpMap[]; tasks: RpTask[] }
  export const snapshot: Snapshot;   // from ../generated/snapshot.json
  ```

- [x] **Step 1: Write `snapshot.mjs`.** Node script, no deps beyond global fetch. Fetches the six `json.tarkov.dev` endpoints and the calibration `maps.json` from GitHub (URLs in Global Constraints). Translation merge: each payload is `{ data, translations }` where names are keys into the `_en` dict — walk `data` recursively and replace any string value that is a key of the en dict (`en.data[value] !== undefined`). Build `RpMap[]`: for each API map, find calibration entry by `normalizedName` in maps.json (first `maps[0]` variant with an `svgPath`); if found, derive `svgFile: <normalizedName>.svg` and queue the SVG download to `apps/web/public/maps/`; copy `transform`, `coordinateRotation`, `bounds`, `svgBounds`. Spawns: keep only `categories` containing `"player"`. Build `RpTask[]`: keep only fields in the interface; objectives keep `id/type/description/optional/count`, `maps` as-is (ids), and `points` = every `zones[].{id,map,position}` plus every `possibleLocations[]` expanded to one `RpZone` per entry of its `positions[]` (id = objective id + index). Drop objective types that can never have a location and aren't user-actionable in a raid plan: `taskStatus`, `traderLevel`, `traderStanding`, `experience`, `skill`, `dialogue`, `globalVariable` — but keep the task itself. Write `generated/snapshot.json` with `generatedAt: new Date().toISOString()`.
- [x] **Step 2: Write `validate-snapshot.mjs`.** Asserts: ≥ 15 maps, ≥ 450 tasks, ≥ 200 tasks with at least one objective point, no task name matching `/^[0-9a-f]{20,}/` (unresolved translation), every `calibration.svgFile` exists in `apps/web/public/maps/`, every objective point's `map` id exists in maps. Exits non-zero with a message on failure.
- [x] **Step 3: Wire and run.** `packages/data` scripts: `"snapshot": "node scripts/snapshot.mjs"`, `"test": "node scripts/validate-snapshot.mjs"`. Root convenience script `"snapshot": "pnpm --filter @raidplanner/data snapshot"`. Run `pnpm snapshot` then `pnpm --filter @raidplanner/data test` — expect pass. Update `src/index.ts`: `import snapshotJson from '../generated/snapshot.json'; export const snapshot = snapshotJson as unknown as Snapshot;` (enable `resolveJsonModule`).
- [x] **Step 4: Commit** (`feat(data): tarkov.dev snapshot pipeline with typed offline dataset`). Commit snapshot.json and SVGs (binary-ish but versioned intentionally — offline requirement).

---

### Task 3: Coordinate system module

**Files:**
- Create: `apps/web/src/lib/tarkovCrs.ts`, `apps/web/src/lib/tarkovCrs.test.ts`

**Interfaces:**
- Consumes: `MapCalibration`, `GamePosition` from `@raidplanner/data`.
- Produces:
  ```ts
  export function rotatePoint(x: number, y: number, degrees: number): [number, number];
  export function gameToLatLng(p: GamePosition): [number, number];          // [z, x]
  export function boundsToLatLng(b: [[number,number],[number,number]]): [[number, number],[number, number]]; // [[z1,x1],[z2,x2]] pair for L.latLngBounds
  export function makeCrs(cal: MapCalibration): L.CRS;                      // CRS.Simple + transformation + rotated projection
  export function distance2d(a: GamePosition, b: GamePosition): number;     // euclidean on (x,z)
  ```

- [ ] **Step 1: Failing tests.** `rotatePoint(1, 0, 180)` ≈ `[-1, 0]`; `rotatePoint(1, 0, 90)` ≈ `[0, 1]`; `gameToLatLng({x: 5, y: 0, z: 7})` = `[7, 5]`; `boundsToLatLng([[323,-295],[-280,532]])` = `[[-295,323],[532,-280]]`; `distance2d({x:0,y:99,z:0},{x:3,y:0,z:4})` = 5; `makeCrs` with transform `[0.38, 0, 0.38, 0]`, rotation 180: `crs.latLngToPoint(L.latLng(10, 20), 0)` equals manually computed `(-20*0.38, -(-10)*0.38)` → assert `x ≈ -7.6, y ≈ -3.8` (compute expected inline via the same formulae as tarkov-dev: project rotates, transformation scales `x' = a*x + b`, `y' = -c*y + d`... derive expected in the test from the ported constants, not by re-implementing).
- [ ] **Step 2: Run, confirm fail** (`pnpm --filter @raidplanner/web exec vitest run src/lib/tarkovCrs.test.ts` → module not found).
- [ ] **Step 3: Implement** by porting `getCRS`/`applyRotation`/`pos`/`getBounds` from tarkov-dev `map/index.jsx` (code captured in scratchpad `map-index.jsx:44-137`): `makeCrs` returns `L.extend({}, L.CRS.Simple, { transformation: new L.Transformation(t[0], t[1], -t[2], t[3]), projection: {...L.Projection.LonLat, project/unproject applying ±coordinateRotation} })`.
- [ ] **Step 4: Run, confirm pass.**
- [ ] **Step 5: Commit** (`feat(web): tarkov coordinate system (transform+rotation CRS)`).

---

### Task 4: Quest index and availability

**Files:**
- Create: `apps/web/src/lib/questIndex.ts`, `apps/web/src/lib/questIndex.test.ts`, `apps/web/src/lib/availability.ts`, `apps/web/src/lib/availability.test.ts`, `apps/web/src/lib/fixtures.ts` (tiny hand-built `Snapshot` for tests: 2 maps, 5 tasks covering each relation kind)

**Interfaces:**
- Consumes: `Snapshot`, `RpTask`, `RpObjective`, `GamePosition` from `@raidplanner/data`; `distance2d` from `./tarkovCrs`.
- Produces:
  ```ts
  export type MapRelation = 'map-locked' | 'multi-map' | 'anywhere';
  export interface MapQuestEntry { task: RpTask; relation: MapRelation;
    objectivesHere: RpObjective[];   // objectives doable on this map (maps includes id, or maps empty on a map-locked task, or has points on this map)
  }
  export function questsForMap(snapshot: Snapshot, mapId: string): MapQuestEntry[];
  export function objectivePoints(task: RpTask, mapId: string): { objective: RpObjective; points: RpZone[] }[]; // points filtered to mapId
  export interface TrackerState { level: number; faction: 'Any' | 'USEC' | 'BEAR'; completedTaskIds: string[] }
  export function isAvailable(task: RpTask, tracker: TrackerState): boolean;  // level ≥ minPlayerLevel, faction matches (task 'Any' always), every taskRequirement whose status includes 'complete' has its taskId in completedTaskIds; requirements with status ['active'] count satisfied when the task is completed OR available — v1 simplification: treat as satisfied when completedTaskIds contains it or its own requirements are met is NOT computed recursively; treat 'active'-status requirements as satisfied. Completed tasks are never 'available'.
  export function availableQuests(snapshot: Snapshot, tracker: TrackerState): RpTask[];
  ```
- Relation rules: `map-locked` iff `task.mapId === mapId`; else `multi-map` iff some objective's `maps` includes mapId (and some other map exists in its union) or task.mapId is null but objectives point here; `anywhere` iff the task has no located/મap-bound objectives at all (`every o.maps.length === 0 && o.points.length === 0`) — these are only included when the caller asks (`questsForMap` takes `includeAnywhere = false` default... **no optional bool** — export `anywhereQuests(snapshot): RpTask[]` separately).

- [ ] **Step 1: Fixture + failing tests** for: map-locked task appears only on its map with relation `map-locked`; task with objectives on maps A and B appears on both as `multi-map`; task with no maps/points appears in `anywhereQuests` and not in `questsForMap`; `objectivePoints` filters points to the map; `isAvailable` respects level, faction, completed prerequisites, excludes already-completed.
- [ ] **Step 2: Run, confirm fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, confirm pass.**
- [ ] **Step 5: Commit** (`feat(web): quest-map index and availability engine`).

---

### Task 5: Route optimizer

**Files:**
- Create: `apps/web/src/lib/route.ts`, `apps/web/src/lib/route.test.ts`

**Interfaces:**
- Consumes: `GamePosition`, `distance2d`.
- Produces:
  ```ts
  export interface RouteStop { taskId: string; taskName: string; objectiveId: string; description: string; position: GamePosition }
  export interface PlannedRoute { stops: RouteStop[]; totalDistance: number }
  export function optimizeRoute(start: GamePosition, stops: RouteStop[]): PlannedRoute;
  ```
- Algorithm: nearest-neighbour from `start` over `distance2d`, then 2-opt improvement (open path, start fixed, iterate until no improving swap or 200 passes). One stop per objective; when an objective has multiple candidate points the caller passes the point nearest to the running route — v1: caller passes the point nearest to `start` (chosen in Task 8's wiring), documented limitation.

- [ ] **Step 1: Failing tests.** (a) 4 stops on a line `x = 0,10,20,30` shuffled, start at origin → returned in ascending order, totalDistance 30. (b) A crossing configuration nearest-neighbour gets wrong: start (0,0), stops (0,10), (10,0), (10,10), (0,11) — assert 2-opt result ≤ brute-force optimum (compute brute force over all 24 permutations in the test). (c) empty stops → empty route, distance 0.
- [ ] **Step 2: Run, confirm fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, confirm pass.**
- [ ] **Step 5: Commit** (`feat(web): route optimizer (NN + 2-opt)`).

---

### Task 6: Map recommendation

**Files:**
- Create: `apps/web/src/lib/recommend.ts`, `apps/web/src/lib/recommend.test.ts`

**Interfaces:**
- Consumes: `Snapshot`, `TrackerState`, `availableQuests`, `questsForMap`.
- Produces:
  ```ts
  export interface MapScore { mapId: string; mapName: string; availableQuestCount: number; mapLockedCount: number }
  export function recommendMaps(snapshot: Snapshot, tracker: TrackerState): MapScore[]; // sorted desc by availableQuestCount, ties by mapLockedCount; only renderable+non-virtual maps
  ```

- [ ] **Step 1: Failing test** on the Task 4 fixture: map with 2 available quests ranks above map with 1; completed quests don't count; result excludes maps with zero.
- [ ] **Step 2: Run, confirm fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, confirm pass.**
- [ ] **Step 5: Commit** (`feat(web): map recommendation scoring`).

---

### Task 7: App state store

**Files:**
- Create: `apps/web/src/store.ts`, `apps/web/src/store.test.ts`

**Interfaces:**
- Consumes: `TrackerState` from `./lib/availability`; `GamePosition` from `@raidplanner/data`.
- Produces (zustand store created with `persist` to localStorage key `raidplanner-v1`):
  ```ts
  export interface SpawnChoice { kind: 'zone'; zoneName: string; position: GamePosition } | { kind: 'custom'; position: GamePosition }  // discriminated union type SpawnChoice
  interface PlannerState {
    selectedMapId: string | null;
    selectedTaskIds: string[];
    spawn: SpawnChoice | null;
    tracker: TrackerState;                     // default { level: 15, faction: 'Any', completedTaskIds: [] }
    onlyAvailable: boolean;                    // sidebar filter, default true
    search: string;
    selectMap(id: string): void;               // clears selectedTaskIds and spawn
    toggleTask(id: string): void;
    clearTasks(): void;
    setSpawn(s: SpawnChoice | null): void;
    setLevel(n: number): void; setFaction(f: TrackerState['faction']): void;
    toggleCompleted(taskId: string): void;
    setOnlyAvailable(b: boolean): void; setSearch(s: string): void;
  }
  export const usePlanner: UseBoundStore<...>;  // plus vanilla export `plannerStore` for tests
  ```

- [ ] **Step 1: Failing tests** (vanilla store, no React): `selectMap` resets task selection and spawn; `toggleTask` adds then removes; `toggleCompleted` round-trips; persisted partialize includes `tracker` and `selectedMapId` only-if — persist whole state minus `search`.
- [ ] **Step 2: Run, confirm fail.**
- [ ] **Step 3: Implement** (add deps `zustand@^4`).
- [ ] **Step 4: Run, confirm pass.**
- [ ] **Step 5: Commit** (`feat(web): persisted planner store`).

---

### Task 8: Map canvas

**Files:**
- Create: `apps/web/src/components/MapCanvas.tsx`
- Modify: `apps/web/src/App.tsx` (temporary harness rendering MapCanvas for customs full-viewport)

**Interfaces:**
- Consumes: `RpMap`, `MapCalibration`, `snapshot` from `@raidplanner/data`; `makeCrs`, `gameToLatLng`, `boundsToLatLng` from `../lib/tarkovCrs`; `PlannedRoute` from `../lib/route`; leaflet (add deps `leaflet@^1.9`, `@types/leaflet`).
- Produces:
  ```ts
  export interface MapMarker { id: string; position: GamePosition; label: string; kind: 'objective' | 'spawn'; orderIndex?: number; taskName?: string }
  export interface MapCanvasProps {
    map: RpMap;                       // must have calibration (caller guards)
    markers: MapMarker[];
    route: PlannedRoute | null;       // polyline spawn→stops when set
    onMapClick?: (p: GamePosition) => void;   // used later for custom spawn
  }
  export function MapCanvas(props: MapCanvasProps): JSX.Element;
  ```
- Behaviour: one `L.map` instance per mounted canvas (`useRef`), recreated when `map.id` changes (CRS cannot be swapped live): `L.map(el, { crs: makeCrs(cal), minZoom: -2, maxZoom: 4, zoomSnap: 0.25, attributionControl: false })`, `L.imageOverlay('/maps/' + cal.svgFile, boundsToLatLng(cal.svgBounds ?? cal.bounds))`, `fitBounds` on create. Markers/route sync in a separate effect that clears and redraws two `L.layerGroup`s. Objective markers: `L.divIcon` `<div class="marker objective">N</div>` (orderIndex+1, or •), spawn marker `<div class="marker spawn">S</div>`; tooltip = `taskName — label`. Route: `L.polyline(points, { color: 'var(--route)' resolved to #d4bb70, weight: 2, dashArray: '6 4' })`. Import `leaflet/dist/leaflet.css` in `main.tsx`. Marker CSS in `styles.css` (accent bg, black text, 20px circle, border 1px `--border`).

- [ ] **Step 1: Implement component + harness.** In `App.tsx`, render customs (`snapshot.maps.find(m => m.normalizedName === 'customs')`) with three real objective markers pulled from the snapshot (first task with points on customs) and `route: null`.
- [ ] **Step 2: Verify manually.** `pnpm dev`, open `http://localhost:5173`, confirm: SVG renders, pan/zoom works, markers sit on plausible locations (compare one against tarkov.dev's own map for the same quest), no console errors. Check via browser tooling; capture screenshot.
- [ ] **Step 3: `pnpm build` passes** (tsc strict + vite).
- [ ] **Step 4: Commit** (`feat(web): leaflet map canvas with calibrated SVG overlay`).

---

### Task 9: Sidebar — map picker, quest list, tracker

**Files:**
- Create: `apps/web/src/components/Sidebar.tsx`, `apps/web/src/components/QuestList.tsx`, `apps/web/src/components/TrackerBar.tsx`
- Modify: `apps/web/src/App.tsx` (real layout: sidebar 340px left, map fills rest)

**Interfaces:**
- Consumes: `usePlanner`, `snapshot`, `questsForMap`, `anywhereQuests`, `isAvailable`, `MapQuestEntry`.
- Produces: `Sidebar()` (no props — reads store). Internal composition: `TrackerBar` (level number input, faction select, "completed: N" count), map picker (`<button>` grid of renderable maps, name + open-quest count badge, selected state), search `<input>`, `QuestList({ entries: MapQuestEntry[] })`.
- QuestList behaviour: group by trader name; each row = checkbox (select for planning) + name + relation badge (`MAP` gold / `MULTI` dim / objective count) + "done" toggle button (marks completed in tracker, row gets strikethrough); rows filtered by `search` (case-insensitive substring on name) and `onlyAvailable` toggle; selecting a row with zero points on this map still allowed (it just adds no markers); collapsed `<details>` section "Anywhere quests" at the bottom listing `anywhereQuests` (no checkboxes, informational with done-toggle).
- All controls keyboard-reachable; checkboxes are real `<input type="checkbox">` with `<label>`; badges have `title` text; focus outline `2px solid var(--accent)`.

- [ ] **Step 1: Implement components + wire layout.** App shell: `<div class="app"><Sidebar/><main><MapCanvas .../></main></div>`, grid `340px 1fr`, sidebar scrolls independently.
- [ ] **Step 2: Wire markers.** In `App.tsx` derive markers: for each selected task, `objectivePoints(task, selectedMapId)` → one marker per objective using the point nearest spawn (or first point when no spawn); memoized.
- [ ] **Step 3: Verify manually** in browser: pick Customs → quest list populates with plausible quests (cross-check 2 known Customs quests, e.g. Debut/Checking); select two quests → markers appear; mark one done → disappears from available filter; reload → tracker persisted.
- [ ] **Step 4: `pnpm build` + `pnpm test` green.**
- [ ] **Step 5: Commit** (`feat(web): sidebar with map picker, quest list, tracker`).

---

### Task 10: Spawn selection, routing, recommendation

**Files:**
- Create: `apps/web/src/components/RoutePanel.tsx`, `apps/web/src/components/SpawnPicker.tsx`, `apps/web/src/components/RecommendBanner.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `usePlanner`, `optimizeRoute`, `recommendMaps`, `objectivePoints`, `MapCanvas` props.
- Produces: `SpawnPicker()` — `<select>` of the selected map's PMC spawn zones (spawns where `sides` includes `'pmc'` or `'all'`, deduped by `zoneName`, option label = zoneName, value stores first position of that zone) plus option "Click map…" which arms `onMapClick` to set `{kind:'custom'}` spawn. `RoutePanel()` — right-docked panel (280px) listing ordered stops: `N. taskName — objective description — +Xm` (leg distance, game units ≈ meters, rounded), total at bottom, empty-states ("select quests", "pick a spawn to route"). `RecommendBanner()` — above the map, top-3 from `recommendMaps` for current tracker: "Best maps for your quests: Customs (12) · Woods (8) · …", each a button that switches map; hidden when the selected map is already #1.
- Route derivation (in `App.tsx`, memoized): when spawn set and ≥1 selected task with points on map → build `RouteStop[]` (per objective, point nearest spawn), `optimizeRoute(spawn.position, stops)`; pass to `MapCanvas` and `RoutePanel`; markers get `orderIndex` from route order.

- [ ] **Step 1: Implement all three + wiring.**
- [ ] **Step 2: Verify manually**: pick spawn zone → S marker; select 3 quests → numbered markers + dashed polyline in visit order; route order changes sensibly when switching spawn to opposite side of map; custom spawn via map click works; recommendation banner lists plausible counts and switches maps.
- [ ] **Step 3: `pnpm build` + all tests green.**
- [ ] **Step 4: Commit** (`feat(web): spawn picker, route planning, map recommendation`).

---

### Task 11: Polish, a11y, attribution, README

**Files:**
- Modify: `apps/web/src/styles.css`, `App.tsx`, components as needed
- Create: `README.md`, `apps/web/src/components/Footer.tsx`

**Interfaces:** none new.

- [ ] **Step 1: Load `accessibility` and `make-interfaces-feel-better` skills; apply.** Minimum bar: contrast-check palette combos used for text (fix tokens if any pair < 4.5:1); visible focus states everywhere; quest rows ≥ 32px hit height; map has an aria-label; banner/panel landmarks (`nav`, `main`, `aside`); reduced-motion: no animations added that ignore `prefers-reduced-motion`.
- [ ] **Step 2: Footer** with attribution (per Global Constraints) + snapshot date from `snapshot.generatedAt` + "refresh: pnpm snapshot".
- [ ] **Step 3: README**: what it is, screenshot, `pnpm install && pnpm dev`, `pnpm snapshot` to refresh data, offline note, hosting note (static dist), v1 limitations (tile-only maps not rendered, routing is euclidean — ignores walls/terrain, spawn list is zone-level).
- [ ] **Step 4: Full verification**: `pnpm build`, `pnpm test` (all workspaces), fresh browser pass over the Task 10 checklist, Lighthouse-style sanity on bundle (snapshot.json should be lazy-loadable later — note as future work if > 3MB gzip; do not optimize now).
- [ ] **Step 5: Commit** (`docs+polish: a11y pass, attribution, README`).

---

## Self-review notes

- Spec coverage: map selection (T9), map-relevant quests incl. multi-map (T4/T9), exact locations on map (T2 points + T8), multi-select + efficient route (T5/T10), spawn input (T10), offline (T2, global), Tarkov palette (global + T11), quest tracker foundation (T4 availability + T7 store + T9 toggles), map recommendation (T6/T10), Turborepo+TS+React+Vite (T1), hostable later (static build).
- Known v1 simplifications, stated where they live: euclidean routing (T5), `active`-status requirement handling (T4), nearest-candidate point per objective (T5/T9), tile-based maps unrendered (global), floor layers ignored (T2).
- Order check: every task consumes only earlier interfaces. Names cross-checked: `questsForMap`/`anywhereQuests`/`objectivePoints`/`isAvailable` (T4) used in T6/T9/T10; `optimizeRoute`/`PlannedRoute` (T5) in T8/T10; `makeCrs`/`gameToLatLng`/`boundsToLatLng` (T3) in T8; store actions (T7) in T9/T10.
