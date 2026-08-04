# Design System (Tailwind + shadcn/ui) & Responsive Layout Plan

> **To execute:** use the `executing-plans` skill. Steps use `- [ ]` for tracking.

**Goal:** Replace the hand-rolled CSS with Tailwind v4 + shadcn/ui themed to the Tarkov palette; make the left sidebar resizable by dragging (with sane min/max), stop its content being cut off, and make the whole app mobile responsive.

**Architecture:** Tailwind v4 via `@tailwindcss/vite` (CSS-first config, `@theme` tokens mapping the existing Tarkov palette onto shadcn's semantic variables, dark-only). shadcn/ui components vendored into `apps/web/src/components/ui/` via the shadcn CLI (fallback: hand-vendor the same files — they are plain source). Desktop layout becomes a `react-resizable-panels` group (shadcn Resizable): draggable handle between sidebar and map, sizes persisted via `autoSaveId`. Below the `md` breakpoint the sidebar moves into a shadcn Sheet opened from a compact top bar, and the route panel becomes a collapsible bottom drawer. Leaflet marker/map CSS stays as a small hand-written layer.

**Tech stack additions:** `tailwindcss@^4`, `@tailwindcss/vite`, `tw-animate-css` (shadcn dependency), shadcn CLI-vendored components (button, input, select, checkbox, badge, sheet, resizable, separator), `react-resizable-panels` (via shadcn resizable), `lucide-react` (icons), `clsx` + `tailwind-merge` + `class-variance-authority` (shadcn utils).

## Global Constraints

- Still fully offline at runtime; all new deps are npm packages (no CDN).
- Tarkov palette is the single source of truth — map it onto shadcn tokens in CSS (`--background: #0f0e0c`, `--card/-–panel: #1b1917`, `--primary: #c9a96a`, `--border: #3d382f`, `--destructive: #a7452c`, etc.). Dark-only: no light theme.
- Test contract: keep these selectors working (App/MapCanvas tests rely on them): `.quest-row`, `.quest-row input[type=checkbox]`, `.badge-map`, `.marker.objective/.spawn/.player`, `.route-steps li`, `.map-canvas`, text "live position", "Total ≈".
- Keep a11y wins from the previous pass: visible focus (shadcn ring must be ≥3:1 against surfaces — ring color `--accent`), 24px+ hit targets, `tabular-nums` on updating numbers, `prefers-reduced-motion` respected (tw-animate respects it; keep the global reduce block).
- Sidebar: default 340px, drag range ~260–560px, `autoSaveId="raidplanner-layout"`; content must not clip — quest names truncate with ellipsis + `title`, toolbar rows wrap.
- Mobile (`< md`): top bar (app title, "Maps & Quests" Sheet trigger, live connect), map fills the rest, route panel collapsible above the bottom; everything usable at 320px wide.
- shadcn CLI is non-interactive only: write `components.json` by hand, then `pnpm dlx shadcn@latest add -y -o <components>`; if the CLI fails (network/registry), vendor the component sources manually with the same file layout.

---

### Task 1: Tailwind v4 + shadcn infrastructure

**Files:**
- Modify: `apps/web/vite.config.ts` (tailwind plugin + `@` alias), `apps/web/tsconfig.json` (paths `@/*` → `src/*`), `apps/web/package.json`, `apps/web/src/main.tsx` (import new `index.css`)
- Create: `apps/web/src/index.css` (tailwind import + `@theme` palette + shadcn vars + trimmed custom layer), `apps/web/components.json`, `apps/web/src/lib/utils.ts` (`cn()`)
- Delete (end of Task 2): `apps/web/src/styles.css`

- [x] **Step 1:** `pnpm --filter @raidplanner/web add tailwindcss @tailwindcss/vite tw-animate-css class-variance-authority clsx tailwind-merge lucide-react` and wire `tailwindcss()` into vite plugins; add `resolve.alias { '@': '/src' }` and tsconfig `baseUrl`/`paths`.
- [x] **Step 2:** `index.css`: `@import 'tailwindcss'; @import 'tw-animate-css';` + `@theme inline` block mapping shadcn variables to the Tarkov palette hexes (background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, radius 0.25rem) + keep leaflet/marker/scroll custom CSS in `@layer components`. Import leaflet CSS stays in MapCanvas.
- [x] **Step 3:** `components.json` (style "new-york", rsc false, tsx true, tailwind css `src/index.css`, baseColor neutral, aliases `@/components`, `@/lib/utils`), `src/lib/utils.ts` with `cn()`. Then `pnpm dlx shadcn@latest add -y button input select checkbox badge sheet resizable separator` (fallback: vendor manually).
- [x] **Step 4:** Temporarily import `index.css` alongside `styles.css`; `pnpm build` + dev smoke (`curl` 200) green.
- [x] **Step 5: Commit** (`feat(web): tailwind v4 + shadcn infrastructure`).

---

### Task 2: Restyle components with shadcn primitives

**Files:**
- Modify: `TrackerBar.tsx`, `Sidebar.tsx`, `QuestList.tsx`, `SpawnPicker.tsx`, `LivePanel.tsx`, `RecommendBanner.tsx`, `RoutePanel.tsx`, `Footer.tsx`, `App.tsx`
- Delete: `styles.css` (leaflet/marker layer moved into `index.css`)

- [x] **Step 1:** Replace hand-rolled controls: Button (map picker buttons → `variant="outline"` with selected state, done-toggle → icon Button `size="icon-sm"` with Check icon, recommend/live buttons), Input (level, search), shadcn Select (faction, spawn picker), Checkbox (quest select, only-available), Badge (MAP/MULTI/count — keep `.badge-map` class hook). Quest rows keep `.quest-row` class + ellipsis truncation + `title` attr (fixes cut-off names).
- [x] **Step 2:** Move surviving custom CSS (markers, `.map-canvas`, leaflet tweaks, reduced-motion block) into `index.css`; delete `styles.css`; remove its import.
- [x] **Step 3:** Full test suite + `tsc` + build green (fix any selector drift — tests may need shadcn Checkbox rendering `input[type=checkbox]`? shadcn Checkbox is a Radix button — **keep native checkboxes** for quest rows styled with Tailwind classes instead, to preserve semantics and the test contract).
- [x] **Step 4: Commit** (`refactor(web): restyle components on tailwind + shadcn`).

---

### Task 3: Resizable desktop layout

**Files:**
- Modify: `App.tsx` (ResizablePanelGroup horizontal: sidebar panel / handle / main+route), `Sidebar.tsx` (internal scroll, min-w-0 truncation)

- [x] **Step 1:** Desktop (`md+`): `ResizablePanelGroup direction="horizontal" autoSaveId="raidplanner-layout"`; sidebar `defaultSize` ≈ 25 with `minSize`/`maxSize` clamping to ~260–560px equivalent; visible grip on the handle (`withHandle`); map + route panel in the remaining panel (route as fixed-width aside inside).
- [x] **Step 2:** Fix overflow: toolbar `flex-wrap`, sidebar sections `min-w-0`, quest rows `truncate`.
- [x] **Step 3:** Suite + build green; commit (`feat(web): draggable resizable sidebar layout`).

---

### Task 4: Mobile responsiveness

**Files:**
- Create: `apps/web/src/components/MobileTopBar.tsx`
- Modify: `App.tsx`, `RoutePanel.tsx`, `LivePanel.tsx`

- [x] **Step 1:** `< md`: hide the panel group sidebar; MobileTopBar with Sheet trigger ("Maps & Quests") rendering `<Sidebar/>` inside `SheetContent side="left"` (w-[85vw] max-w-[360px], scrollable); map fills below; RoutePanel becomes a collapsible bottom drawer (`<details>`-style summary bar with route total) instead of a right aside.
- [x] **Step 2:** Toolbar condenses on mobile (SpawnPicker + LivePanel wrap; RecommendBanner scrollable row).
- [x] **Step 3:** Suite + build green; verify 320px layout (no horizontal scroll) via jsdom assertion is meaningless — note as visual-check item; commit (`feat(web): mobile responsive layout with sheet sidebar`).

---

### Task 5: Verification & landing

- [ ] **Step 1:** Full `pnpm test` + `pnpm build`; a11y spot-check (focus ring contrast vs palette, hit sizes on new controls, Sheet focus trap comes from Radix).
- [ ] **Step 2:** README note (design system stack), plan ticks.
- [ ] **Step 3:** Merge branch `feat/design-system` to main (landing pre-authorized by standing instruction).

## Self-review notes

- Spec coverage: Tailwind (T1), shadcn installed+applied (T1–T2), sidebar cut-off fixed (T2 truncation + T3 min-w-0/wrap), auto-scale + drag resize (T3), mobile responsive (T4), map-name bug (already fixed separately this session).
- Risk: shadcn CLI may be interactive/network-flaky → explicit manual-vendor fallback. Radix Select in jsdom tests — existing tests don't interact with Select; keep it that way.
- Test contract preserved via kept class hooks and native checkboxes.
