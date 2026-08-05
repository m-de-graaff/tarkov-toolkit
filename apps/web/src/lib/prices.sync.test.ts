// The api function ships its own copy of buildPrices (Vercel functions build
// independently of the web app). This test keeps the two implementations in
// lockstep: same fixture in, identical output out.
import { describe, expect, it } from 'vitest';
import { buildPrices as apiBuildPrices } from '../../../../api/_lib/buildPrices';
import type { RawItem } from './prices';
import { buildPrices as webBuildPrices } from './prices';

const fixture: Record<string, RawItem> = {
  'item-a': {
    id: 'item-a',
    name: 'key.item-a',
    iconLink: 'https://assets.example/item-a.webp',
    avg24hPrice: 12_345,
    lastLowPrice: 11_000,
    basePrice: 8_000,
    buyFromTrader: [
      { trader: 'prapor', priceRUB: 9_000, minTraderLevel: 2, buyLimit: 3 },
      { trader: 'locked', priceRUB: 5_000, taskUnlock: { id: 't1' } },
      { trader: 'zero', priceRUB: 0 },
    ],
    sellToTrader: [
      { trader: 'therapist', priceRUB: 7_500 },
      { trader: 'fence', priceRUB: 6_000 },
    ],
  },
  'item-bare': { id: 'item-bare' },
};

const enDict = { 'key.item-a': 'Item A' };

describe('api buildPrices stays in lockstep with the web implementation', () => {
  it('produces identical output for the same input', () => {
    expect(apiBuildPrices(fixture, enDict)).toEqual(webBuildPrices(fixture, enDict));
  });

  it('extracts the expected shape', () => {
    const out = webBuildPrices(fixture, enDict);
    expect(out['item-a']).toMatchObject({
      fleaAvg: 12_345,
      bestTraderSell: 7_500,
      bestTraderSellTraderId: 'therapist',
      name: 'Item A',
    });
    expect(out['item-a'].offers).toHaveLength(2); // zero-price offer dropped
    expect(out['item-a'].offers?.find((o) => o.traderId === 'locked')?.taskLocked).toBe(true);
    expect(out['item-bare']).toEqual({
      fleaAvg: 0,
      fleaLow: 0,
      basePrice: 0,
      bestTraderSell: 0,
    });
  });
});
