# Tarkov Raid Planner

An **offline-first raid planner for Escape from Tarkov**: pick a map, see every
quest you can advance there, select the ones you want to run, choose your spawn,
and get the objectives plus an optimized route drawn on an interactive map.

## Features

- **Map browser** — 11 maps rendered offline from calibrated community SVGs
  (Customs, Woods, Shoreline, Interchange, Reserve, Lighthouse, Streets,
  Ground Zero, Factory, Night Factory, Terminal).
- **Quest sidebar** — quests grouped by trader, badged as `MAP` (only doable on
  this map) or `MULTI` (also doable elsewhere), with search and an
  "only available" filter driven by your tracker state.
- **Quest tracker** — set your level and faction, tick quests as done; state
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

How it works: EFT names screenshots
`YYYY-MM-DD[HH-MM]_x, y, z_qx, qy, qz, qw (0).png` — your coordinates and view
quaternion are the filename. Click **Connect screenshots folder** in the map
toolbar and grant read access to
`Documents\Escape from Tarkov\Screenshots`; the app polls the folder locally
and parses new filenames (engine in `packages/live`, parsing ported from
[TarkovMonitor](https://github.com/the-hideout/TarkovMonitor), MIT). Unlike
tarkov-market-based tools (eftgps, TarkovPilot) there is no companion process
and nothing is uploaded anywhere — the folder is read in the browser, offline.

Notes: needs Chrome or Edge (File System Access API); the map is not
auto-detected from the screenshot (keep the right map selected — you'll get a
warning if your position falls outside its bounds); reconnect the folder after
a page reload.

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
apps/web        Vite + React SPA (leaflet map, planner UI)
packages/data   snapshot script + generated typed dataset
```

## Hosting

`pnpm build` produces a fully static `apps/web/dist` — deployable to any static
host (GitHub Pages, Cloudflare Pages, Netlify…). No server component.

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
