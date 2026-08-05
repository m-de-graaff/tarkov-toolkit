import type { HideoutLevel, HideoutStation } from '@raidplanner/data';

export interface ItemReadiness {
  itemId: string;
  need: number;
  have: number;
  foundInRaid: boolean;
  met: boolean;
}

export interface LevelReadiness {
  items: ItemReadiness[];
  itemsMet: boolean;
  stationsMet: boolean;
  /** every item and station prerequisite satisfied — ready to build */
  ready: boolean;
}

/**
 * Whether the next level of a station can be built from what the user has
 * collected (itemsHave) and already built (hideoutLevels). Trader loyalty
 * isn't tracked, so it never blocks readiness — it's displayed, not enforced.
 */
export function levelReadiness(
  level: HideoutLevel,
  itemsHave: Record<string, number>,
  hideoutLevels: Record<string, number>,
): LevelReadiness {
  const items = level.itemRequirements.map((req) => {
    const have = Math.min(itemsHave[req.itemId] ?? 0, req.count);
    return {
      itemId: req.itemId,
      need: req.count,
      have,
      foundInRaid: req.foundInRaid,
      met: have >= req.count,
    };
  });
  const itemsMet = items.every((item) => item.met);
  const stationsMet = level.stationLevelRequirements.every(
    (req) => (hideoutLevels[req.stationId] ?? 0) >= req.level,
  );
  return { items, itemsMet, stationsMet, ready: itemsMet && stationsMet };
}

export function nextLevelOf(station: HideoutStation, currentLevel: number): HideoutLevel | null {
  return station.levels.find((l) => l.level === currentLevel + 1) ?? null;
}
