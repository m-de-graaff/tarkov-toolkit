import type { RpCraft } from '@raidplanner/data';
import { describe, expect, it } from 'vitest';
import { craftingLevelingRows } from './craftingXp';
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

describe('craftingLevelingRows', () => {
  it('ranks by cost per crafting hour, tools excluded', () => {
    const rows = craftingLevelingRows(
      [
        craft('slow-cheap', { durationSeconds: 4 * 3600 }), // 6k over 4h = 1.5k/h
        craft('fast-cheap', {}), // 6k/h
        craft('with-tool', {
          requiredItems: [
            { itemId: 'cheap', count: 1 },
            { itemId: 'tool', count: 1, tool: true },
          ],
          durationSeconds: 2 * 3600,
        }), // 3k/h, tool free
        craft('expensive', { requiredItems: [{ itemId: 'pricey', count: 2 }] }),
      ],
      prices,
      {},
      false,
    );
    expect(rows.map((r) => r.craft.id)).toEqual(['slow-cheap', 'with-tool', 'fast-cheap', 'expensive']);
    expect(rows[0].costPerHour).toBe(1_500);
  });

  it('onlyBuilt filters to stations the user has at the required level', () => {
    const crafts = [craft('a', {}), craft('b', { stationLevel: 3 })];
    const rows = craftingLevelingRows(crafts, prices, { workbench: 1 }, true);
    expect(rows.map((r) => r.craft.id)).toEqual(['a']);
  });
});
