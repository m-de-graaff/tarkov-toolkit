# Watcher quest backfill

Quests finished while no browser tab is open were lost forever: the watcher
tails logs from EOF and only ever replayed the last map event. Mark's three
Ragman turn-ins on 2026-08-04 (game 1.1.0, PVE) vanished this way — the ids
sat in `push-notifications` logs on disk the whole time.

Design: on startup the watcher scans every session folder of the CURRENT game
version (wipes ship with version bumps; replaying pre-wipe completions would
tick quests the profile never finished), collects finished task events deduped
by id, and replays them to every connecting web app. The web store is already
idempotent, so duplicate delivery is harmless. Live finished events join the
same replay list, so a tab opened mid-session catches up too.

Known limitation (pre-existing): log events carry no PvP/PvE marker, so
backfill lands on whichever profile is active in the tab.

- [x] `packages/live`: `sessionFolderVersion()` + `finishedTaskEvents()` + tests
- [x] `apps/watcher`: `collectQuestHistory()` (version-scoped, deduped) + tests
- [x] `apps/watcher`: replay history on connection; broadcast once scanned;
      live finished events appended
- [x] Verified against the real `D:\EscapeFromTarkov\Logs`: recovers exactly
      the four 1.1.0 completions, excludes 1.0.6.5 sessions
- [ ] Tag a companion release so packaged-exe users get backfill (Mark)
