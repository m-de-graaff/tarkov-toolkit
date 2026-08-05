# App Resilience Implementation Plan (Roadmap Slice 2)

> **To execute:** use the `executing-plans` skill. Steps use `- [ ]` for tracking.

**Goal:** No render throw, failed deploy-time chunk load, or dead-end URL may
leave the SPA blank or stuck; page-level math/input guards on ProgressPage.

**Architecture:** A class-based ErrorBoundary (React 18 has no hook equivalent)
wraps the routed content inside App so the nav always survives; a catch-all
route renders a NotFoundPage inside the shell; the boot promise chain in
main.tsx gets a plain-DOM failure fallback (React itself may be the thing that
failed to load); two point guards on ProgressPage.

**Tech stack:** React 18, react-router-dom 7, vitest 2 + jsdom.

**Deferred from Slice 2** (user has active WIP in these files — pick up in a
later iteration): MarketPage loading/failed/empty states, silent-catch
surfacing in prices.ts, exhaustive-deps fixes.

## Global Constraints

- Match existing component idiom: function components, Tailwind classes, ui/
  primitives (`Button`), lucide icons.
- Every new component keyboard-reachable and labelled (accessibility skill).
- Tests colocated; run via `pnpm --filter @raidplanner/web test`.

---

### Task 1: ErrorBoundary around routed content

**Files:**
- Create: `apps/web/src/components/ErrorBoundary.tsx`
- Test: `apps/web/src/components/ErrorBoundary.test.tsx`
- Modify: `apps/web/src/App.tsx` (wrap the `<Routes>` region)

**Interfaces:**
- Produces: `class ErrorBoundary extends Component<{ children: ReactNode }>` —
  default export not required; named export. On error renders a centered card:
  heading "Something went wrong", body copy, a "Reload page" `Button`
  (`onClick: () => location.reload()`) and a "Try again" `Button`
  (resets boundary state so navigation elsewhere works without a full reload).
  `componentDidCatch` logs via `console.error` (the app is client-only; no
  telemetry sink exists yet).
- Keyed remount: App passes `key={location.pathname}`? No — instead the
  boundary exposes `resetKey` prop; App passes the current pathname so a route
  change auto-resets the boundary (`getDerivedStateFromProps` comparison).

- [ ] **Step 1: Failing test** — a child that throws renders the fallback
  (React logs suppressed via `vi.spyOn(console, 'error')`); "Try again" resets;
  changing `resetKey` resets.
- [ ] **Step 2: Run fail → implement → green.**
- [ ] **Step 3: Wrap routes in App.tsx** with
  `<ErrorBoundary resetKey={location.pathname}>` (App already has access to
  location via `useLocation` or wraps inside `BrowserRouter` — check and place
  accordingly; the nav must stay OUTSIDE the boundary).
- [ ] **Step 4: Full suite, commit.**

### Task 2: 404 route

**Files:**
- Create: `apps/web/src/pages/NotFoundPage.tsx`
- Test: `apps/web/src/pages/NotFoundPage.test.tsx`
- Modify: `apps/web/src/App.tsx` (`<Route path="*" element={<NotFoundPage />} />`)

**Interfaces:**
- Produces: `NotFoundPage` — centered card: "Page not found", the bad path,
  and links (`react-router-dom` `Link`) to Home and the Planner. Inside the
  shell so the nav is present.

- [ ] **Step 1: Failing test** — render App at `/no-such-page`; expect
  "Page not found" text and a link to `/`.
- [ ] **Step 2: Run fail → implement → green, commit.**

### Task 3: Boot failure fallback

**Files:**
- Modify: `apps/web/src/main.tsx`

**Interfaces:**
- Consumes: the existing `restoreProgressFromMirror().then(...)` chain.
- Produces: a `.catch` that innerHTML-renders (plain DOM, no React) into
  `#root`: "The app failed to load" + a reload `<button>`. Copy mentions the
  likely cause (connection lost / new version deployed).

- [ ] **Step 1: Implement** (no test file — jsdom can't simulate a failed
  dynamic import of the real modules meaningfully; the catch handler is
  4 lines of DOM. Verified by type-check + build).
- [ ] **Step 2: Full suite + build, commit.**

### Task 4: ProgressPage guards

**Files:**
- Modify: `apps/web/src/pages/ProgressPage.tsx` (`:168` percent division,
  `:192` level input)
- Test: extend `apps/web/src/pages/ProgressPage.test.tsx`

**Interfaces:**
- Percent: `total === 0 ? 0 : Math.round((done / total) * 100)`.
- Level input: clamp typed values into `[1, 79]` on change/blur
  (`Math.min(79, Math.max(1, n))`), non-numeric input leaves level unchanged.

- [ ] **Step 1: Failing tests** — typing `999` in the level input yields 79;
  typing `0` yields 1.
- [ ] **Step 2: Run fail → implement → green, full suite, commit.**
