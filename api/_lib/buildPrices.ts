// Pure price extraction, ported from apps/web/src/lib/prices.ts buildPrices.
// Duplicated because Vercel functions build independently of the web app;
// apps/web/src/lib/prices.sync.test.ts asserts the two stay in lockstep.

export interface RawTraderOffer {
  trader: string;
  priceRUB?: number;
  minTraderLevel?: number;
  taskUnlock?: unknown;
  buyLimit?: number;
}

export interface RawItem {
  id: string;
  name?: string;
  iconLink?: string;
  avg24hPrice?: number;
  lastLowPrice?: number;
  basePrice?: number;
  buyFromTrader?: RawTraderOffer[];
  sellToTrader?: { trader: string; priceRUB?: number }[];
}

export interface TraderOffer {
  traderId: string;
  priceRUB: number;
  minTraderLevel: number;
  buyLimit: number;
  taskLocked: boolean;
}

export interface ItemPriceEntry {
  fleaAvg: number;
  fleaLow: number;
  basePrice: number;
  bestTraderSell: number;
  bestTraderSellTraderId?: string;
  name?: string;
  iconLink?: string;
  offers?: TraderOffer[];
}

export type ItemPrices = Record<string, ItemPriceEntry>;

export function buildPrices(
  itemsById: Record<string, RawItem>,
  enDict: Record<string, string>,
): ItemPrices {
  const translate = (key: unknown): string | undefined =>
    typeof key === 'string' ? (enDict[key] ?? undefined) : undefined;
  const prices: ItemPrices = {};
  for (const item of Object.values(itemsById)) {
    let bestTraderSell = 0;
    let bestTraderSellTraderId: string | undefined;
    for (const offer of item.sellToTrader ?? []) {
      if ((offer.priceRUB ?? 0) > bestTraderSell) {
        bestTraderSell = offer.priceRUB ?? 0;
        bestTraderSellTraderId = offer.trader;
      }
    }
    const offers = (item.buyFromTrader ?? [])
      .filter((offer) => (offer.priceRUB ?? 0) > 0)
      .map((offer) => ({
        traderId: offer.trader,
        priceRUB: offer.priceRUB ?? 0,
        minTraderLevel: offer.minTraderLevel ?? 1,
        buyLimit: offer.buyLimit ?? 0,
        taskLocked: offer.taskUnlock != null,
      }));
    const name = translate(item.name);
    prices[item.id] = {
      fleaAvg: item.avg24hPrice ?? 0,
      fleaLow: item.lastLowPrice ?? 0,
      basePrice: item.basePrice ?? 0,
      bestTraderSell,
      ...(bestTraderSellTraderId ? { bestTraderSellTraderId } : {}),
      ...(name ? { name } : {}),
      ...(item.iconLink ? { iconLink: item.iconLink } : {}),
      ...(offers.length > 0 ? { offers } : {}),
    };
  }
  return prices;
}
