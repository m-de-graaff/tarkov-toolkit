import type { RpCraft } from '@raidplanner/data';
import { describe, expect, it } from 'vitest';
import { bestCraftsPerStation } from './craftingXp';
import type { ItemPrices } from './profit';

const prices: ItemPrices = {
  cheap: { fleaAvg: 6_000, fleaLow: 0, basePrice: 0, bestTraderSell: 0 },
  pricey: { fleaAvg: 100_000, fleaLow: 0, basePrice: 0, bestTraderSell: 0 },
  tool: { fleaAvg: 500_000, fleaLow: 0, basePrice: 0, bestTraderSell: 0 },
};

const craft = (id: string, over: Partial<RpCraft>): RpCraft => ({
  id,
  stationId: 'workbench',
  stationLevel: 1,
  durationSeconds: 3600,
  requiredItems: [{ itemId: 'cheap', count: 1 }],
  rewardItems: [{ itemId: 'cheap', count: 1 }],
  ...over,
});

describe('bestCraftsPerStation', () => {
  it('groups by station and prefers short cheap crafts, tools excluded from cost', () => {
    const groups = bestCraftsPerStation(
      [
        craft('slow-cheap', { durationSeconds: 4 * 3600 }),
        craft('fast-cheap', {}),
        craft('with-tool', {
          requiredItems: [
            { itemId: 'cheap', count: 1 },
            { itemId: 'tool', count: 1, tool: true },
          ],
          durationSeconds: 2 * 3600,
        }),
        craft('expensive', { requiredItems: [{ itemId: 'pricey', count: 2 }] }),
        craft('med', { stationId: 'medstation' }),
      ],
      prices,
      {},
      { onlyBuilt: false, ignoreCost: false },
    );
    const workbench = groups.find((g) => g.stationId === 'workbench')!;
    // score = materials + station-time value: the tool's 500k price never counts
    expect(workbench.rows.map((r) => r.craft.id)).toEqual(['fast-cheap', 'with-tool', 'slow-cheap']);
    expect(workbench.rows[0].costPerPoint).toBe(1_200); // 6k materials / 5 points
    expect(groups.find((g) => g.stationId === 'medstation')!.rows).toHaveLength(1);
  });

  it('a much longer craft loses to a slightly pricier short one', () => {
    const groups = bestCraftsPerStation(
      [
        craft('marathon', {
          durationSeconds: 72 * 3600,
          requiredItems: [{ itemId: 'pricey', count: 1 }],
        }),
        craft('quick', { durationSeconds: 3.5 * 3600 }),
      ],
      prices,
      {},
      { onlyBuilt: false, ignoreCost: false },
    );
    expect(groups[0].rows.map((r) => r.craft.id)).toEqual(['quick', 'marathon']);
  });

  it('ignoreCost ranks purely by duration and needs no prices', () => {
    const groups = bestCraftsPerStation(
      [
        craft('long', { durationSeconds: 8 * 3600 }),
        craft('short', {
          durationSeconds: 30 * 60,
          requiredItems: [{ itemId: 'unpriced', count: 1 }],
        }),
      ],
      null,
      {},
      { onlyBuilt: false, ignoreCost: true },
    );
    expect(groups[0].rows.map((r) => r.craft.id)).toEqual(['short', 'long']);
    // alternating the top two: 10 points per 8.5 combined hours
    expect(groups[0].pairPointsPerHour).toBeCloseTo(10 / 8.5, 3);
  });

  it('a single-recipe station has no alternation pair', () => {
    const groups = bestCraftsPerStation(
      [craft('water', { stationId: 'water-collector' })],
      prices,
      {},
      { onlyBuilt: false, ignoreCost: false },
    );
    expect(groups[0].pairPointsPerHour).toBeNull();
  });

  it('onlyBuilt filters to stations the user has at the required level', () => {
    const groups = bestCraftsPerStation(
      [craft('a', {}), craft('b', { stationLevel: 3 })],
      prices,
      { workbench: 1 },
      { onlyBuilt: true, ignoreCost: false },
    );
    expect(groups[0].rows.map((r) => r.craft.id)).toEqual(['a']);
  });

  it('caps each station at perStation rows', () => {
    const groups = bestCraftsPerStation(
      [craft('a', {}), craft('b', {}), craft('c', {}), craft('d', {})],
      prices,
      {},
      { onlyBuilt: false, ignoreCost: false, perStation: 2 },
    );
    expect(groups[0].rows).toHaveLength(2);
  });
});
