// Live prices per game mode — PvP and PvE have separate flea markets.
// One ~16MB fetch per mode from json.tarkov.dev, trimmed to price and
// trader-offer fields and cached in IndexedDB (user-triggered, never on load).
import type { GameMode } from '@raidplanner/data';
import type { ItemPrices } from './profit';

const DB_NAME = 'raidplanner-prices';
const STORE = 'prices';

export interface CachedPrices {
  fetchedAt: number;
  prices: ItemPrices;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadCachedPrices(mode: GameMode): Promise<CachedPrices | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openDb();
    const cached = await new Promise<CachedPrices | null>((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(`flea:${mode}`);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return cached;
  } catch {
    return null;
  }
}

async function saveCachedPrices(mode: GameMode, cached: CachedPrices): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(cached, `flea:${mode}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* cache is best-effort */
  }
}

interface RawTraderOffer {
  trader: string;
  priceRUB?: number;
  minTraderLevel?: number;
  taskUnlock?: unknown;
  buyLimit?: number;
}

interface RawItem {
  id: string;
  name?: string;
  iconLink?: string;
  avg24hPrice?: number;
  lastLowPrice?: number;
  basePrice?: number;
  buyFromTrader?: RawTraderOffer[];
  sellToTrader?: { trader: string; priceRUB?: number }[];
}

export async function fetchPrices(mode: GameMode): Promise<CachedPrices> {
  const prefix = mode === 'pve' ? 'pve' : 'regular';
  const get = async (path: string) => {
    const response = await fetch(`https://json.tarkov.dev/${path}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  };
  // names in the items payload are translation keys; the _en dict resolves them
  const [payload, en] = await Promise.all([
    get(`${prefix}/items`),
    get(`${prefix}/items_en`).catch(() => null),
  ]);
  const translate = (key: unknown): string | undefined =>
    typeof key === 'string' ? ((en?.data?.[key] as string | undefined) ?? undefined) : undefined;
  const prices: ItemPrices = {};
  for (const item of Object.values(payload.data.items) as RawItem[]) {
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
  const cached = { fetchedAt: Date.now(), prices };
  await saveCachedPrices(mode, cached);
  return cached;
}
