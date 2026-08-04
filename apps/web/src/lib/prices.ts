// Live flea prices — the market page's runtime data. One ~16MB fetch from
// json.tarkov.dev, trimmed to price fields and cached in IndexedDB so it's a
// deliberate, user-triggered download, not a page-load cost.
import type { ItemPrices } from './profit';

const PRICES_URL = 'https://json.tarkov.dev/regular/items';
const DB_NAME = 'raidplanner';
const STORE = 'prices';
const KEY = 'flea';

export interface CachedPrices {
  fetchedAt: number;
  prices: ItemPrices;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`${DB_NAME}-prices`, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadCachedPrices(): Promise<CachedPrices | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openDb();
    const cached = await new Promise<CachedPrices | null>((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return cached;
  } catch {
    return null;
  }
}

async function saveCachedPrices(cached: CachedPrices): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(cached, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* cache is best-effort */
  }
}

interface RawItem {
  id: string;
  avg24hPrice?: number;
  lastLowPrice?: number;
  basePrice?: number;
}

export async function fetchPrices(): Promise<CachedPrices> {
  const response = await fetch(PRICES_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const prices: ItemPrices = {};
  for (const item of Object.values(payload.data.items) as RawItem[]) {
    prices[item.id] = {
      fleaAvg: item.avg24hPrice ?? 0,
      fleaLow: item.lastLowPrice ?? 0,
      basePrice: item.basePrice ?? 0,
    };
  }
  const cached = { fetchedAt: Date.now(), prices };
  await saveCachedPrices(cached);
  return cached;
}
