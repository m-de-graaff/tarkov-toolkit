# Companion Tray App and Auto-Updater Plan

> **To execute:** use the `executing-plans` skill. Steps use `- [ ]` for tracking.

**Goal:** The companion runs as a Windows tray app (notification area icon, right-click menu, no console window) and keeps itself updated from GitHub releases.

**Design (no new dependencies):**
- Console removal: after postject, patch the PE optional header Subsystem byte from 3 (console) to 2 (GUI) in the build script. Dev mode (`pnpm watcher`) keeps the console.
- Tray: a hidden PowerShell child hosts a WinForms NotifyIcon with a context menu (Check for updates / Quit); menu clicks stream to node over stdout; node sends balloon notifications and shutdown through a command file the script polls; the script exits when the parent process dies. Icon comes from the exe itself. Tray starts only when running as a single-executable (node:sea isSea) or with RAIDPLANNER_TRAY=1.
- Logging: in SEA mode console output mirrors to companion.log next to the exe (there is no console anymore).
- Updater: version baked at build time (release tag). Check: GET api.github.com/repos/m-de-graaff/tarkov-toolkit/releases/latest (public repo required; flipping visibility is part of this work). Install: download the exe asset to RaidplannerCompanion.new.exe, rename running exe to .old, move new into place, spawn it detached, exit; on startup delete any leftover .old. Auto-check on start plus the menu item.
- Release workflow passes the tag as the baked version. Ship v0.2.0 to prove the pipeline; verify the updater end-to-end locally by building a 0.0.1 exe and letting it update itself to the released version.

### Tasks
- [ ] `apps/watcher/src/log.ts` (SEA file logging), `src/updater.ts` (check/install/cleanup, semver-ish tag compare), `src/tray.ts` (PowerShell NotifyIcon host + command file protocol); wire into index.ts.
- [ ] build-exe.mjs: PE subsystem patch + `--define` version; release.yml passes the tag.
- [ ] Unit tests where pure (tag comparison); manual end-to-end: build 0.0.1, run, watch it self-update to the latest release.
- [ ] Repo public + push + tag v0.2.0; verify workflow; merge; report.
