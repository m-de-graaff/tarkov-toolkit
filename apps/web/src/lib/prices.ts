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
  avg24hPrice?: number;
  lastLowPrice?: number;
  basePrice?: number;
  buyFromTrader?: RawTraderOffer[];
  sellToTrader?: { trader: string; priceRUB?: number }[];
}

export async function fetchPrices(mode: GameMode): Promise<CachedPrices> {
  const prefix = mode === 'pve' ? 'pve' : 'regular';
  const response = await fetch(`https://json.tarkov.dev/${prefix}/items`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const prices: ItemPrices = {};
  for (const item of Object.values(payload.data.items) as RawItem[]) {
    const bestTraderSell = Math.max(
      0,
      ...(item.sellToTrader ?? []).map((offer) => offer.priceRUB ?? 0),
    );
    const offers = (item.buyFromTrader ?? [])
      .filter((offer) => (offer.priceRUB ?? 0) > 0)
      .map((offer) => ({
        traderId: offer.trader,
        priceRUB: offer.priceRUB ?? 0,
        minTraderLevel: offer.minTraderLevel ?? 1,
        buyLimit: offer.buyLimit ?? 0,
        taskLocked: offer.taskUnlock != null,
      }));
    prices[item.id] = {
      fleaAvg: item.avg24hPrice ?? 0,
      fleaLow: item.lastLowPrice ?? 0,
      basePrice: item.basePrice ?? 0,
      bestTraderSell,
      ...(offers.length > 0 ? { offers } : {}),
    };
  }
  const cached = { fetchedAt: Date.now(), prices };
  await saveCachedPrices(mode, cached);
  return cached;
}
