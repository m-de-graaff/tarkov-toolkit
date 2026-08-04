import type { HideoutStation, Snapshot } from '@raidplanner/data';
import type { TrackerState } from './availability';
import { availableQuests } from './availability';

export interface NeededItemRow {
  itemId: string;
  /** total count needed across all sources */
  total: number;
  /** portion of total that must be found-in-raid */
  firCount: number;
  /** human-readable sources, e.g. "Debut", "Workbench L2" */
  sources: string[];
}

/**
 * Aggregate the items consumed by the user's OPEN quests plus the next level
 * of every hideout station below max. Multi-choice hand-ins count their first
 * (canonical) item and note the alternatives in the source label.
 */
export function neededItems(
  snapshot: Snapshot,
  tracker: TrackerState,
  hideoutLevels: Record<string, number>,
): NeededItemRow[] {
  const rows = new Map<string, NeededItemRow>();
  const add = (itemId: string, count: number, foundInRaid: boolean, source: string) => {
    const row = rows.get(itemId) ?? { itemId, total: 0, firCount: 0, sources: [] };
    row.total += count;
    if (foundInRaid) row.firCount += count;
    if (!row.sources.includes(source)) row.sources.push(source);
    rows.set(itemId, row);
  };

  for (const task of availableQuests(snapshot, tracker)) {
    for (const objective of task.objectives) {
      const needed = objective.neededItems;
      if (!needed) continue;
      const alternatives = needed.itemIds.length - 1;
      const source = alternatives > 0 ? `${task.name} (or ${alternatives} alt.)` : task.name;
      add(needed.itemIds[0], needed.count, needed.foundInRaid, source);
    }
  }

  for (const station of snapshot.hideout) {
    const current = hideoutLevels[station.id] ?? 0;
    const next = station.levels.find((l) => l.level === current + 1);
    if (!next) continue;
    for (const req of next.itemRequirements) {
      add(req.itemId, req.count, req.foundInRaid, `${station.name} L${next.level}`);
    }
  }

  return [...rows.values()].sort((a, b) => b.total - a.total);
}

export function nextLevel(station: HideoutStation, currentLevel: number) {
  return station.levels.find((l) => l.level === currentLevel + 1) ?? null;
}

export function maxLevel(station: HideoutStation): number {
  return Math.max(0, ...station.levels.map((l) => l.level));
}
