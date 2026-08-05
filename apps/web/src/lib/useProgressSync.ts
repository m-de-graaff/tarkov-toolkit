// Wires the store to /api/progress when signed in on the hosted deployment:
// pull-and-merge once per sign-in, then a debounced push on every change.
// The remote payload wins scalars on sign-in (you signed in to fetch YOUR
// progress); completions and levels merge so nothing is ever lost.
import { useEffect, useRef } from 'react';
import { usePlanner } from '../store';
import { AUTH_ENABLED, authClient } from './authClient';
import type { SyncedState } from './progressSync';
import { pullProgress, pushProgress } from './progressSync';
import { getLastSyncUserId, resolveSignInState, setLastSyncUserId } from './syncIdentity';

/** matches the zustand persist version in store.ts */
export const SYNC_VERSION = 3;
const PUSH_DEBOUNCE_MS = 3000;

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
    statusRef.current?.('syncing');

    const push = () => {
      if (cancelled || pulling) return;
      statusRef.current?.('syncing');
      pushProgress(SYNC_VERSION, currentSynced())
        .then(() => !cancelled && statusRef.current?.('synced'))
        .catch(() => !cancelled && statusRef.current?.('error'));
    };
    const schedulePush = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(push, PUSH_DEBOUNCE_MS);
    };

    void (async () => {
      try {
        const remote = await pullProgress();
        if (cancelled) return;
        // identity guard: a different user on this browser must not inherit
        // the previous user's local progress (docs/auth-design.md)
        const next = resolveSignInState(remote, currentSynced(), getLastSyncUserId(), userId);
        usePlanner.setState(next);
        setLastSyncUserId(userId);
        pulling = false;
        // establish the merged (or first) copy server-side right away
        await pushProgress(SYNC_VERSION, currentSynced());
        if (!cancelled) statusRef.current?.('synced');
      } catch {
        pulling = false;
        if (!cancelled) statusRef.current?.('error');
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

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [signedIn, userId]);
}
