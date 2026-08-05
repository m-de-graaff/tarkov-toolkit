# Data Persistence & Sync Hardening Implementation Plan

> **To execute:** use the `executing-plans` skill. Steps use `- [ ]` for tracking.

**Goal:** No realistic browser or network condition may lose, corrupt, or
cross-contaminate a user's tracker progress — locally or through account sync.

**Architecture:** Keep the existing design (zustand persist → localStorage as
hot store, IndexedDB mirror as durable copy, pull-merge-push account sync) and
harden each layer: a safe storage adapter so quota/corruption can't throw out
of store actions; mirror restore on *invalid* (not just missing) localStorage;
cross-tab rehydration via the `storage` event; an account-identity guard so a
second user on the same browser never inherits the first user's progress; and
a resilient push pipeline (reschedule-during-pull, retry + online listener,
pagehide flush, remote schema-version guard).

**Tech stack:** React 18, zustand 5 (`persist` middleware), better-auth 1.6,
vitest 2 + jsdom 30, `fake-indexeddb` (new devDep, tests only).

## Global Constraints

- No new runtime dependencies; `fake-indexeddb` is devDependencies only.
- All behaviour changes covered by vitest tests colocated as `<file>.test.ts`.
- localStorage keys in use: `raidplanner-v1` (persisted store, `PROGRESS_KEY`),
  `raidplanner-last-user` (new, Task 4).
- Never write a default/empty state over a non-empty persisted copy.
- Run tests with: `pnpm --filter @raidplanner/web test` (or `vitest run <file>`
  inside `apps/web`).

---

### Task 1: Safe storage adapter (quota + corrupt JSON can't break the store)

**Files:**
- Create: `apps/web/src/lib/safeStorage.ts`
- Test: `apps/web/src/lib/safeStorage.test.ts`
- Modify: `apps/web/src/store.ts` (persist options: pass `storage`)

**Interfaces:**
- Produces: `safeLocalStorage: StateStorage` (zustand type) — `getItem` returns
  `null` for missing *or* unparsable JSON values and never throws; `setItem`
  and `removeItem` swallow storage exceptions (quota, disabled storage).
- Produces: `isValidPersistedJson(value: string | null): boolean` — exported
  for reuse by Task 2's mirror logic.

- [x] **Step 1: Write the failing test** (`safeStorage.test.ts`, jsdom env):
  getItem returns stored value; returns null when value is `'{invalid'`;
  setItem does not throw when the underlying `Storage.setItem` throws a
  `QuotaExceededError` (spy via `vi.spyOn(Storage.prototype, 'setItem')`).
- [x] **Step 2: Run, confirm fail** — `vitest run src/lib/safeStorage.test.ts`.
- [x] **Step 3: Implement** `safeStorage.ts`:

```ts
import type { StateStorage } from 'zustand/middleware';

export const isValidPersistedJson = (value: string | null): value is string => {
  if (value === null) return false;
  try { JSON.parse(value); return true; } catch { return false; }
};

export const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      const value = localStorage.getItem(name);
      return isValidPersistedJson(value) ? value : null;
    } catch { return null; }
  },
  setItem: (name, value) => {
    try { localStorage.setItem(name, value); } catch { /* quota/disabled: keep in-memory state */ }
  },
  removeItem: (name) => {
    try { localStorage.removeItem(name); } catch { /* ignore */ }
  },
};
```

- [x] **Step 4: Wire into the store** (`store.ts` persist options):
  `storage: createJSONStorage(() => safeLocalStorage)` (import
  `createJSONStorage` from `zustand/middleware`).
- [x] **Step 5: Run tests green, run full web suite, commit.**

### Task 2: Mirror hardening (restore on corrupt value; never flush garbage; flush on pagehide)

**Files:**
- Modify: `apps/web/src/lib/storage.ts`
- Test: `apps/web/src/lib/storage.test.ts` (new; `import 'fake-indexeddb/auto'`)
- Modify: `apps/web/package.json` (devDep `fake-indexeddb`)

**Interfaces:**
- Consumes: `isValidPersistedJson` from Task 1.
- Produces: unchanged signatures — `restoreProgressFromMirror(): Promise<void>`,
  `startProgressMirror(subscribe): () => void`.

Behaviour changes:
1. `restoreProgressFromMirror` restores when the localStorage value is missing
   **or fails `isValidPersistedJson`** — and only writes a mirror value that is
   itself valid JSON.
2. `startProgressMirror`'s `flush` skips writing when the current localStorage
   value is not valid JSON (never mirror garbage over a good backup).
3. Flush listeners: keep `beforeunload`, add `pagehide` and
   `visibilitychange` (only when `document.visibilityState === 'hidden'`) —
   mobile browsers reliably fire these, not beforeunload.

- [x] **Step 1: Failing tests** — with fake-indexeddb: (a) corrupt localStorage
  + valid mirror → restore overwrites the corrupt value; (b) valid localStorage
  → mirror untouched; (c) corrupt mirror value → not restored; (d) flush with
  corrupt localStorage does not overwrite a good mirror value; (e) pagehide
  triggers flush without waiting for the debounce.
- [x] **Step 2: Run, confirm fail.**
- [x] **Step 3: Implement** the three behaviour changes above.
- [x] **Step 4: Run green, full suite, commit.**

### Task 3: Cross-tab rehydration

**Files:**
- Create: `apps/web/src/lib/crossTab.ts`
- Test: `apps/web/src/lib/crossTab.test.ts`
- Modify: `apps/web/src/main.tsx` (call after `startProgressMirror`)

**Interfaces:**
- Consumes: `PROGRESS_KEY` from `storage.ts`; `usePlanner.persist.rehydrate()`.
- Produces: `startCrossTabSync(rehydrate: () => void): () => void` — listens
  for `storage` events for `PROGRESS_KEY` with a non-null `newValue` and calls
  `rehydrate` (debounced 100ms to coalesce bursts); returns cleanup.

```ts
import { PROGRESS_KEY } from './storage';

export function startCrossTabSync(rehydrate: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const onStorage = (e: StorageEvent) => {
    if (e.key !== PROGRESS_KEY || e.newValue === null) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(rehydrate, 100);
  };
  window.addEventListener('storage', onStorage);
  return () => {
    if (timer) clearTimeout(timer);
    window.removeEventListener('storage', onStorage);
  };
}
```

In `main.tsx`:
`startCrossTabSync(() => void usePlanner.persist.rehydrate());`

- [x] **Step 1: Failing test** — dispatch
  `new StorageEvent('storage', { key: PROGRESS_KEY, newValue: '{}' })`; assert
  rehydrate spy called once after the debounce (fake timers); assert other keys
  and null newValue are ignored; assert cleanup removes the listener.
- [x] **Step 2: Run fail → implement → run green, full suite, commit** (small
  task; collapse the cycle).

### Task 4: Account identity guard + AUTH_ENABLED env fix

**Files:**
- Create: `apps/web/src/lib/syncIdentity.ts`
- Test: `apps/web/src/lib/syncIdentity.test.ts`
- Modify: `apps/web/src/lib/authClient.ts` (env coercion)
- Modify: `apps/web/src/lib/useProgressSync.ts` (use the guard)

**Interfaces:**
- Produces (`syncIdentity.ts`):
  - `getLastSyncUserId(): string | null` / `setLastSyncUserId(id: string): void`
    (localStorage key `raidplanner-last-user`, try/catch wrapped).
  - `resolveSignInState(remote: SyncPayload | null, local: SyncedState, lastUserId: string | null, userId: string): SyncedState`
    — pure decision:
    - `lastUserId === null || lastUserId === userId` → merge as today
      (`remote ? mergeSyncedState(remote.state, local) : local`) — the
      local-first upgrade path stays intact.
    - different user → **no merge**: `remote ? remote.state : freshSyncedState()`
      (previous user's local progress must not leak into this account).
  - `freshSyncedState(): SyncedState` (pvp, level 15, empty tracker/profiles —
    mirror `freshTracker()` in `store.ts`).
- Consumes: `SyncPayload`, `SyncedState`, `mergeSyncedState` from
  `progressSync.ts`.
- `authClient.ts`: `AUTH_ENABLED` is true only for `'1'` or `'true'`
  (case-insensitive): `/^(1|true)$/i.test(String(import.meta.env?.VITE_AUTH_ENABLED ?? ''))`.
- `useProgressSync.ts`: on sign-in, compute
  `resolveSignInState(remote, currentSynced(), getLastSyncUserId(), session.data.user.id)`,
  `usePlanner.setState(...)` with it, then `setLastSyncUserId(userId)` before
  the initial push.

- [x] **Step 1: Failing tests** for `resolveSignInState` (same user merges;
  first sign-in merges; different user with remote adopts remote verbatim;
  different user without remote gets fresh state) and for the `AUTH_ENABLED`
  coercion cases (`'false'`, `''`, `undefined` → false; `'true'`, `'1'` → true)
  — test the regexp via an exported helper `parseAuthEnabled(v: unknown)`.
- [x] **Step 2: Run fail → implement → run green, full suite, commit.**

### Task 5: Resilient push pipeline + remote version guard

**Files:**
- Modify: `apps/web/src/lib/useProgressSync.ts`
- Modify: `apps/web/src/lib/progressSync.ts` (`pushProgress` gains
  `opts?: { keepalive?: boolean }`; new `normalizeSynced`)
- Test: extend `apps/web/src/lib/progressSync.test.ts`; new
  `apps/web/src/lib/useProgressSync.test.tsx` (renderHook + mocked fetch +
  mocked `authClient.useSession`)

**Interfaces:**
- Consumes: everything Task 4 produced.
- Produces (`progressSync.ts`):
  - `pushProgress(version, state, opts?)` — passes `keepalive: opts?.keepalive`
    to fetch.
  - `normalizeSynced(state: SyncedState): SyncedState` — fills
    `hideoutLevels ?? {}`, `itemsHave ?? {}`, `completedTaskIds ?? []` on every
    tracker (active + profiles) so pre-v3 remote payloads can't leave holes.
- `useProgressSync.ts` behaviour:
  1. **Version guard:** if `remote.version > SYNC_VERSION`, do not merge and do
     not push (a stale bundle must not clobber a newer schema); report
     `'error'` status. If `remote.version < SYNC_VERSION`, merge through
     `normalizeSynced`.
  2. **No dropped edits during pull:** while `pulling`, a change sets
     `pendingDuringPull = true`; after the initial push completes, if pending,
     `schedulePush()`.
  3. **Retry:** failed push retries with backoff 5s → 15s → 45s (max 3), then
     status `'error'`; a `window 'online'` event or any new change resets and
     retries immediately.
  4. **Flush on hide:** `pagehide`/`visibilitychange(hidden)` with a pending
     debounce or unsent change fires `pushProgress(..., { keepalive: true })`
     immediately.

- [x] **Step 1: Failing tests** — `normalizeSynced` fills holes; version-guard
  path (mock fetch GET returning `{version: SYNC_VERSION + 1, ...}` → no PUT
  issued, status error); pull-window edit gets pushed after pull (fake timers);
  push failure schedules retry and `online` triggers it; hide flush uses
  keepalive.
- [x] **Step 2: Run fail → implement → run green, full suite.**
- [x] **Step 3: Update `AccountMenu.tsx:17` copy** if its "retrying" claim needs
  rewording — after this task the claim becomes true; verify wording matches
  behaviour.
- [x] **Step 4: Commit.**

## Execution notes

- Tasks 1→5 in order; 2 depends on 1, 5 depends on 4.
- After Task 5, update the roadmap file (mark Slice 1 done) before starting
  Slice 2.
