import type { RpBarter, RpCraft } from '@raidplanner/data';
import { describe, expect, it } from 'vitest';
import { barterProfit, craftProfit, fleaToTrader, traderResells, type ItemPrices } from './profit';

const prices: ItemPrices = {
  'item-a': { fleaAvg: 10_000, fleaLow: 9_000, basePrice: 5_000, bestTraderSell: 4_000 },
  'item-b': {
    fleaAvg: 50_000,
    fleaLow: 45_000,
    basePrice: 20_000,
    bestTraderSell: 60_000, // trader pays MORE than flea - revenue should use it
  },
  'item-unpriced': { fleaAvg: 0, fleaLow: 0, basePrice: 1_000, bestTraderSell: 0 },
  'item-flip': {
    fleaAvg: 30_000,
    fleaLow: 28_000,
    basePrice: 10_000,
    bestTraderSell: 12_000,
    offers: [
      { traderId: 'fence', priceRUB: 18_000, minTraderLevel: 1, buyLimit: 3, taskLocked: false },
      { traderId: 'prapor', priceRUB: 40_000, minTraderLevel: 2, buyLimit: 0, taskLocked: false },
      { traderId: 'locked', priceRUB: 1_000, minTraderLevel: 1, buyLimit: 0, taskLocked: true },
    ],
  },
};

const barter: RpBarter = {
  id: 'b1',
  traderName: 'Therapist',
  traderLevel: 2,
  taskLocked: false,
  buyLimit: 0,
  requiredItems: [{ itemId: 'item-a', count: 3 }],
  rewardItems: [{ itemId: 'item-b', count: 1 }],
};

describe('barterProfit', () => {
  it('computes revenue minus cost, selling rewards the best way', () => {
    // item-b sells better to a trader (60k) than on flea (50k)
    expect(barterProfit(barter, prices)).toEqual({
      cost: 30_000,
      revenue: 60_000,
      profit: 30_000,
      fleaRevenue: 50_000,
      traderRevenue: 60_000,
      sellTraderId: undefined,
    });
  });

  it('splits revenue per outlet and reports the paying trader', () => {
    const result = barterProfit(barter, {
      ...prices,
      'item-b': { ...prices['item-b'], bestTraderSellTraderId: 'therapist' },
    });
    expect(result.fleaRevenue).toBe(50_000);
    expect(result.traderRevenue).toBe(60_000);
    expect(result.sellTraderId).toBe('therapist');
  });

  it('nulls an outlet the reward cannot sell through', () => {
    const result = barterProfit(
      { ...barter, rewardItems: [{ itemId: 'flea-banned-reward', count: 1 }] },
      {
        ...prices,
        'flea-banned-reward': { fleaAvg: 0, fleaLow: 0, basePrice: 0, bestTraderSell: 20_000 },
      },
    );
    expect(result.fleaRevenue).toBeNull();
    expect(result.traderRevenue).toBe(20_000);
    expect(result.revenue).toBe(20_000);
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

describe('acquisition fallback and tools', () => {
  const fallbackPrices: ItemPrices = {
    'flea-banned': {
      fleaAvg: 0,
      fleaLow: 0,
      basePrice: 5_000,
      bestTraderSell: 0,
      offers: [
        { traderId: 'peacekeeper', priceRUB: 25_000, minTraderLevel: 2, buyLimit: 0, taskLocked: false },
      ],
    },
    'the-tool': { fleaAvg: 900_000, fleaLow: 0, basePrice: 0, bestTraderSell: 0 },
    'reward': { fleaAvg: 40_000, fleaLow: 0, basePrice: 0, bestTraderSell: 0 },
  };

  it('prices flea-banned inputs via the cheapest trader offer', () => {
    const barter: RpBarter = {
      id: 'b',
      traderName: 'Skier',
      traderLevel: 1,
      taskLocked: false,
      buyLimit: 0,
      requiredItems: [{ itemId: 'flea-banned', count: 1 }],
      rewardItems: [{ itemId: 'reward', count: 1 }],
    };
    expect(barterProfit(barter, fallbackPrices)).toEqual({
      cost: 25_000,
      revenue: 40_000,
      profit: 15_000,
      fleaRevenue: 40_000,
      traderRevenue: null, // reward has no trader buyer
      sellTraderId: undefined,
    });
  });

  it('excludes tools from craft cost', () => {
    const craft: RpCraft = {
      id: 'c',
      stationId: 'st',
      stationLevel: 1,
      durationSeconds: 3600,
      requiredItems: [
        { itemId: 'the-tool', count: 1, tool: true },
        { itemId: 'flea-banned', count: 1 },
      ],
      rewardItems: [{ itemId: 'reward', count: 1 }],
    };
    expect(craftProfit(craft, fallbackPrices).profit).toBe(15_000);
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
    expect(result.profit).toBe(50_000); // 60k trader sell − 10k flea cost
    expect(result.profitPerHour).toBe(25_000);
  });
});

describe('fleaToTrader', () => {
  it('finds items a trader pays more for than flea asks', () => {
    const rows = fleaToTrader({
      'good-flip': {
        fleaAvg: 40_000,
        fleaLow: 0,
        basePrice: 0,
        bestTraderSell: 55_000,
        bestTraderSellTraderId: 'therapist',
      },
      'bad-flip': { fleaAvg: 40_000, fleaLow: 0, basePrice: 0, bestTraderSell: 30_000 },
      'no-flea': { fleaAvg: 0, fleaLow: 0, basePrice: 0, bestTraderSell: 10_000 },
    });
    expect(rows).toEqual([
      {
        itemId: 'good-flip',
        buyFlea: 40_000,
        sellTrader: 55_000,
        sellTraderId: 'therapist',
        spread: 15_000,
      },
    ]);
  });
});

describe('traderResells', () => {
  it('finds positive-spread offers, skipping task-locked and losing ones', () => {
    const rows = traderResells(prices);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      itemId: 'item-flip',
      traderId: 'fence',
      buyPrice: 18_000,
      fleaSell: 30_000,
      spread: 12_000,
      minTraderLevel: 1,
      buyLimit: 3,
    });
  });
});
