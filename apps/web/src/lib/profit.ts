import type { RpBarter, RpCraft, TradeItemStack } from '@raidplanner/data';

export interface ItemPrices {
  /** flea 24h average (0/absent = not flea-tradeable) */
  [itemId: string]: { fleaAvg: number; fleaLow: number; basePrice: number };
}

const priceOf = (prices: ItemPrices, itemId: string): number | null => {
  const p = prices[itemId];
  if (!p) return null;
  return p.fleaAvg || p.fleaLow || null;
};

const stackValue = (prices: ItemPrices, stacks: TradeItemStack[]): number | null => {
  let total = 0;
  for (const stack of stacks) {
    const price = priceOf(prices, stack.itemId);
    if (price === null) return null; // any unpriceable input makes the trade unpriceable
    total += price * stack.count;
  }
  return total;
};

export interface TradeProfit {
  cost: number | null;
  revenue: number | null;
  profit: number | null;
  /** crafts only: profit per hour of crafting time */
  profitPerHour?: number | null;
}

export function barterProfit(barter: RpBarter, prices: ItemPrices): TradeProfit {
  const cost = stackValue(prices, barter.requiredItems);
  const revenue = stackValue(prices, barter.rewardItems);
  return {
    cost,
    revenue,
    profit: cost !== null && revenue !== null ? revenue - cost : null,
  };
}

export function craftProfit(craft: RpCraft, prices: ItemPrices): TradeProfit {
  const cost = stackValue(prices, craft.requiredItems);
  const revenue = stackValue(prices, craft.rewardItems);
  const profit = cost !== null && revenue !== null ? revenue - cost : null;
  return {
    cost,
    revenue,
    profit,
    profitPerHour:
      profit !== null && craft.durationSeconds > 0
        ? Math.round(profit / (craft.durationSeconds / 3600))
        : null,
  };
}
