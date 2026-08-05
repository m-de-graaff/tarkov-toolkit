// Progress durability: localStorage stays the synchronous hot store (zustand
// persist default - proven, no async render races), and IndexedDB mirrors it
// as the durable database copy. On boot, a missing localStorage key is
// restored from the mirror - so clearing site data selectively, browser
// eviction of localStorage, or a future export/import path can't lose
// progress. The mirrored value is also the sync unit for the hosted version
// (docs/auth-design.md).
export const PROGRESS_KEY = 'raidplanner-v1';

const DB_NAME = 'raidplanner-state';
const STORE = 'kv';

const hasIdb = typeof indexedDB !== 'undefined';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Boot step: restore localStorage from the mirror when it's missing. */
export async function restoreProgressFromMirror(): Promise<void> {
  if (!hasIdb) return;
  try {
    if (localStorage.getItem(PROGRESS_KEY) !== null) return;
    const mirrored = await idbGet(PROGRESS_KEY);
    if (mirrored !== null) localStorage.setItem(PROGRESS_KEY, mirrored);
  } catch {
    /* mirror unavailable - localStorage remains authoritative */
  }
}

/**
 * Keep the mirror in sync: debounced write of the persisted value after store
 * changes. Call once at app start with the store's subscribe function.
 */
export function startProgressMirror(subscribe: (listener: () => void) => () => void): () => void {
  if (!hasIdb) return () => {};
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    const value = localStorage.getItem(PROGRESS_KEY);
    if (value !== null) void idbSet(PROGRESS_KEY, value).catch(() => {});
  };
  const unsubscribe = subscribe(() => {
    if (timer) clearTimeout(timer);
    // zustand persist writes localStorage synchronously in the same tick;
    // debounce mirrors bursts of changes as one write
    timer = setTimeout(flush, 1000);
  });
  const onUnload = () => flush();
  window.addEventListener('beforeunload', onUnload);
  return () => {
    if (timer) clearTimeout(timer);
    window.removeEventListener('beforeunload', onUnload);
    unsubscribe();
  };
}
