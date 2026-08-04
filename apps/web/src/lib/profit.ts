import type { RpBarter, RpCraft, TradeItemStack } from '@raidplanner/data';

export interface TraderOffer {
  traderId: string;
  priceRUB: number;
  minTraderLevel: number;
  buyLimit: number;
  taskLocked: boolean;
}

export interface ItemPriceEntry {
  /** flea 24h average (0 = not flea-tradeable) */
  fleaAvg: number;
  fleaLow: number;
  basePrice: number;
  /** best sell-to-trader price in RUB */
  bestTraderSell: number;
  /** trader cash offers to BUY this item */
  offers?: TraderOffer[];
}

export type ItemPrices = Record<string, ItemPriceEntry>;

const acquireCost = (prices: ItemPrices, itemId: string): number | null => {
  const p = prices[itemId];
  if (!p) return null;
  return p.fleaAvg || p.fleaLow || null;
};

/** what a stack is worth when sold the best way (flea average vs best trader) */
const sellValue = (prices: ItemPrices, itemId: string): number | null => {
  const p = prices[itemId];
  if (!p) return null;
  const best = Math.max(p.fleaAvg || 0, p.bestTraderSell || 0);
  return best > 0 ? best : null;
};

const stackCost = (prices: ItemPrices, stacks: TradeItemStack[]): number | null => {
  let total = 0;
  for (const stack of stacks) {
    const price = acquireCost(prices, stack.itemId);
    if (price === null) return null;
    total += price * stack.count;
  }
  return total;
};

const stackRevenue = (prices: ItemPrices, stacks: TradeItemStack[]): number | null => {
  let total = 0;
  for (const stack of stacks) {
    const price = sellValue(prices, stack.itemId);
    if (price === null) return null;
    total += price * stack.count;
  }
  return total;
};

export interface TradeProfit {
  cost: number | null;
  revenue: number | null;
  profit: number | null;
  profitPerHour?: number | null;
}

export function barterProfit(barter: RpBarter, prices: ItemPrices): TradeProfit {
  const cost = stackCost(prices, barter.requiredItems);
  const revenue = stackRevenue(prices, barter.rewardItems);
  return {
    cost,
    revenue,
    profit: cost !== null && revenue !== null ? revenue - cost : null,
  };
}

export function craftProfit(craft: RpCraft, prices: ItemPrices): TradeProfit {
  const cost = stackCost(prices, craft.requiredItems);
  const revenue = stackRevenue(prices, craft.rewardItems);
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

export interface ResellRow {
  itemId: string;
  traderId: string;
  buyPrice: number;
  fleaSell: number;
  /** gross spread, before the flea listing fee */
  spread: number;
  minTraderLevel: number;
  buyLimit: number;
}

/**
 * Trader cash offers (Fence included) whose flea 24h average exceeds the buy
 * price — "buy from trader, sell on flea" flips. Task-locked offers are
 * excluded; spreads are gross (flea fee not modelled — it depends on the
 * user's Intelligence Center).
 */
export function traderResells(prices: ItemPrices): ResellRow[] {
  const rows: ResellRow[] = [];
  for (const [itemId, entry] of Object.entries(prices)) {
    if (!entry.offers || !entry.fleaAvg) continue;
    for (const offer of entry.offers) {
      if (offer.taskLocked || offer.priceRUB <= 0) continue;
      const spread = entry.fleaAvg - offer.priceRUB;
      if (spread <= 0) continue;
      rows.push({
        itemId,
        traderId: offer.traderId,
        buyPrice: offer.priceRUB,
        fleaSell: entry.fleaAvg,
        spread,
        minTraderLevel: offer.minTraderLevel,
        buyLimit: offer.buyLimit,
      });
    }
  }
  return rows.sort((a, b) => b.spread - a.spread);
}
