import type { RpTask, Snapshot } from '@raidplanner/data';

export interface TrackerState {
  level: number;
  faction: 'Any' | 'USEC' | 'BEAR';
  completedTaskIds: string[];
  /** built hideout station levels, stationId -> level (absent = 0) */
  hideoutLevels?: Record<string, number>;
  /** items collected toward quests/hideout, itemId -> count on hand */
  itemsHave?: Record<string, number>;
  /** finished story chapters (self-tracked; see data/storyline.ts) */
  storyChapterIds?: string[];
  /** trader name -> loyalty level; 0 = trader still locked, absent = LL1 */
  traderLoyalty?: Record<string, number>;
}

/** The player's loyalty level with a trader (LL1 unless set; 0 = locked). */
export function traderLoyaltyOf(tracker: TrackerState, traderName: string): number {
  return tracker.traderLoyalty?.[traderName] ?? 1;
}

/** Chapter name -> the slug id used by data/storyline.ts and the tracker. */
export function storyChapterSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// v1 simplification: a requirement whose status does not include 'complete'
// (e.g. ['active']) is treated as satisfied rather than resolved recursively.
export function isAvailable(task: RpTask, tracker: TrackerState): boolean {
  if (tracker.completedTaskIds.includes(task.id)) return false;
  if (tracker.level < task.minPlayerLevel) return false;
  // the game gates quests on trader loyalty tiers (and hides locked traders'
  // quests entirely - locked = loyalty 0)
  if (traderLoyaltyOf(tracker, task.trader.name) < (task.loyaltyLevel ?? 1)) {
    return false;
  }
  // some quests only unlock after a story chapter (self-tracked; the task
  // carries the chapter name, the tracker stores slug ids)
  if (
    task.storyChapter &&
    !(tracker.storyChapterIds ?? []).includes(storyChapterSlug(task.storyChapter))
  ) {
    return false;
  }
  // anything that isn't a real faction means "open to both" - old snapshots
  // shipped 'Any' blind-translated into 'any target', hiding every common
  // quest from USEC/BEAR trackers
  const taskFaction =
    task.factionName === 'USEC' || task.factionName === 'BEAR' ? task.factionName : 'Any';
  if (taskFaction !== 'Any' && tracker.faction !== 'Any' && taskFaction !== tracker.faction) {
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
