// Wires the store to /api/progress when signed in on the hosted deployment:
// pull-and-merge once per sign-in, then a debounced push on every change.
// Hardened for production: an identity guard against shared browsers, a
// schema-version guard against stale bundles, retry with backoff plus an
// `online` listener on failed pushes, no dropped edits during the pull
// window, and a keepalive flush when the tab is hidden or torn down.
import { useEffect, useRef } from 'react';
import { usePlanner } from '../store';
import { AUTH_ENABLED, authClient } from './authClient';
import type { SyncedState } from './progressSync';
import { normalizeSynced, pullProgress, pushProgress } from './progressSync';
import { getLastSyncUserId, resolveSignInState, setLastSyncUserId } from './syncIdentity';

/** matches the zustand persist version in store.ts */
export const SYNC_VERSION = 3;
const PUSH_DEBOUNCE_MS = 3000;
/** backoff for failed pushes; after the last step we wait for `online` or a new change */
const RETRY_DELAYS_MS = [5000, 15000, 45000];

const currentSynced = (): SyncedState => {
  const s = usePlanner.getState();
  return {
    gameMode: s.gameMode,
    tracker: s.tracker,
    profiles: s.profiles,
    craftBlacklist: s.craftBlacklist,
  };
};

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'error';

export function useProgressSync(onStatus?: (status: SyncStatus) => void) {
  const session = authClient.useSession();
  const userId = session.data?.user.id;
  const signedIn = AUTH_ENABLED && Boolean(userId);
  const statusRef = useRef(onStatus);
  statusRef.current = onStatus;

  useEffect(() => {
    if (!signedIn || !userId) {
      statusRef.current?.('off');
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pulling = true;
    let pendingDuringPull = false;
    /** the server schema is newer than this bundle - never push over it */
    let blocked = false;
    /** an unsent local change exists (set on change, cleared on push success) */
    let dirty = false;
    let attempt = 0;
    statusRef.current?.('syncing');

    const push = () => {
      if (cancelled || blocked) return;
      if (pulling) {
        pendingDuringPull = true;
        return;
      }
      statusRef.current?.('syncing');
      pushProgress(SYNC_VERSION, currentSynced())
        .then(() => {
          if (cancelled) return;
          dirty = false;
          attempt = 0;
          statusRef.current?.('synced');
        })
        .catch(() => {
          if (cancelled) return;
          statusRef.current?.('error');
          if (attempt < RETRY_DELAYS_MS.length) {
            const delay = RETRY_DELAYS_MS[attempt];
            attempt += 1;
            if (timer) clearTimeout(timer);
            timer = setTimeout(push, delay);
          }
          // past the last step: wait for `online` or the next change
        });
    };
    const schedulePush = () => {
      dirty = true;
      attempt = 0; // a fresh change restarts the retry budget
      if (pulling) {
        pendingDuringPull = true;
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(push, PUSH_DEBOUNCE_MS);
    };

    void (async () => {
      try {
        const remote = await pullProgress();
        if (cancelled) return;
        if (remote && remote.version > SYNC_VERSION) {
          // a newer app version wrote this account's data; this stale bundle
          // must not merge or overwrite it
          blocked = true;
          pulling = false;
          statusRef.current?.('error');
          return;
        }
        // identity guard: a different user on this browser must not inherit
        // the previous user's local progress (docs/auth-design.md)
        const next = resolveSignInState(remote, currentSynced(), getLastSyncUserId(), userId);
        usePlanner.setState(normalizeSynced(next));
        setLastSyncUserId(userId);
        pulling = false;
        // establish the merged (or first) copy server-side right away
        await pushProgress(SYNC_VERSION, currentSynced());
        if (cancelled) return;
        statusRef.current?.('synced');
        if (pendingDuringPull) {
          pendingDuringPull = false;
          schedulePush();
        }
      } catch {
        pulling = false;
        if (!cancelled) statusRef.current?.('error');
        if (pendingDuringPull) {
          pendingDuringPull = false;
          schedulePush();
        }
      }
    })();

    const unsubscribe = usePlanner.subscribe((state, prev) => {
      if (
        state.tracker !== prev.tracker ||
        state.profiles !== prev.profiles ||
        state.gameMode !== prev.gameMode ||
        state.craftBlacklist !== prev.craftBlacklist
      ) {
        schedulePush();
      }
    });

    // connectivity returning is the natural retry point for a failed push
    const onOnline = () => {
      if (dirty && !pulling && !blocked) push();
    };
    // a hidden/closing tab flushes any unsent change immediately; keepalive
    // lets the request outlive the page
    const flushNow = () => {
      if (!dirty || pulling || blocked || cancelled) return;
      if (timer) clearTimeout(timer);
      void pushProgress(SYNC_VERSION, currentSynced(), { keepalive: true })
        .then(() => {
          dirty = false;
        })
        .catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pagehide', flushNow);
      document.removeEventListener('visibilitychange', onVisibility);
      unsubscribe();
    };
  }, [signedIn, userId]);
}
