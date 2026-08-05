# PvE / PvP Toggle Plan

> **To execute:** use the `executing-plans` skill. Steps use `- [ ]` for tracking.

**Goal:** A PvP/PvE toggle in the top nav. In-game these are fully separate progression profiles over ~95% shared quests (verified: 27 PvP-only tasks, ~23 PvE-only) - so: one union task dataset tagged per mode, and independent progress profiles per mode.

### Task 1: data - union tasks tagged with modes
- [x] `RpTask.modes: ('pvp'|'pve')[]`. Snapshot: fetch `regular/tasks` AND `pve/tasks` (+ `_en` each); build regular set as today (mode 'pvp'), mark ids also present in pve with 'pve', append pve-only tasks (mode ['pve'], same build path). Validator: union ≥ 520, both single-mode counts ≥ 15. Regenerate.
- [x] Commit.

### Task 2: store - game mode + per-mode profiles
- [x] `gameMode: 'pvp'|'pve'` (default 'pvp'); `profiles: Record<mode, TrackerState>`; `setGameMode(mode)` stashes the active `tracker` into `profiles[old]` and activates `profiles[new]`; persist version 1 with `migrate` (v0 `tracker` → pvp profile). Tests: toggle round-trips level/completions per mode; migration test via seeded localStorage.
- [x] TopNav: segmented PvP | PvE control (aria-pressed), all pages.
- [x] Commit.

### Task 3: mode-filtered tasks everywhere
- [x] `lib/modeTasks.ts`: `tasksForMode(snapshot, mode)` (memoized per mode). Sidebar (incl. anywhere list - move module-level precompute inside), ProgressPage list + totals, recommend, PlannerPage stop-building filter by active mode. Fixture tasks get `modes` (both). Integration test: a pve-only task appears on Progress only when PvE selected.
- [x] Suite + build green, commit.

### Task 4: land
- [x] Full verification, README note, merge to main (pre-authorized). Ecosystem research report delivered in the final message.
