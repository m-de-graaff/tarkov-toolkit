# Production Readiness Roadmap

> Source: full-codebase audit (2026-08-05). This file is the backlog; each slice
> gets its own detailed plan doc when its turn comes. Slices are ordered by
> user harm: data loss first, broken UX second, hardening third, polish last.

**Overall assessment:** clean architecture, good pure-logic test coverage, but
not production-hardened: concrete data-loss paths, no error boundary/404, `api/`
outside the workspace (never type-checked in CI), no rate limiting, and two
real security issues in the companion watcher.

## Slice 1 — Data persistence & sync integrity  ✅ DONE (PR: feat/data-persistence-hardening)
Plan: `2026-08-05-data-persistence-hardening.md`

- Sign-in on a shared browser merges the previous user's progress into the new
  account and pushes it (`useProgressSync.ts:60-65`; sign-out never clears).
- Two open tabs silently clobber each other (no `storage`-event rehydrate).
- `QuotaExceededError` inside a store action blanks the app (no safe storage
  adapter, no error boundary yet).
- Corrupt localStorage is *not* repaired from the IndexedDB mirror
  (`storage.ts:55` restores only when the key is absent), and the mirror then
  flushes defaults over the good backup 1s later.
- Edits during the sign-in pull window are dropped (`useProgressSync.ts:44`).
- Push failures are terminal: no retry, no `online` listener, no
  `pagehide`/`visibilitychange` flush; mirror flush only on `beforeunload`.
- Remote `version` accepted but never checked; migrations never run on synced
  payloads.
- `VITE_AUTH_ENABLED=false` *enables* auth (`authClient.ts:6` Boolean coercion).

## Slice 2 — App resilience & dead ends  ✅ core done (error boundary, 404, boot
recovery, ProgressPage guards — see `2026-08-05-app-resilience.md`); MarketPage
states + silent catches deferred to Slice 5 pass (user WIP in those files)
- Error boundary around the app (and around route content) with a "reload"
  affordance; no render throw may white-screen the SPA.
- `.catch` + user-visible recovery on the boot chunk-load path (`main.tsx:9-16`
  — stale index.html after deploy = permanent blank page today).
- 404 route (App.tsx defines 8 routes; vercel.json rewrites everything).
- MarketPage: distinguish loading / failed / empty-after-filter
  (`MarketPage.tsx:283-286` shows "fetching…" forever after a hard failure).
- ProgressPage: guard divide-by-zero (`ProgressPage.tsx:168`), clamp keyboard
  level input (`:192`).
- Surface (or at least dev-log) the silent catches: `prices.ts:42,58`,
  `storage.ts:58,72`, `handleStore.ts:28,44`, `useLiveWatcher.ts:81`,
  `PlannerPage.tsx:38,257`.

## Slice 3 — Server & deploy hardening
- Bring `api/` into the pnpm workspace so CI type-checks and tests it; add
  tests for auth gating, body cap, PUT validation, setup key check.
- Schema-validate the synced `state` blob server-side (`api/progress.ts:73`);
  a malformed `completedTaskIds` currently bricks sync for the account.
- Rate limiting (auth endpoints + progress PUT); better-auth's in-memory
  limiter is per-instance ≈ absent on serverless.
- `api/setup.ts`: replace `BETTER_AUTH_SECRET`-as-API-key with a dedicated
  secret + constant-time compare, or remove the endpoint post-migration.
- `trustedOrigins` env-driven (`api/_lib/auth.ts:14-17`).
- `db.ts`: pool error handler, ssl option, connection/statement timeouts.
- try/catch + logging around `pool.query` in `api/progress.ts:49,77`.
- Security headers in `vercel.json` (CSP, HSTS, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy).
- `installCommand` with `--frozen-lockfile`; `.dockerignore` `.env*`.

## Slice 4 — Companion watcher security
- WebSocket server (`apps/watcher/src/index.ts:132-139`) accepts any origin:
  any website in the browser can read live in-raid position. Add Origin
  allow-list (+ optional token).
- Auto-updater (`updater.ts:61-71`) swaps the exe with no checksum/signature
  verification. Verify a published checksum before install; make auto-install
  opt-in.
- Real tests for watcher (`package.json` test is `exit 0`); at minimum
  `compareVersions` and frame parsing.

## Slice 5 — UI clarity & performance
- Hosted app pulls ~16MB prices per mode direct from json.tarkov.dev on page
  load (`prices.ts:84-85`, no `/api/prices` rewrite in vercel.json;
  `usePrices.ts:53,56` auto-fetch + 30min refetch; `/xp` triggers too).
  Route through the caching proxy or make fetch user-triggered on hosted.
- MarketPage table remeasure on every render (`MarketPage.tsx:141-143`
  useLayoutEffect without deps + `useColumnWidths.ts:44-59` layout thrash);
  and thousands of unvirtualized rows.
- Mobile: nav strip overflow affordance (`TopNav.tsx:68`); Maps/Quests sheet
  only on /planner (`TopNav.tsx:48`).
- Remove or fulfil the PWA promise: manifest declares `standalone` but no
  service worker — "offline-first" install is a blank window offline.
- Fix the five `react-hooks/exhaustive-deps` disables (stale-closure risks in
  `MarketPage.tsx`, `useColumnWidths.ts:162`).

## Slice 6 — Accessibility pass
- AccountMenu dropdown: dialog semantics, focus trap/return, Escape
  (`AccountMenu.tsx:113-153`); scrim is a focusable button in tab order.
- Keyboard path for spawn placement (`MapCanvas.tsx:137-139,234-239`) and for
  column resize grips (`ResizableTH.tsx:29-35`).
- Color-only signaling: LivePanel status dot, Money profit/loss, Hideout
  ready-border; AmmoPage per-class ratings hidden behind one summary string.
- HomePage card link names (`HomePage.tsx:35-38`); MapCanvas marker labels
  reachable without hover (`MapCanvas.tsx:213-215`).

## Slice 7 — Test coverage for critical paths
- useProgressSync orchestration (pull race, retry, status), pullProgress /
  pushProgress HTTP behaviour (204/401/503).
- storage.ts mirror restore/flush incl. corrupt-blob path.
- Store: hydrating corrupt/partial blob; cross-tab rehydrate.
- Routing: all pages mount; unknown path renders 404.
- usePrices staleness/error; proxy allow-list; updater compareVersions.
  (Each slice above adds its own tests; this slice is the sweep for what's
  left.)
