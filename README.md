# Tarkov Toolkit

An **offline-first toolkit for Escape from Tarkov**. Current tools:

- **Raid Planner** — pick a map, see every quest you can advance there, select
  the ones you want to run, choose your spawn (or use live position), and get
  the objectives plus an optimized route drawn on an interactive map.
- **Progress** — a built-in quest tracker driving what the planner shows.

Roadmap: barter calculator, flea market prices, and more — each tool slots in
as a new page under the shared shell (routing, theme, data pipeline, and the
persisted store are all in place for it).

## Raid planner features

- **Map browser** — 11 maps rendered offline from calibrated community SVGs
  (Customs, Woods, Shoreline, Interchange, Reserve, Lighthouse, Streets,
  Ground Zero, Factory, Night Factory, Terminal).
- **Quest sidebar** — always shows exactly the quests you have open (driven by
  the Progress page), grouped by trader, badged as `MAP` (only doable on this
  map) or `MULTI` (also doable elsewhere), with search and a collapsed view of
  still-locked quests.
- **Hideout tracker** — station levels with next-upgrade requirements.
- **Items to keep** — aggregated hand-ins from open quests + next hideout levels (FIR-aware).
- **Ammo chart** — 199 rounds, pen tiers, offline.
- **Market** — 789 barters and 214 crafts ranked by profit at cached live flea prices (the second runtime network use, user-triggered).
- **Companion log automation** — entering a raid selects the map; finishing a quest ticks itself off.
- **PvP / PvE toggle** — separate progress profiles per game mode (as in game);
  the quest set adjusts to mode-exclusive quests automatically.
- **Progress page** — a built-in quest tracker (like TarkovTracker): set level
  and faction, tick off finished quests; the planner sidebar then always shows
  exactly the quests you have open. State
  persists in the browser (localStorage). Prerequisite chains and level gates
  determine what counts as *available*.
- **Objective markers** — selected quests drop markers at the exact objective
  coordinates from tarkov.dev data.
- **Route planning** — pick a PMC spawn (or click the map for a custom spawn)
  and the planner orders your objectives with a multi-start nearest-neighbour +
  2-opt heuristic, drawing the route and per-leg distances.
- **Map recommendation** — "best maps for your open quests" banner ranks maps by
  how many available quests you can advance there.

## Live raid mode

Take a screenshot in-game (default hotkey) and your position appears on the map
within ~2 seconds — with a heading arrow — and the quest route re-plans from
where you actually are (overriding the spawn as route origin).

**Two ways to feed it:**

1. **Companion app (any browser):** run `pnpm watcher` in a terminal and leave
   the window open. It watches your Screenshots folder and streams positions to
   the web app over a local-only WebSocket (`127.0.0.1:17520`); the map toolbar
   shows "Companion app connected" automatically. Packaging this as a
   double-click `.exe` is future work.
2. **In-browser folder picker (Chrome/Edge, zero install):** click "Show my
   position" and grant read access to the Screenshots folder once.

How it works: EFT names screenshots
`YYYY-MM-DD[HH-MM]_x, y, z_qx, qy, qz, qw (0).png` — your coordinates and view
quaternion are the filename. Both transports parse it locally with the engine
in `packages/live` (ported from
[TarkovMonitor](https://github.com/the-hideout/TarkovMonitor), MIT); nothing
is uploaded anywhere.

Notes: the map is not auto-detected from the screenshot (keep the right map
selected — you'll get a warning if your position falls outside its bounds);
with the folder-picker transport, reconnect after a page reload.

## Getting started

```sh
pnpm install
pnpm dev        # vite dev server at http://localhost:5173
pnpm test       # vitest (web) + snapshot validation (data)
pnpm build      # static production build in apps/web/dist
```

Requires Node ≥ 20 and pnpm ≥ 9.

## Data

All quest/map data and map images are **bundled at build time** — the app makes
zero network requests at runtime. To refresh the dataset after a game patch:

```sh
pnpm snapshot   # re-fetches from json.tarkov.dev + tarkov-dev calibration, rewrites
                # packages/data/generated/snapshot.json and apps/web/public/maps/*.svg
pnpm --filter @raidplanner/data test   # sanity-check the new snapshot
```

Quest data © [tarkov.dev](https://tarkov.dev) (CC BY). Map SVGs © the
[the-hideout/tarkov-dev-svg-maps](https://github.com/the-hideout/tarkov-dev-svg-maps)
contributors (MIT). Escape from Tarkov is a trademark of Battlestate Games.

## Repo layout

```
apps/web        Vite + React SPA (toolkit shell: raid planner, progress)
apps/watcher    standalone companion screenshot watcher (local WebSocket)
packages/data   snapshot script + generated typed dataset
packages/live   screenshot-filename parsing engine (live mode)
```

## Design system

Tailwind CSS v4 (CSS-first config in `apps/web/src/index.css`) + shadcn/ui
components vendored under `apps/web/src/components/ui/`, themed dark-only to
the Tarkov palette via shadcn's semantic tokens. The sidebar is a draggable
resizable panel (260–560px, persisted); below `md` the layout switches to a
top bar with a slide-in sheet and a collapsible bottom route drawer.

## Hosting

`pnpm build` produces a fully static `apps/web/dist`:

- **Self-hosted:** serve `apps/web/dist` from any static host or file server.
- **Vercel:** the repo ships a `vercel.json` — import the project and deploy;
  no configuration needed. Accounts/sync via Better Auth are designed but not
  yet implemented (see `docs/auth-design.md` for the decisions it needs).

Map note: base-map tiles load from `assets.tarkov.dev` at runtime (the one
network dependency); offline, maps fall back to the bundled SVGs.

## v1 limitations

- Tile-based maps (The Lab, The Labyrinth, Icebreaker) list their quests but
  have no offline map image yet.
- Routing is straight-line (euclidean) — it ignores walls, terrain, and
  no-go zones. Treat it as visiting order, not a walking path.
- Multi-floor maps show all markers on the ground-level SVG layer.
- PMC spawn names come from position (e.g. "Spawn NE") because the game data
  uses opaque zone ids; click-to-place custom spawns are exact.
- Quest availability treats "active-status" prerequisites as satisfied
  (no recursive chain simulation).
- The ~1.4 MB quest snapshot ships in the main bundle; lazy-loading it is
  future work if initial load ever matters.
