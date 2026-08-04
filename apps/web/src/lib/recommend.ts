import type { Snapshot } from '@raidplanner/data';
import type { TrackerState } from './availability';
import { isAvailable } from './availability';
import { questsForMap } from './questIndex';

export interface MapScore {
  mapId: string;
  mapName: string;
  availableQuestCount: number;
  mapLockedCount: number;
}

/**
 * Score renderable maps by how many currently-available quests can be advanced
 * there; maps with nothing to do are omitted.
 */
export function recommendMaps(snapshot: Snapshot, tracker: TrackerState): MapScore[] {
  const scores: MapScore[] = [];
  for (const map of snapshot.maps) {
    if (!map.calibration) continue;
    const open = questsForMap(snapshot, map.id).filter((e) => isAvailable(e.task, tracker));
    if (open.length === 0) continue;
    scores.push({
      mapId: map.id,
      mapName: map.name,
      availableQuestCount: open.length,
      mapLockedCount: open.filter((e) => e.relation === 'map-locked').length,
    });
  }
  return scores.sort(
    (a, b) =>
      b.availableQuestCount - a.availableQuestCount || b.mapLockedCount - a.mapLockedCount,
  );
}
