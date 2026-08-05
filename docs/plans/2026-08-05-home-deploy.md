# Home Page, Vercel Deploy, Spawn Simplification Plan

> **To execute:** use the `executing-plans` skill. Steps use `- [ ]` for tracking.

**Goal:** A proper landing page at `/` (planner moves to `/planner`); the repo deploys to Vercel as-is (and stays self-hostable); the spawn dropdown disappears - spawn is set by clicking the map or by live position; Better Auth gets an honest design doc (full implementation is blocked on accounts/decisions only Mark can make).

### Task 1: home page + route shuffle
- [x] `pages/HomePage.tsx`: hero (name, one-line pitch, "Open the planner" primary CTA), tool cards (Raid Planner `/planner`, Progress `/progress`, Barter calculator + Flea prices as "coming soon"), a 3-step "live position" explainer strip. Routes: `/` Home, `/planner` Planner, `/progress` Progress. TopNav tabs: Home, Raid Planner, Progress; mobile sheet trigger only on `/planner`.
- [x] App tests navigate to `/planner` first; new home smoke test (CTA present, links live).
- [x] Suite + build green, commit.

### Task 2: spawn picker removal
- [x] Delete `SpawnPicker.tsx`; toolbar shows contextual hint ("Click the map where you spawn - or take a screenshot in raid") when no origin, and a "Spawn set · clear" chip when a custom spawn exists; store `SpawnChoice` zone variant stays (persisted states may hold it) but nothing creates it anymore.
- [x] Suite + build green, commit.

### Task 3: Vercel deployability + auth design doc
- [x] `vercel.json` (static build of apps/web, SPA rewrites); README "Deploying" section (self-hosted static = default, Vercel = same build). `docs/auth-design.md`: Better Auth integration plan - what it gates (cloud-synced progress), server surface (Vercel functions + Better Auth handler), DB options (Neon/Turso), env vars, and the decisions/credentials needed from Mark. No stub auth code shipped.
- [x] Build green, commit; merge to main (pre-authorized).
