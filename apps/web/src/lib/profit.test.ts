import type { RpBarter, RpCraft } from '@raidplanner/data';
import { describe, expect, it } from 'vitest';
import { barterProfit, craftProfit, type ItemPrices } from './profit';

const prices: ItemPrices = {
  'item-a': { fleaAvg: 10_000, fleaLow: 9_000, basePrice: 5_000 },
  'item-b': { fleaAvg: 50_000, fleaLow: 45_000, basePrice: 20_000 },
  'item-unpriced': { fleaAvg: 0, fleaLow: 0, basePrice: 1_000 },
};

const barter: RpBarter = {
  id: 'b1',
  traderName: 'Therapist',
  traderLevel: 2,
  requiredItems: [{ itemId: 'item-a', count: 3 }],
  rewardItems: [{ itemId: 'item-b', count: 1 }],
};

describe('barterProfit', () => {
  it('computes revenue minus cost from flea averages', () => {
    expect(barterProfit(barter, prices)).toEqual({ cost: 30_000, revenue: 50_000, profit: 20_000 });
  });

  it('marks trades with unpriceable inputs as null, not zero', () => {
    const result = barterProfit(
      { ...barter, requiredItems: [{ itemId: 'item-unpriced', count: 1 }] },
      prices,
    );
    expect(result.cost).toBeNull();
    expect(result.profit).toBeNull();
  });
});

describe('craftProfit', () => {
  it('adds profit per hour from the craft duration', () => {
    const craft: RpCraft = {
      id: 'c1',
      stationId: 'st',
      stationLevel: 1,
      durationSeconds: 7200,
      requiredItems: [{ itemId: 'item-a', count: 1 }],
      rewardItems: [{ itemId: 'item-b', count: 1 }],
    };
    const result = craftProfit(craft, prices);
    expect(result.profit).toBe(40_000);
    expect(result.profitPerHour).toBe(20_000);
  });
});
