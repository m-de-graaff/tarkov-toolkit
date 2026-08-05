// Live prices per game mode - PvP and PvE have separate flea markets.
// One ~16MB fetch per mode from json.tarkov.dev, trimmed to price and
// trader-offer fields and cached in IndexedDB (user-triggered, never on load).
import type { GameMode } from '@raidplanner/data';
import type { ItemPrices } from './profit';

const DB_NAME = 'raidplanner-prices';
const STORE = 'prices';

/** bump when ItemPriceEntry gains fields - old caches are discarded and refetched */
export const PRICES_FORMAT_VERSION = 2;

export interface CachedPrices {
  formatVersion?: number;
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
    // caches written before a format bump lack fields the UI needs (e.g. item
    // names) - treat them as absent so the page fetches fresh data right away
    if (cached && cached.formatVersion !== PRICES_FORMAT_VERSION) return null;
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

/** Deployments point this at a caching proxy (see apps/proxy); default hits
 * json.tarkov.dev directly, which works for self-hosting and local dev. */
const PRICES_BASE: string =
  (import.meta.env?.VITE_PRICES_BASE as string | undefined) || 'https://json.tarkov.dev';

export async function fetchPrices(mode: GameMode): Promise<CachedPrices> {
  const prefix = mode === 'pve' ? 'pve' : 'regular';
  const get = async (path: string) => {
    const response = await fetch(`${PRICES_BASE}/${path}`, {
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
  const prices = buildPrices(payload.data.items, en?.data ?? {});
  const cached: CachedPrices = {
    formatVersion: PRICES_FORMAT_VERSION,
    fetchedAt: Date.now(),
    prices,
  };
  await saveCachedPrices(mode, cached);
  return cached;
}

/** pure extraction from the raw items payload - unit-testable */
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
