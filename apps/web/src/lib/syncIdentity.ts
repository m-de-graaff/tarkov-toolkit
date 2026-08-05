// Guards account sync against the shared-browser case: the local blob merges
// into an account only when it plausibly belongs to that account's user (first
// ever sign-in, or the same user as last time). A different user signing in
// adopts their server copy verbatim - the previous user's progress must never
// leak into another account.
import type { SyncedState, SyncPayload } from './progressSync';
import { mergeSyncedState } from './progressSync';

const LAST_USER_KEY = 'raidplanner-last-user';

export function getLastSyncUserId(): string | null {
  try {
    return localStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
}

export function setLastSyncUserId(id: string): void {
  try {
    localStorage.setItem(LAST_USER_KEY, id);
  } catch {
    /* storage unavailable - worst case the next sign-in merges again */
  }
}

/** matches freshTracker() in store.ts */
export const freshSyncedState = (): SyncedState => ({
  gameMode: 'pvp',
  tracker: {
    level: 1,
    faction: 'Any',
    completedTaskIds: [],
    hideoutLevels: {},
    itemsHave: {},
    storyChapterIds: [],
  },
  profiles: {},
  craftBlacklist: [],
});

/**
 * Decide what state to adopt on sign-in. Same user (or first sign-in on this
 * browser) merges local and remote; a different user takes the remote copy
 * as-is, or a fresh profile when the account has nothing stored yet.
 */
export function resolveSignInState(
  remote: SyncPayload | null,
  local: SyncedState,
  lastUserId: string | null,
  userId: string,
): SyncedState {
  const sameOwner = lastUserId === null || lastUserId === userId;
  if (sameOwner) return remote ? mergeSyncedState(remote.state, local) : local;
  return remote ? remote.state : freshSyncedState();
}
