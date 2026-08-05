import type { HideoutLevel } from '@raidplanner/data';
import { describe, expect, it } from 'vitest';
import { levelReadiness } from './hideoutReady';

const level: HideoutLevel = {
  level: 2,
  constructionTime: 0,
  itemRequirements: [
    { itemId: 'lamps', count: 3, foundInRaid: true },
    { itemId: 'wires', count: 5, foundInRaid: false },
  ],
  stationLevelRequirements: [{ stationId: 'generator', level: 1 }],
  traderRequirements: [{ traderName: 'Therapist', level: 2 }],
};

describe('levelReadiness', () => {
  it('is ready when all items are collected and prerequisite stations built', () => {
    const result = levelReadiness(level, { lamps: 3, wires: 9 }, { generator: 1 });
    expect(result.ready).toBe(true);
    expect(result.items.find((i) => i.itemId === 'wires')!.have).toBe(5); // capped at need
  });

  it('reports partial item progress and blocks readiness', () => {
    const result = levelReadiness(level, { lamps: 1 }, { generator: 1 });
    expect(result.ready).toBe(false);
    expect(result.items.find((i) => i.itemId === 'lamps')).toMatchObject({ have: 1, need: 3, met: false });
  });

  it('blocks readiness on missing prerequisite stations even with all items', () => {
    const result = levelReadiness(level, { lamps: 3, wires: 5 }, {});
    expect(result.itemsMet).toBe(true);
    expect(result.stationsMet).toBe(false);
    expect(result.ready).toBe(false);
  });
});
