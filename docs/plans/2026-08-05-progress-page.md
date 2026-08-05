# Progress Page & Few-Clicks Simplification Plan

> **To execute:** use the `executing-plans` skill. Steps use `- [ ]` for tracking.

**Goal:** Non-technical-friendly app in two pages: a Planner (map + open quests, few clicks) and a Progress page (TarkovTracker-style: level, faction, tick off completed quests). The sidebar always shows exactly the quests the user has open; the tracker UI moves off the sidebar entirely.

**Architecture:** `react-router-dom` with two routes under a slim top nav (wordmark + Planner/Progress tabs; on mobile the nav also hosts the "Maps & Quests" sheet trigger, replacing MobileTopBar). Progress state already lives in the persisted zustand store - the new page is UI over it. Sidebar drops the level/faction controls and the "only available" checkbox: open quests are simply what it shows, with a collapsed "Locked" disclosure and a link to the Progress page.

## Global Constraints

- Test contract selectors stay: `.quest-row`, `.marker.*`, `.route-steps li`, "live position", "Total ≈".
- Store: remove `onlyAvailable` (now meaningless); stale persisted key is ignored on rehydrate.
- Copy register: plain language, no jargon ("Show my position", "Mark quests you've finished").
- Reset progress uses a two-step confirm button (no window.confirm).

### Task 1: watcher watch-path regression test
- [x] Fake-timer test: file appearing after connect is picked up by the 2s poll. (Done before this plan was written - it passes; the watcher works.)

### Task 2: routing + top nav
- [x] Add `react-router-dom`; `App` = BrowserRouter + TopNav + Routes (`/` PlannerPage, `/progress` ProgressPage). Extract current App body into `pages/PlannerPage.tsx`; new `components/TopNav.tsx` (tabs via NavLink, `aria-current`, mobile sheet trigger for planner); delete MobileTopBar.
- [x] Suite + tsc + build green (App tests unaffected: default route renders Planner), commit.

### Task 3: Progress page
- [x] `pages/ProgressPage.tsx`: centered column; "Your PMC" card (level input, faction select, X of N quests done, Y open now); search; quests grouped by trader - each row: done-checkbox, name, min-level, lock hint when not yet available; two-step "Reset progress" button. New store action `resetProgress()`.
- [x] Test: toggling a quest row updates tracker + open counts; reset requires two clicks.
- [x] Suite green, commit.

### Task 4: sidebar simplification
- [x] Remove TrackerBar + "only available" checkbox from Sidebar; always show open quests; collapsed `<details>` "Locked on this map (N)" (dimmed rows, min-level shown, no plan checkbox); "Update your progress →" link to /progress; store drops `onlyAvailable`; LivePanel copy simplified ("Show my position" + folder hint).
- [x] Update affected tests (store, App); suite + build green, commit.

### Task 5: land
- [x] Full verification, README update, merge to main (pre-authorized).
