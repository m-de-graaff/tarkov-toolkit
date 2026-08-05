import type { RpTask } from '@raidplanner/data';
import type { TrackerState } from './availability';

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
