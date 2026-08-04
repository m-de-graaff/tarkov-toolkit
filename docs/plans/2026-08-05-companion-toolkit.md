# Companion Watcher, Toolkit Shell & Scrollbars Plan

> **To execute:** use the `executing-plans` skill. Steps use `- [ ]` for tracking.

**Goal:** (1) A standalone file-watcher process (like TarkovPilot) so live position works in any browser — the web app auto-detects it over a local WebSocket; the in-browser folder picker stays as the zero-install fallback. (2) Reframe the app as the "Tarkov Toolkit" — a shell with tools (Raid Planner today; barter calculator, flea prices later slot in as new routes). (3) Themed thin scrollbars.

**Architecture:** New workspace `apps/watcher`: a small Node CLI that `fs.watch`es `Documents\Escape from Tarkov\Screenshots`, parses filenames with `@raidplanner/live` (built for exactly this reuse), and broadcasts fixes over a `ws` WebSocket server bound to `127.0.0.1:17520`. On startup it also broadcasts the newest existing screenshot (same initial-fix rule as the browser path). The web app's `useLiveWatcher` gains a companion transport: it quietly tries the WebSocket on mount, retries every 5s, and prefers it over the File System Access path; `LivePanel` reflects which transport is active. Node 24 runs the shared TS engine directly via type stripping.

## Global Constraints

- WS server binds 127.0.0.1 only; port 17520, overridable via `RAIDPLANNER_WATCHER_PORT`.
- Message protocol: `{"type":"hello","app":"raidplanner-watcher"}` on connect, then `{"type":"fix","fix":LiveFix}` per screenshot (newest-existing first).
- Web app never errors visibly when the companion is absent — silent retry; FSA button remains the visible affordance.
- Test determinism: jsdom test setup stubs `WebSocket` with an inert fake (never connects) so the hook's auto-connect cannot touch the network.
- Toolkit shell: wordmark "Tarkov Toolkit"; nav tabs "Raid Planner" (`/`), "Progress" (`/progress`); `<title>` and README updated; `@raidplanner/*` package names stay (rename is churn with no user value).
- Companion is started with `pnpm watcher` for now — packaging as a double-click .exe is future work, stated in README.
- Scrollbars: global `scrollbar-width: thin` + `scrollbar-color` and `::-webkit-scrollbar` (8px, `--border` thumb, transparent track, rounded) in `index.css`.

### Task 1: `apps/watcher` companion process
- [ ] `apps/watcher/package.json` (name `@raidplanner/watcher`, dep `ws`, dep `@raidplanner/live`, script `start`: `node --experimental-strip-types src/index.ts`; root script `watcher`), `src/index.ts`: resolve screenshots dir (`%USERPROFILE%\Documents\Escape from Tarkov\Screenshots`, overridable via argv/env), `fs.watch` + 2s poll fallback listing, broadcast protocol per constraints, console lines a non-dev can read ("Watching …", "Position sent: x,y,z").
- [ ] Verify by running it against the real folder: starts, logs the existing screenshot broadcast; `node -e` WS client receives hello + fix. Commit.

### Task 2: web companion transport
- [ ] `useLiveWatcher`: `companion` state ('absent' | 'connected'); on mount open `ws://127.0.0.1:17520`, retry 5s on close/error (cleanup on unmount); on fix message `setLiveFix`; FSA path untouched; when companion connected, FSA controls hidden. `LivePanel`: "Companion app is watching your screenshots" + dot when connected; otherwise existing button plus a muted "or run the companion app (any browser)" hint linking README anchor.
- [ ] Test setup WebSocket stub; new hook test: simulate stubbed socket firing hello+fix → store updated (drive the stub manually).
- [ ] Suite + build green, commit.

### Task 3: toolkit shell + scrollbars
- [ ] TopNav wordmark → "Tarkov Toolkit", tab label "Raid Planner"; `index.html` title; README intro reframed (toolkit; current tool: raid planner + progress; roadmap: barter calculator, flea prices); scrollbar CSS.
- [ ] Suite + build green, commit.

### Task 4: land
- [ ] Full verification, merge to main (pre-authorized), memory update.
