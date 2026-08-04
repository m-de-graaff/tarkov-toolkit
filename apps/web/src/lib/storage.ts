// Progress persistence: a proper local database (IndexedDB) instead of
// localStorage — larger quota, no synchronous main-thread writes, and the same
// storage shape the hosted sync (docs/auth-design.md) will push to a server DB.
// Falls back to localStorage where IndexedDB is unavailable (jsdom, ancient
// browsers). Existing localStorage state is imported once so nobody loses
// progress.
import type { StateStorage } from 'zustand/middleware';

const DB_NAME = 'raidplanner-state';
const STORE = 'kv';

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

async function idbRemove(key: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

const hasIdb = typeof indexedDB !== 'undefined';

export const progressStorage: StateStorage = {
  async getItem(key) {
    if (!hasIdb) return localStorage.getItem(key);
    try {
      const stored = await idbGet(key);
      if (stored !== null) return stored;
      // one-time import of pre-database progress
      const legacy = localStorage.getItem(key);
      if (legacy !== null) {
        await idbSet(key, legacy);
        return legacy;
      }
      return null;
    } catch {
      return localStorage.getItem(key);
    }
  },
  async setItem(key, value) {
    if (!hasIdb) {
      localStorage.setItem(key, value);
      return;
    }
    try {
      await idbSet(key, value);
    } catch {
      localStorage.setItem(key, value);
    }
  },
  async removeItem(key) {
    if (!hasIdb) {
      localStorage.removeItem(key);
      return;
    }
    try {
      await idbRemove(key);
    } catch {
      localStorage.removeItem(key);
    }
  },
};
