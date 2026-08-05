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

export async function pullProgress(): Promise<SyncPayload | null> {
  const res = await fetch('/api/progress', { credentials: 'include' });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`GET /api/progress ${res.status}`);
  return (await res.json()) as SyncPayload;
}

export async function pushProgress(version: number, state: SyncedState): Promise<void> {
  const res = await fetch('/api/progress', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ version, state }),
  });
  if (!res.ok) throw new Error(`PUT /api/progress ${res.status}`);
}
