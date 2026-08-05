import type { RpTask, RpTaskRequirement, Snapshot } from '@raidplanner/data';
import { snapshot as fullSnapshot } from '@raidplanner/data';

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

// default prerequisite index over the bundled snapshot; tests pass fixtures
let defaultIndex: Map<string, RpTask> | null = null;
const taskIndex = (): Map<string, RpTask> =>
  (defaultIndex ??= new Map(fullSnapshot.tasks.map((t) => [t.id, t])));

/**
 * A requirement with 'complete' in its status needs the prereq finished. An
 * 'active'-style requirement (no 'complete') mirrors the game: the prereq
 * must at least be obtainable - Postman Pat - Part 2 requires Part 1
 * "active", and while Part 1 sits behind Therapist LL2 the game shows
 * neither. Unknown prereq ids stay lenient (dropped/renamed tasks).
 */
export function requirementSatisfied(
  req: RpTaskRequirement,
  tracker: TrackerState,
  byId: ReadonlyMap<string, RpTask>,
  seen: ReadonlySet<string>,
): boolean {
  if (tracker.completedTaskIds.includes(req.taskId)) return true;
  if (req.status.includes('complete')) return false;
  const prereq = byId.get(req.taskId);
  if (!prereq || seen.has(req.taskId)) return true;
  return isAvailable(prereq, tracker, byId, new Set([...seen, req.taskId]));
}

export function isAvailable(
  task: RpTask,
  tracker: TrackerState,
  byId: ReadonlyMap<string, RpTask> = taskIndex(),
  seen: ReadonlySet<string> = new Set([task.id]),
): boolean {
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
  return task.taskRequirements.every((req) =>
    requirementSatisfied(req, tracker, byId, seen),
  );
}

export function availableQuests(snapshot: Snapshot, tracker: TrackerState): RpTask[] {
  return snapshot.tasks.filter((task) => isAvailable(task, tracker));
}
