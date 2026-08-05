# UI Iteration — resizable tables, ammo glow-up, interactive items/hideout, progress filters

> **To execute:** use the `executing-plans` skill. Steps use `- [ ]` for tracking.

### Task 1: resizable profit-table columns
- [ ] `lib/useColumnWidths.ts`: per-table-key column widths (px) with defaults, persisted to localStorage; `startDrag(index, event)` pointer-based resize (min 60px); `autoFit(index, table)` measures the widest cell (scrollWidth) and sets it (Excel double-click). `components/ResizableTH.tsx`: header cell with an invisible 8px grab strip on its right edge (`cursor-col-resize`, `onDoubleClick` auto-fit, keyboard-accessible via aria + arrow keys is out of scope — resize is a pointer affordance; note in a11y terms the data is never *only* reachable by resize).
- [ ] MarketPage: colgroups switch from % to stateful px widths per tab (`profit:<tab>` keys); table gets `min-w-max`-style behavior so shrinking below content overflows into the existing `overflow-x-auto` scroll.
- [ ] Suite + build green, commit.

### Task 2: ammo chart glow-up (tarkov.dev register)
- [ ] Snapshot: `AmmoRound.iconLink?` from items payload; regen.
- [ ] `lib/ammoSort.ts`: `classEffectiveness(pen, armorClass) -> 'excellent'|'good'|'fair'|'poor'|'none'` (thresholds around class*10: ≥+15 excellent, ≥+5 good, ≥−5 fair, ≥−15 poor) with tests; remove single penTier coloring from the table in favour of a 6-column class grid.
- [ ] AmmoPage: icon+name cell (SingleItem-style), stat columns, then a "Penetration by armor class" block — C1..C6 header, colored blocks per row (green→red scale, text label in title + visually-hidden text for a11y; color never the only signal: block shows a glyph/letter E/G/F/P/–).
- [ ] Suite + build green, commit.

### Task 3: inventory — items + hideout become one system
- [ ] Store: `tracker.itemsHave?: Record<itemId, number>` (per-mode profile), persist v3 migration adds it everywhere; actions `setItemHave(itemId, n)`.
- [ ] Items page: each row gets a have/need stepper (−/+, direct input) and a progress reading ("3 of 5 · 2 still needed"); completed rows (have ≥ total) tick visually and sink to a collapsed "covered" group. Rows remain searchable; FIR display unchanged.
- [ ] Hideout page: next-level item requirements show have/need per item (green when met); when ALL items met AND station/trader prereqs met → "Ready to build" badge; building (+) consumes the haves (decrements itemsHave by the requirement counts). Cross-links: Items page header links to Hideout and vice versa.
- [ ] Tests: stepper updates store; ready-to-build derivation (pure `lib/hideoutReady.ts` + tests); building consumes materials.
- [ ] Suite + build green, commit.

### Task 4: progress module usability
- [ ] Filter chips row: Available (default on) / Locked / Completed visibility toggles + "Kappa only"; overall progress bar (completed/total for mode) and per-trader "12/48" counts in section headers; sticky search+filters bar.
- [ ] Suite (extend ProgressPage tests for filters) + build green, commit.

### Task 5: land
- [ ] Full verification, merge to main (pre-authorized), memory update, report.
