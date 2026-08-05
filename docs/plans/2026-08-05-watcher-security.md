# Companion Watcher Security Implementation Plan (Roadmap Slice 4)

> **To execute:** use the `executing-plans` skill. Steps use `- [ ]` for tracking.

**Goal:** No website except the toolkit can read the local WebSocket's live
position feed; the auto-updater only installs binaries whose sha256 matches a
checksum published with the release, and never installs without being asked.

**Architecture:** Origin allow-list checked in the WS connection handler
(pure helper in `origin.ts`; non-browser clients send no Origin and stay
allowed — local processes can already read the screenshots directly, the
threat model is drive-by websites). Updater gains a required checksum asset
(`RaidplannerCompanion.exe.sha256`, produced by release.yml) verified before
the swap; startup auto-install becomes notify-only unless
`RAIDPLANNER_AUTO_UPDATE=1`. Watcher gets a real vitest test script (its test
was `exit 0`).

## Global Constraints

- Default allowed origins: `https://tarkovtoolkit.vercel.app`,
  `https://tarkov-toolkit.vercel.app`, `http://localhost:5173`,
  `http://127.0.0.1:5173`; extend via `RAIDPLANNER_ALLOWED_ORIGINS`
  (comma-separated). Missing Origin header ⇒ allowed.
- Missing or mismatched checksum ⇒ install aborts (all releases after this
  change publish the checksum).
- Env contract: `RAIDPLANNER_NO_AUTO_UPDATE=1` still suppresses the startup
  check; new `RAIDPLANNER_AUTO_UPDATE=1` restores install-without-asking.

### Task 1: origin allow-list
- Create `apps/watcher/src/origin.ts` — `isAllowedOrigin(origin: string |
  undefined, extra?: string): boolean`; Test `src/origin.test.ts`.
- Wire into `index.ts` connection handler: disallowed ⇒
  `socket.close(1008, 'origin not allowed')` + log.
- [x] Tests → implement → green → commit.

### Task 2: checksum-verified updater, notify-first
- `updater.ts`: `UpdateInfo` gains `checksumUrl: string | null` (the
  `.exe.sha256` asset); export `parseChecksumFile(text): string | null` and
  `sha256Hex(buf): string`; `downloadAndInstall` throws without/with wrong
  checksum, deletes the temp file on mismatch. Test `src/updater.test.ts`
  (compareVersions table, checksum parse/verify).
- `index.ts`: startup check notifies via balloon by default; installs only
  when `RAIDPLANNER_AUTO_UPDATE=1`. Tray-menu update still installs on demand.
- [x] Tests → implement → green → commit.

### Task 3: release + CI wiring
- `release.yml`: generate `RaidplannerCompanion.exe.sha256` (lowercase hex +
  two spaces + filename) and add to release files.
- `apps/watcher/package.json`: `"test": "vitest run"`, devDep vitest.
- [x] `pnpm --filter @raidplanner/watcher test` green; full `pnpm test` green;
  commit.
