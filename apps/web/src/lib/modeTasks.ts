import type { GameMode, RpTask, Snapshot } from '@raidplanner/data';

const cache = new Map<GameMode, RpTask[]>();

/** The quest set that exists in the given game mode (memoized — snapshot is static). */
export function tasksForMode(snapshot: Snapshot, mode: GameMode): RpTask[] {
  let tasks = cache.get(mode);
  if (!tasks) {
    tasks = snapshot.tasks.filter((t) => t.modes.includes(mode));
    cache.set(mode, tasks);
  }
  return tasks;
}

/** A snapshot view narrowed to one game mode's quests. */
export function snapshotForMode(snapshot: Snapshot, mode: GameMode): Snapshot {
  return { ...snapshot, tasks: tasksForMode(snapshot, mode) };
}
