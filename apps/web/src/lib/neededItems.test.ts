import type { HideoutStation, Snapshot } from '@raidplanner/data';
import { describe, expect, it } from 'vitest';
import type { TrackerState } from './availability';
import { fixtureSnapshot, tLocked } from './fixtures';
import { neededItems } from './neededItems';

const tracker: TrackerState = { level: 15, faction: 'Any', completedTaskIds: [] };

const station: HideoutStation = {
  id: 'st-1',
  name: 'Workbench',
  normalizedName: 'workbench',
  levels: [
    {
      level: 1,
      constructionTime: 0,
      itemRequirements: [{ itemId: 'item-bolts', count: 2, foundInRaid: true }],
      stationLevelRequirements: [],
      traderRequirements: [],
    },
    {
      level: 2,
      constructionTime: 0,
      itemRequirements: [{ itemId: 'item-wires', count: 3, foundInRaid: false }],
      stationLevelRequirements: [],
      traderRequirements: [],
    },
  ],
};

function withNeeds(): Snapshot {
  const questTask = {
    ...tLocked,
    objectives: [
      {
        ...tLocked.objectives[0],
        neededItems: { itemIds: ['item-bolts', 'item-alt'], count: 4, foundInRaid: false },
      },
    ],
  };
  return { ...fixtureSnapshot, tasks: [questTask], hideout: [station] };
}

describe('neededItems', () => {
  it('aggregates open-quest hand-ins with next hideout level, tracking FIR portions', () => {
    const rows = neededItems(withNeeds(), tracker, {});
    const bolts = rows.find((r) => r.itemId === 'item-bolts')!;
    expect(bolts.total).toBe(6); // 4 quest + 2 hideout L1
    expect(bolts.firCount).toBe(2); // only the hideout requirement is FIR
    expect(bolts.sources).toEqual(['Locked to A (or 1 alt.)', 'Workbench L1']);
  });

  it('advancing a station moves needs to the next level', () => {
    const rows = neededItems(withNeeds(), tracker, { 'st-1': 1 });
    expect(rows.some((r) => r.itemId === 'item-wires')).toBe(true);
    const bolts = rows.find((r) => r.itemId === 'item-bolts')!;
    expect(bolts.total).toBe(4); // hideout L1 satisfied
  });

  it('completed quests contribute nothing', () => {
    const rows = neededItems(withNeeds(), { ...tracker, completedTaskIds: [tLocked.id] }, { 'st-1': 2 });
    expect(rows).toEqual([]);
  });
});
