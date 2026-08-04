import type { RpTask, Snapshot } from '@raidplanner/data';

export interface TrackerState {
  level: number;
  faction: 'Any' | 'USEC' | 'BEAR';
  completedTaskIds: string[];
}

// v1 simplification: a requirement whose status does not include 'complete'
// (e.g. ['active']) is treated as satisfied rather than resolved recursively.
export function isAvailable(task: RpTask, tracker: TrackerState): boolean {
  if (tracker.completedTaskIds.includes(task.id)) return false;
  if (tracker.level < task.minPlayerLevel) return false;
  if (
    task.factionName !== 'Any' &&
    tracker.faction !== 'Any' &&
    task.factionName !== tracker.faction
  ) {
    return false;
  }
  return task.taskRequirements.every(
    (req) =>
      !req.status.includes('complete') || tracker.completedTaskIds.includes(req.taskId),
  );
}

export function availableQuests(snapshot: Snapshot, tracker: TrackerState): RpTask[] {
  return snapshot.tasks.filter((task) => isAvailable(task, tracker));
}
