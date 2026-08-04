import { describe, expect, it } from 'vitest';
import { fixtureSnapshot, tLocked, tMulti } from './fixtures';
import { anywhereQuests, objectivePoints, questsForMap } from './questIndex';

describe('questsForMap', () => {
  it('lists a map-locked task only on its map, with map-locked relation', () => {
    const onA = questsForMap(fixtureSnapshot, 'map-a');
    const onB = questsForMap(fixtureSnapshot, 'map-b');
    const entry = onA.find((e) => e.task.id === 't-locked');
    expect(entry?.relation).toBe('map-locked');
    expect(onB.some((e) => e.task.id === 't-locked')).toBe(false);
  });

  it('lists a multi-map task on both maps with multi-map relation', () => {
    for (const mapId of ['map-a', 'map-b']) {
      const entry = questsForMap(fixtureSnapshot, mapId).find((e) => e.task.id === 't-multi');
      expect(entry?.relation).toBe('multi-map');
    }
  });

  it('does not list anywhere-quests on maps', () => {
    expect(
      questsForMap(fixtureSnapshot, 'map-a').some((e) => e.task.id === 't-anywhere'),
    ).toBe(false);
  });

  it('fills objectivesHere with only this map objectives', () => {
    const entry = questsForMap(fixtureSnapshot, 'map-a').find((e) => e.task.id === 't-multi');
    expect(entry?.objectivesHere.map((o) => o.id)).toEqual(['o-multi-1']);
  });
});

describe('anywhereQuests', () => {
  it('returns only tasks with no map-bound or located objectives', () => {
    expect(anywhereQuests(fixtureSnapshot).map((t) => t.id)).toEqual(['t-anywhere']);
  });
});

describe('objectivePoints', () => {
  it('filters points to the requested map', () => {
    const result = objectivePoints(tMulti, 'map-b');
    expect(result).toHaveLength(1);
    expect(result[0].points.map((p) => p.id)).toEqual(['z3']);
  });

  it('returns the objective with its points on the locked map', () => {
    const result = objectivePoints(tLocked, 'map-a');
    expect(result[0].points.map((p) => p.id)).toEqual(['z1']);
  });
});
