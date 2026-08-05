# Live Position (screenshot → map) Implementation Plan

> **To execute:** use the `executing-plans` skill. Steps use `- [ ]` for tracking.

**Goal:** Take a screenshot in-game and your position (with facing direction) appears on the planner map within ~2s, and the quest route re-plans from where you actually are.

**Architecture:** EFT writes screenshots named `YYYY-MM-DD[HH-MM]_x, y, z_qx, qy, qz, qw_fov (n).png` - position and rotation are in the filename, so no OCR and no server. A new workspace package `@raidplanner/live` holds the pure parsing engine (filename → position + yaw), ported from the-hideout/TarkovMonitor (MIT) - this replaces the tarkov-market.com round-trip that eftgps/TarkovPilot rely on. `apps/web` gains a Live Mode: the browser's File System Access API (`showDirectoryPicker`) watches the Screenshots folder by polling every 2s; the newest unseen screenshot updates a player marker (rotated arrow) and swaps the route origin from spawn to the live position.

**Tech stack:** existing stack; no new runtime deps. File System Access API (Chrome/Edge; graceful "not supported" note elsewhere). Minimal ambient TS declarations for the FSA API instead of a types package.

## Global Constraints

- Still **zero runtime network requests**; live mode reads a local folder the user explicitly grants.
- The parsing engine must live in `packages/live` (name `@raidplanner/live`), pure and DOM-free, so it is testable in node and reusable by any future companion app.
- Parsing regexes and yaw math ported exactly from TarkovMonitor `GameWatcher.cs` (captured in scratchpad):
  - filename: `/\d{4}-\d{2}-\d{2}\[\d{2}-\d{2}\]_?(?<position>.+) \(\d\)\.png/`
  - position: `/(?<x>-?\d+\.\d{2}), (?<y>-?\d+\.\d{2}), (?<z>-?\d+\.\d{2})_?(?<rx>-?[\d.]\.\d{1,5}), (?<ry>-?[\d.]\.\d{1,5}), (?<rz>-?[\d.]\.\d{1,5}), (?<rw>-?[\d.]\.\d{1,5})/`
  - yaw (degrees): `atan2(2*(qw*qy + qx*qz), 1 - 2*(qy*qy + qz*qz)) * 180/π` (Unity Y-up)
- Player marker heading on screen = yaw + map `coordinateRotation` (tarkov-dev convention).
- Route origin precedence: live position (when live mode connected and a fix exists) > selected spawn.
- If a live fix lies outside the selected map's calibration bounds, show a non-blocking warning ("position looks like another map") - do not auto-switch maps (filenames carry no map id).

---

### Task 1: `@raidplanner/live` parsing engine

**Files:**
- Create: `packages/live/package.json`, `packages/live/tsconfig.json`, `packages/live/src/index.ts`, `packages/live/src/parse.ts`, `packages/live/src/parse.test.ts`
- Modify: root `turbo.json` (nothing - tasks already generic), `apps/web/package.json` (dep `@raidplanner/live: workspace:*`)

**Interfaces:**
- Produces (from `@raidplanner/live`):
  ```ts
  export interface LiveFix {
    position: { x: number; y: number; z: number };
    yawDeg: number;          // heading, degrees, Unity Y-up yaw
    takenAt: string | null;  // "YYYY-MM-DD[HH-MM]" from the filename, null if absent
    raw: string;             // the filename parsed
  }
  export function parseScreenshotName(filename: string): LiveFix | null;
  export function isScreenshotName(filename: string): boolean;
  ```
- Package: `"main": "src/index.ts"`, no build step (consumed by Vite), `test`: `vitest run`, `build`: `tsc --noEmit`. Add vitest+typescript devDeps.

- [x] **Step 1: Failing tests.** Real-shaped cases: `parseScreenshotName('2026-08-04[21-33]_-105.40, 2.80, 116.40_0.0, -0.1, 1.0, -0.1 (0).png')` → position `{x:-105.4, y:2.8, z:116.4}`, finite yawDeg; a name with fov suffix `..._12.20 (0).png` still parses; yaw sanity: quaternion `(0,0,0,1)` → 0°, `(0, 0.7071, 0, 0.7071)` → 90°; garbage (`'inventory.png'`, empty string) → null; `isScreenshotName` true/false accordingly.
- [x] **Step 2: Run, confirm fail** (`pnpm --filter @raidplanner/live exec vitest run`).
- [x] **Step 3: Implement** `parse.ts` with the exact regexes/math from Global Constraints.
- [x] **Step 4: Run, confirm pass.** Also `pnpm install` so the web app's workspace dep resolves.
- [x] **Step 5: Commit** (`feat(live): screenshot filename parsing engine`).

---

### Task 2: Live Mode state + folder watcher hook

**Files:**
- Create: `apps/web/src/lib/fsAccess.d.ts` (ambient: `showDirectoryPicker`, `FileSystemDirectoryHandle.values()`), `apps/web/src/lib/useLiveWatcher.ts`
- Modify: `apps/web/src/store.ts`

**Interfaces:**
- Store additions (not persisted - a directory handle cannot round-trip localStorage):
  ```ts
  liveFix: LiveFix | null;
  setLiveFix(f: LiveFix | null): void;
  ```
  (`partialize` must now also strip `liveFix`.)
- `useLiveWatcher(): { supported: boolean; connected: boolean; connect(): Promise<void>; disconnect(): void; error: string | null }`
  - `connect()` calls `showDirectoryPicker({ mode: 'read' })`, seeds a `seen` set with all current `.png` names (so only *new* screenshots count), then polls every 2000ms via `setInterval`; each poll iterates `handle.values()`, and for any unseen file where `isScreenshotName(name)`, parses and `setLiveFix` for the lexicographically-latest new name; on `NotAllowedError`/`AbortError` sets `error`/stays disconnected. `disconnect()` clears the interval and `setLiveFix(null)`. Interval cleaned up on unmount (hook owns it via refs).

- [x] **Step 1: Store test additions** (extend `store.test.ts`): `setLiveFix` round-trips; persisted payload contains neither `search` nor `liveFix`.
- [x] **Step 2: Run store tests - fail; implement store changes; pass.**
- [x] **Step 3: Implement `fsAccess.d.ts` + `useLiveWatcher`** (no direct unit test - jsdom has no FSA API; covered by the Task 3 component test via a stubbed hook seam: export the internal `pickNewestFix(names: string[], seen: Set<string>): string | null` helper and unit-test that in node).
- [x] **Step 4: `tsc --noEmit` green.**
- [x] **Step 5: Commit** (`feat(web): live-mode store state and folder watcher hook`).

---

### Task 3: Map + route integration

**Files:**
- Create: `apps/web/src/components/LivePanel.tsx`
- Modify: `apps/web/src/components/MapCanvas.tsx` (player marker kind), `apps/web/src/App.tsx` (route origin precedence, live marker, out-of-bounds warning), `apps/web/src/styles.css`

**Interfaces:**
- `MapMarker.kind` gains `'player'`; when kind is `player`, `MapCanvas` renders a `divIcon` `<div class="marker player" style="transform: rotate(<yaw + coordinateRotation>deg)">➤</div>`; new optional `MapMarker.yawDeg?: number`.
- `LivePanel()` - placed in the map toolbar: unsupported browser → dim note "Live mode needs Chrome/Edge"; otherwise Connect/Disconnect button, status dot (connected/idle), last-fix age text ("fix 12s ago", `tabular-nums`), and the out-of-bounds warning slot.
- `App.tsx`: `routeOrigin: GamePosition | null = liveFix?.position ?? spawn?.position ?? null`; stops/route/markers derive from `routeOrigin` (nearest-candidate-point selection now keys on it); RoutePanel receives `originLabel: 'live position' | 'spawn'` and renders "From your live position" when live; player marker appended when `liveFix` and map selected; warning computed via calibration bounds containment.

- [x] **Step 1: Failing integration test** (extend `App.test.tsx`): with customs selected, two located quests toggled, no spawn, `setLiveFix({position: knownCustomsPoint, yawDeg: 90, ...})` → route panel shows steps (live position acts as origin), `.marker.player` exists; then `setSpawn(custom)` → route still originates from live fix (precedence).
- [x] **Step 2: Run, confirm fail.**
- [x] **Step 3: Implement.**
- [x] **Step 4: Run full web suite + `pnpm build` - green.**
- [x] **Step 5: Commit** (`feat(web): live player marker and live-origin routing`).

---

### Task 4: Docs, polish, verification

**Files:**
- Modify: `README.md`, `docs/plans/2026-08-04-live-position.md` (ticks), `apps/web/src/styles.css` (player marker polish: accent ring, reduced-motion-safe pulse)

- [x] **Step 1: README section "Live raid mode"** - how it works (filename parsing, credit TarkovMonitor MIT), browser support, privacy note (folder read-only, nothing leaves the machine), limitations (map not auto-detected; Firefox unsupported).
- [x] **Step 2: Full suite + build green** (`pnpm test`, `pnpm build`).
- [x] **Step 3: Commit** (`docs: live raid mode`), merge branch to main after suite passes (user pre-authorized landing this feature: "open pr, merge into main etc.").

## Self-review notes

- Spec coverage: screenshot → position on our map (T1-T3), route auto-adjusts from position (T3), improved/stripped tarkov-market approach - local parsing, no selenium/website (T1), "new app" → standalone engine package + integrated UI (deviation, reported).
- Order: T2 depends only on T1 types; T3 on both; names cross-checked (`LiveFix`, `parseScreenshotName`, `isScreenshotName`, `liveFix`/`setLiveFix`, `pickNewestFix`, marker kind `'player'`).
- Known risks: FSA API polling perf (2s over a folder of a few hundred files is fine); filename fov segment optional in regex (position regex tolerates both since rotation group is anchored by `_?`).
