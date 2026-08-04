# Full Toolkit Build Plan — log automation, ammo, hideout, needed items, market

> **To execute:** use the `executing-plans` skill. Steps use `- [ ]` for tracking.
> Excluded: goon tracker (needs a community-sightings backend that doesn't exist yet — not buildable "properly").

**Goal:** Ship the five recommended tools as complete features: (1) companion log-reading — auto map selection + auto quest completion; (2) ammo chart; (3) hideout tracker; (4) needed-items list; (5) barter/craft profit with live flea prices.

## Verified data facts

- EFT logs: `<install>\Logs` (or `build\Logs`), install path from registry `HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\EscapeFromTarkov` (or Steam App 3932890). Newest dated subfolder holds `*application.log` / `*notifications.log`.
- Log line: `YYYY-MM-DD HH:MM:SS.mmm ±TZ|message` (+ optional JSON block on following lines).
- Map detection: `application|TRACE-NetworkGameCreate profileStatus` line, `Location: (?<map>[^,]+)` = map `nameId`; earlier signal `scene preset path:(maps/x.bundle)` = `scenePath`. → snapshot `RpMap` gains `nameId` + `scenePath`.
- Quest events: `notifications.log` `Got notification | ChatMessageReceived` where `message.type` ∈ {10 started, 11 failed, 12 finished} and `message.templateId` = `"<taskId> …"`.
- Endpoint sizes: hideout 80KB, barters 258KB, crafts 97KB (bundle all three); items 16.5MB (snapshot-time extraction only: `ammo.json` ballistics + `items-lite.json` id→{name, shortName, iconLink} for every id referenced by quests/hideout/barters/crafts; live prices fetched at runtime and cached in IndexedDB).

### Feature 1: companion log-reading (auto map + auto quest completion)
- [x] Snapshot: add `nameId`, `scenePath` to RpMap. Companion: `logsWatcher.ts` — resolve logs dir via `reg query` (both registry paths, `RAIDPLANNER_LOGS_DIR` override), tail newest folder's application+notifications logs (poll 1s, byte-offset resume, new-folder detection); parse events → WS broadcasts `{type:'map', nameId}` and `{type:'task', taskId, status: 'started'|'failed'|'finished'}`. Pure parser module `parseLogEvents(chunk)` in `@raidplanner/live` with unit tests (real-shaped log lines incl. JSON blocks split across chunks).
- [x] Web: on `map` message auto-`selectMap` (matching by nameId; only if different); on `task` finished → add to active profile completions (started → no-op v1); toolbar toast-line "Detected: Customs raid" / "Quest completed: Debut". Tests: WS stub drive → store updates.
- [x] Suite + build green; commit + merge.

### Feature 2: ammo chart (/ammo)
- [x] Snapshot: `ammo.json` from items (category ammo): caliber, name, shortName, damage, penetrationPower, armorDamage, fragmentationChance, initialSpeed, tracer, projectileCount. Validator checks ≥ 150 rounds, calibers ≥ 20.
- [x] `/ammo` page: caliber select + search; sortable columns (damage, pen, frag, velocity); pen color-classed (≥6 armor-class thresholds like tarkov.dev); mode-independent. Tests: sorting + filter logic (pure `lib/ammoSort.ts`) + page smoke.
- [x] Suite green; commit + merge.

### Feature 3: hideout tracker (/hideout)
- [x] Snapshot: `hideout.json` (stations → levels: station/level/constructionTime/stationLevelRequirements/itemRequirements(+FIR)/traderRequirements) + names via items-lite/traders. Store: `hideoutLevels: Record<stationId, number>` per game-mode profile (with migration).
- [x] `/hideout` page: station cards (current level, +/- controls, next-level requirements with met/unmet coloring vs other stations), "what you still need" aggregate. Tests: level bump updates aggregate; per-mode isolation.
- [x] Suite green; commit + merge.

### Feature 4: needed items (/items)
- [x] Snapshot: quest objectives gain `neededItems: {itemId, count, foundInRaid}[]` (giveItem/plantItem/findItem/giveQuestItem types); `items-lite.json` covers all referenced ids.
- [x] `/items` page: aggregated over OPEN quests (active profile) + next hideout levels; columns: item, total count, FIR badge, sources (quest/station names on hover); search. Tests: aggregation math (pure lib) incl. FIR split.
- [x] Suite green; commit + merge.

### Feature 5: market — barters & crafts profit with live prices (/market)
- [x] Snapshot: bundle `barters.json` + `crafts.json` (trader/level, required/reward items). Runtime `lib/prices.ts`: fetch `regular/items` once on demand → store `{id: {lastLowPrice, avg24hPrice, sellFor best}}` in IndexedDB with fetchedAt; "Refresh prices" button + age display; graceful "offline — prices unavailable" state.
- [x] `/market` page: barters + crafts tables, cost (Σ required × price) vs revenue (reward best-sell), profit + profit/hr for crafts; unpriceable rows marked. Tests: profit math pure lib with fixture prices.
- [x] Suite green; commit + merge.

### Wrap-up
- [x] TopNav + Home cards updated per feature as they land (barter/flea cards flip from "coming soon"). README per feature. Memory update. Final report.
