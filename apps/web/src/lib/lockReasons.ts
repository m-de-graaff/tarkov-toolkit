import type { RpTask } from '@raidplanner/data';
import type { TrackerState } from './availability';
import { storyChapterSlug, traderLoyaltyOf } from './availability';

/**
 * Why a quest is locked, as short human strings ("Lv 15", "after Only
 * Business"). Empty array = not locked. Mirrors isAvailable's predicates
 * exactly (lockReasons.test.ts asserts the agreement) so the UI never says
 * "locked" without being able to say why.
 */
export function lockReasons(
  task: RpTask,
  tracker: TrackerState,
  byId: ReadonlyMap<string, RpTask>,
): string[] {
  if (tracker.completedTaskIds.includes(task.id)) return [];
  const reasons: string[] = [];
  if (tracker.level < task.minPlayerLevel) reasons.push(`Lv ${task.minPlayerLevel}`);
  const loyalty = traderLoyaltyOf(tracker, task.trader.name);
  if (loyalty < (task.loyaltyLevel ?? 1)) {
    reasons.push(
      loyalty === 0
        ? `${task.trader.name} locked`
        : `${task.trader.name} LL${task.loyaltyLevel}`,
    );
  }
  if (
    task.storyChapter &&
    !(tracker.storyChapterIds ?? []).includes(storyChapterSlug(task.storyChapter))
  ) {
    reasons.push(`${task.storyChapter} chapter`);
  }
  const taskFaction =
    task.factionName === 'USEC' || task.factionName === 'BEAR' ? task.factionName : 'Any';
  if (taskFaction !== 'Any' && tracker.faction !== 'Any' && taskFaction !== tracker.faction) {
    reasons.push(`${taskFaction} only`);
  }
  const missing = task.taskRequirements.filter(
    (req) => req.status.includes('complete') && !tracker.completedTaskIds.includes(req.taskId),
  );
  for (const req of missing.slice(0, 2)) {
    reasons.push(`after ${byId.get(req.taskId)?.name ?? 'an earlier quest'}`);
  }
  if (missing.length > 2) reasons.push(`+${missing.length - 2} more`);
  return reasons;
}
