import { describe, expect, it } from 'vitest';
import { buildPrices } from './prices';

describe('buildPrices', () => {
  it('resolves item names through the translation dict and keeps trader data', () => {
    const prices = buildPrices(
      {
        abc123: {
          id: 'abc123',
          name: 'abc123 Name',
          iconLink: 'https://assets.tarkov.dev/abc123-icon.webp',
          avg24hPrice: 30_000,
          lastLowPrice: 28_000,
          basePrice: 10_000,
          sellToTrader: [
            { trader: 'therapist', priceRUB: 26_000 },
            { trader: 'fence', priceRUB: 20_000 },
          ],
          buyFromTrader: [
            { trader: 'prapor', priceRUB: 22_000, minTraderLevel: 2, buyLimit: 5, taskUnlock: null },
          ],
        },
      },
      { 'abc123 Name': 'Salewa first aid kit' },
    );

    expect(prices.abc123).toEqual({
      fleaAvg: 30_000,
      fleaLow: 28_000,
      basePrice: 10_000,
      bestTraderSell: 26_000,
      bestTraderSellTraderId: 'therapist',
      name: 'Salewa first aid kit',
      iconLink: 'https://assets.tarkov.dev/abc123-icon.webp',
      offers: [
        { traderId: 'prapor', priceRUB: 22_000, minTraderLevel: 2, buyLimit: 5, taskLocked: false },
      ],
    });
  });

  it('omits the name when the dict has no entry (never stores the raw key)', () => {
    const prices = buildPrices(
      { x: { id: 'x', name: 'x Name', avg24hPrice: 1 } },
      {},
    );
    expect(prices.x.name).toBeUndefined();
  });
});
