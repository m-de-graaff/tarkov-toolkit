# UI Refresh — Vercel/GitHub-style clarity

> **To execute:** use the `executing-plans` skill. Steps use `- [ ]` for tracking.

**Goal:** Make the UI read like a proven platform (Vercel/GitHub): neutral near-black dark theme, quiet borders, clear hierarchy, restrained single accent, better copy and empty states. No functional changes.

**Design direction (locked):**
- Font: Inter (bundled via `@fontsource-variable/inter` — offline).
- Tokens: `--background #0a0a0a`, `--card #111110`, `--secondary/--muted #1a1a19`, `--accent #1f1e1c`, `--border #262625`, `--input #3f3f3d`, `--foreground #ededec`, `--muted-foreground #8f8f8a`, `--primary #c9a96a` (the only brand color; used for primary actions, selection, and key numbers), `--destructive #e5484d`, `--ok #46a758`, `--radius 0.375rem`. Map markers/route colors unchanged (map readability).
- Type scale: base 14px; section labels 11px uppercase tracked muted; wordmark small semibold, not shouting gold.
- Structure: sidebar sections separated by consistent spacing + Separators; map picker becomes single-column rows (name left, open-count right, selected = gold left-accent) — clearer than the cramped 2-col grid; toolbar groups spawn+live left, recommendation right; route steps numbered with muted connectors; every empty state says what to do next.

### Task 1: tokens + font
- [ ] Add `@fontsource-variable/inter`, import in `main.tsx`; retoken `index.css`; base font-size/family in `@layer base`.
- [ ] Suite + build green, commit.

### Task 2: component structure & copy pass
- [ ] Sidebar (single-column map rows, separators, spacing), TrackerBar, QuestList rows, toolbar layout in App, RoutePanel numbered steps, LivePanel copy, MobileTopBar, Footer — Tailwind class edits only, test-contract selectors intact.
- [ ] Suite + build green, commit.

### Task 3: land
- [ ] Full verification, README design note update, merge to main (landing pre-authorized).
