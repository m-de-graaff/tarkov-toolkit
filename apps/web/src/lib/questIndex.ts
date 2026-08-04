import type { RpObjective, RpTask, RpZone, Snapshot } from '@raidplanner/data';

export type MapRelation = 'map-locked' | 'multi-map' | 'anywhere';

export interface MapQuestEntry {
  task: RpTask;
  relation: MapRelation;
  /** objectives doable on this map */
  objectivesHere: RpObjective[];
}

function objectiveTouchesMap(objective: RpObjective, mapId: string): boolean {
  return (
    objective.maps.includes(mapId) || objective.points.some((p) => p.map === mapId)
  );
}

function objectivesOnMap(task: RpTask, mapId: string): RpObjective[] {
  return task.objectives.filter(
    (o) =>
      objectiveTouchesMap(o, mapId) ||
      (task.mapId === mapId && o.maps.length === 0),
  );
}

/** true when the task has no location constraints at all */
function isAnywhere(task: RpTask): boolean {
  return (
    task.mapId === null &&
    task.objectives.every((o) => o.maps.length === 0 && o.points.length === 0)
  );
}

export function questsForMap(snapshot: Snapshot, mapId: string): MapQuestEntry[] {
  const entries: MapQuestEntry[] = [];
  for (const task of snapshot.tasks) {
    if (task.mapId === mapId) {
      entries.push({ task, relation: 'map-locked', objectivesHere: objectivesOnMap(task, mapId) });
      continue;
    }
    if (task.mapId !== null) {
      // locked to another map: only relevant there
      continue;
    }
    if (task.objectives.some((o) => objectiveTouchesMap(o, mapId))) {
      entries.push({ task, relation: 'multi-map', objectivesHere: objectivesOnMap(task, mapId) });
    }
  }
  return entries;
}

export function anywhereQuests(snapshot: Snapshot): RpTask[] {
  return snapshot.tasks.filter(isAnywhere);
}

export function objectivePoints(
  task: RpTask,
  mapId: string,
): { objective: RpObjective; points: RpZone[] }[] {
  return task.objectives
    .map((objective) => ({
      objective,
      points: objective.points.filter((p) => p.map === mapId),
    }))
    .filter((entry) => entry.points.length > 0);
}
