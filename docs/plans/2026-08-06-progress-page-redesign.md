# Progress Page Redesign Implementation Plan

> **To execute:** use the `executing-plans` skill. Steps use `- [ ]` for tracking.

**Goal:** Split the Progress page into Story and Quests tabs, upgrade the storyline into a
guided timeline (what to do, where to be), and replace the giant stacked trader list with a
trader-rail board grouped by actionability.

**Architecture:** `ProgressPage.tsx` becomes a shell (PMC card + tabs, synced to `?tab=`);
the story UI moves to `components/StoryTimeline.tsx` (timeline with done/current/upcoming
states and planner deep-links); the quest UI moves to `components/TraderQuestBoard.tsx`
(trader rail + Open/Locked/Completed grouping, with human-readable lock reasons from
`lib/lockReasons.ts`). Design agreed via Mark's brief ("tabs; show what to do and where to
be; the trader list is a gigantic wall") — assumptions recorded per task.

**Tech stack:** React 18 SPA, zustand store, shadcn/radix primitives (`@radix-ui/react-tabs`
is the one new dependency), vitest + jsdom with raw `createRoot`/`act` tests.

## Global Constraints

- Follow existing test idiom: `createRoot` + `act`, no testing-library.
- Icons stay decorative; every interactive element keyboard-operable (radix Tabs supplies
  tab semantics; chips are `<button aria-pressed>`).
- All tracker mutations go through existing store actions (`toggleCompleted`,
  `toggleStoryChapter`, `setLevel`, `setFaction`) — no new store fields.
- PvE/PvP mode filtering stays via `snapshotForMode`.
- No row virtualization, no dependency-graph visualization (deferred).

---

### Task 1: Tabs shell

**Files:**
- Create: `apps/web/src/components/ui/tabs.tsx` (standard shadcn wrapper over
  `@radix-ui/react-tabs`: exports `Tabs, TabsList, TabsTrigger, TabsContent`)
- Modify: `apps/web/src/pages/ProgressPage.tsx` (PMC card stays above; StorylineSection
  renders under `<TabsContent value="story">`, filter bar + trader sections under
  `<TabsContent value="quests">`)
- Modify: `apps/web/package.json` (add `@radix-ui/react-tabs`)
- Test: `apps/web/src/pages/ProgressPage.test.tsx`

**Interfaces:**
- Produces: URL contract `?tab=quests|story` via `useSearchParams` (default `quests`;
  invalid values fall back to `quests`). Helper inside ProgressPage:
  `const tab = params.get('tab') === 'story' ? 'story' : 'quests'`;
  `setTab(next)` writes `setParams({ tab: next }, { replace: true })`.
- Consumes: existing `StorylineSection` markup (moved verbatim in this task; replaced in
  Task 2).

- [ ] Step 1: `pnpm --filter web add @radix-ui/react-tabs`, write `ui/tabs.tsx` following
      the shadcn v4 template already used by `ui/select.tsx` (cn-based classNames).
- [ ] Step 2: Restructure ProgressPage; keep every existing section's markup unchanged.
- [ ] Step 3: Update ProgressPage tests: existing quest-list tests first click the
      "Quests" tab trigger if not default; add test — rendering with
      `?tab=story` shows chapter checkboxes and hides the quest search input; clicking
      "Story" trigger updates the URL param.
- [ ] Step 4: Full web suite green; commit `feat(web): split progress into story and quest tabs`.

### Task 2: Story timeline

**Files:**
- Create: `apps/web/src/components/StoryTimeline.tsx`
- Modify: `apps/web/src/pages/ProgressPage.tsx` (replace moved StorylineSection with
  `<StoryTimeline />`; delete the old section code)
- Test: `apps/web/src/components/StoryTimeline.test.tsx`

**Interfaces:**
- Consumes: `storyChapters`, `STORY_WIKI_URL` from `../data/storyline`;
  `usePlanner((s) => s.tracker.storyChapterIds / toggleStoryChapter / selectMap)`;
  `useNavigate` from react-router.
- Produces: `export function StoryTimeline(): JSX.Element` (no props).

Behavior spec:
- Header: `n/9 chapters` + existing progressbar pattern + wiki link.
- Ordered list, visual vertical connector (border-l on a pl-6 container, absolute dot per
  step). Step states: `done` = every chapter whose id is in `storyChapterIds`;
  `current` = the FIRST chapter (by `order`) not done; rest `upcoming`.
- Done step: single collapsed row — checkbox (checked), name struck through. No body.
- Current step: highlighted card (`border-primary/60 bg-card`), "Current chapter" label,
  full `start` text under a "How to start" caption, `notes` paragraph when present, and a
  map row: if `startMap` set, a solid-variant chip `Starts on <map>`, then outline chips
  for the remaining `maps`. Every chip whose map exists in `snapshot.maps` AND has
  `calibration` is a `<button>` that calls `selectMap(map.id)` then `navigate('/planner')`
  (title: `Open <map> in the planner`); non-renderable maps render as plain `<Badge>`.
- Upcoming step: name + checkbox + `start` text at `text-muted-foreground`, maps as plain
  badges. (Everything stays tickable out of order — players skip around.)

- [ ] Step 1: Write failing tests: (a) first unfinished chapter gets the
      "Current chapter" label and shows its start text; (b) ticking chapter 1 moves the
      label to chapter 2 (store-driven re-render); (c) a map chip click for a renderable
      map sets `usePlanner.getState().selectedMapId` to that map's id and
      `window.location.pathname` to `/planner` (render under `<BrowserRouter>`).
- [ ] Step 2: Implement; run; green. Full suite. Commit
      `feat(web): storyline tab as a guided timeline`.

### Task 3: Lock reasons

**Files:**
- Create: `apps/web/src/lib/lockReasons.ts`
- Test: `apps/web/src/lib/lockReasons.test.ts`

**Interfaces:**
- Produces:
  `export function lockReasons(task: RpTask, tracker: TrackerState, byId: ReadonlyMap<string, RpTask>): string[]`
  — empty array means not locked (mirrors `isAvailable === true` for uncompleted tasks).
  Reason strings, in priority order: `Lv ${task.minPlayerLevel}` when
  `tracker.level < minPlayerLevel`; `${task.factionName} only` when the faction check of
  `isAvailable` fails; `after ${byId.get(req.taskId)?.name}` for each unmet
  `complete`-status requirement (cap at 2, then `+N more`).
- Consumes: `TrackerState` from `./availability` (duplicate its faction/level/prereq
  predicates exactly — add a unit test asserting `lockReasons(...).length === 0` iff
  `isAvailable(task, tracker)` for a sweep of fixture tasks).

- [ ] Step 1: Failing tests using `lib/fixtures.ts` tasks (level gate, faction gate,
      one and three missing prereqs, agreement-with-isAvailable sweep).
- [ ] Step 2: Implement; green; commit `feat(web): human-readable quest lock reasons`.

### Task 4: Trader quest board

**Files:**
- Create: `apps/web/src/components/TraderQuestBoard.tsx`
- Modify: `apps/web/src/pages/ProgressPage.tsx` (quests tab renders `<TraderQuestBoard />`;
  the filter bar, `byTrader` memo and `ProgressQuestRow` move into the new file)
- Test: `apps/web/src/pages/ProgressPage.test.tsx` (board behavior is exercised through
  the page, matching existing test style)

**Interfaces:**
- Consumes: `lockReasons` (Task 3), `availableQuests`/`isAvailable`, `snapshotForMode`,
  `usePlanner`, URL param `trader` (raw trader name, e.g. `?trader=Ragman`; absent = All).
- Produces: `export function TraderQuestBoard(): JSX.Element` (no props).

Behavior spec:
- Sticky top rail (replaces the Locked/Completed chips): horizontally scrollable
  `<button aria-pressed>` chips — `All`, then one per trader with
  `<name> <completed>/<total>` and a small `· N open` suffix when N > 0. Selecting writes
  `?trader=`; unknown names fall back to All.
- Filters kept: search input, `Kappa only`, `Unlocks quests` chips. `Locked`/`Completed`
  visibility chips are REMOVED (grouping replaces them).
- All view: `Open now` section — every available quest across traders sorted by
  `minPlayerLevel` then name, row shows trader name prefix badge. Below it, one line per
  trader (`name — x/y done, N open`) as links that select the trader. No full lists.
- Trader view: three sections in order: `Open now (N)`, `Locked (N)`, `Completed (N)`.
  Completed is collapsed behind a `<details>` element (summary = heading). Locked rows
  append `lockReasons` joined with ` · ` in muted small text. Rows reuse the existing
  ProgressQuestRow anatomy (checkbox, detail link, Lv, KAPPA, dead-end) plus a map badge
  when `task.mapId` resolves in `snapshot.maps`.
- Search behaves as today (matches across everything shown; sections may be empty and
  then render nothing).

- [ ] Step 1: Failing page tests: (a) default quests tab shows the trader rail and an
      "Open now" heading, and does NOT render every trader section stacked; (b) selecting
      the Ragman chip shows `Locked` section rows carrying a lock reason string
      (`after` or `Lv`); (c) completed quests are hidden until the `Completed` details is
      opened; (d) rewrite the old "filter chips hide locked and non-kappa quests" test
      around the surviving chips (Kappa/Unlocks).
- [ ] Step 2: Implement; green; full suite + build; commit
      `feat(web): trader quest board with open/locked grouping`.

## Self-review notes

- Spec coverage: tabs → Task 1; "way better storyline / where to be" → Task 2 (timeline,
  start triggers, planner deep-links); "way better trader view" → Tasks 3+4.
- Order: Task 2 depends only on Task 1's tab shell; Task 4 depends on Task 3.
- Names checked: `StoryTimeline`, `TraderQuestBoard`, `lockReasons`, URL params `tab`,
  `trader` used consistently above.
- Ship points: after Task 1+2 (PR: story tab), after Task 3+4 (PR: trader board).
