// Progress sync for the hosted deployment (docs/auth-design.md).
// Local persistence stays primary; sync is pull-and-merge on sign-in plus a
// debounced push on change. Merge contract: per game-mode profile, the newer
// payload wins scalars (level, faction, hideout levels, items), completed
// quests are a set union - a quest completed on either device stays completed.
import type { GameMode } from '@raidplanner/data';
import type { TrackerState } from './availability';

export interface SyncedState {
  gameMode: GameMode;
  tracker: TrackerState;
  profiles: Partial<Record<GameMode, TrackerState>>;
  craftBlacklist?: string[];
}

export interface SyncPayload {
  version: number;
  state: SyncedState;
  updatedAt?: string;
}

const unionIds = (a: string[], b: string[]): string[] => [...new Set([...a, ...b])];

function mergeTracker(
  newer: TrackerState | undefined,
  older: TrackerState | undefined,
): TrackerState | undefined {
  if (!newer) return older;
  if (!older) return newer;
  return {
    ...newer,
    // a level reached on either device stays reached
    level: Math.max(newer.level, older.level),
    completedTaskIds: unionIds(newer.completedTaskIds, older.completedTaskIds),
    // a chapter finished on either device stays finished
    storyChapterIds: unionIds(newer.storyChapterIds ?? [], older.storyChapterIds ?? []),
  };
}

/**
 * Merge two synced states; `newer` wins scalars, completions union. The
 * caller decides which side is newer (server updatedAt vs local write time).
 */
export function mergeSyncedState(newer: SyncedState, older: SyncedState): SyncedState {
  const modes = new Set<GameMode>([
    newer.gameMode,
    older.gameMode,
    ...(Object.keys(newer.profiles ?? {}) as GameMode[]),
    ...(Object.keys(older.profiles ?? {}) as GameMode[]),
  ]);

  // view both sides as mode -> tracker, with the active tracker in its slot
  const trackerOf = (s: SyncedState, mode: GameMode): TrackerState | undefined =>
    mode === s.gameMode ? s.tracker : s.profiles?.[mode];

  const gameMode = newer.gameMode;
  let tracker: TrackerState | undefined;
  const profiles: Partial<Record<GameMode, TrackerState>> = {};
  for (const mode of modes) {
    const merged = mergeTracker(trackerOf(newer, mode), trackerOf(older, mode));
    if (!merged) continue;
    if (mode === gameMode) tracker = merged;
    else profiles[mode] = merged;
  }

  return {
    gameMode,
    tracker: tracker ?? newer.tracker,
    profiles,
    craftBlacklist: unionIds(newer.craftBlacklist ?? [], older.craftBlacklist ?? []),
  };
}

/**
 * Fill schema holes in a synced payload: pre-v3 remote copies may lack
 * hideoutLevels/itemsHave (or even completedTaskIds on hand-rolled payloads);
 * the store's migrations only run on the localStorage path, so synced state
 * is normalized here instead.
 */
export function normalizeSynced(state: SyncedState): SyncedState {
  const fill = (t: TrackerState): TrackerState => ({
    ...t,
    completedTaskIds: t.completedTaskIds ?? [],
    hideoutLevels: t.hideoutLevels ?? {},
    itemsHave: t.itemsHave ?? {},
    storyChapterIds: t.storyChapterIds ?? [],
  });
  return {
    ...state,
    tracker: fill(state.tracker),
    profiles: Object.fromEntries(
      Object.entries(state.profiles ?? {}).map(([mode, t]) => [mode, fill(t as TrackerState)]),
    ),
    craftBlacklist: state.craftBlacklist ?? [],
  };
}

export async function pullProgress(): Promise<SyncPayload | null> {
  const res = await fetch('/api/progress', { credentials: 'include' });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`GET /api/progress ${res.status}`);
  return (await res.json()) as SyncPayload;
}

export async function pushProgress(
  version: number,
  state: SyncedState,
  opts?: { keepalive?: boolean },
): Promise<void> {
  const res = await fetch('/api/progress', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ version, state }),
    // keepalive lets the final flush survive the page being torn down
    keepalive: opts?.keepalive,
  });
  if (!res.ok) throw new Error(`PUT /api/progress ${res.status}`);
}
