// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROGRESS_KEY, restoreProgressFromMirror, startProgressMirror } from './storage';

const GOOD = JSON.stringify({ state: { tracker: { level: 20 } }, version: 3 });
const OTHER = JSON.stringify({ state: { tracker: { level: 5 } }, version: 3 });

// write straight to the mirror the same way storage.ts does
async function seedMirror(value: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('raidplanner-state', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('kv');
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, PROGRESS_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

async function readMirror(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('raidplanner-state', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('kv');
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction('kv', 'readonly').objectStore('kv').get(PROGRESS_KEY);
      get.onsuccess = () => {
        db.close();
        resolve((get.result as string | undefined) ?? null);
      };
      get.onerror = () => reject(get.error);
    };
    request.onerror = () => reject(request.error);
  });
}

beforeEach(() => {
  localStorage.clear();
  // fresh IndexedDB per test
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('restoreProgressFromMirror', () => {
  it('restores when localStorage is missing', async () => {
    await seedMirror(GOOD);
    await restoreProgressFromMirror();
    expect(localStorage.getItem(PROGRESS_KEY)).toBe(GOOD);
  });

  it('restores over a corrupt localStorage value', async () => {
    localStorage.setItem(PROGRESS_KEY, '{truncated');
    await seedMirror(GOOD);
    await restoreProgressFromMirror();
    expect(localStorage.getItem(PROGRESS_KEY)).toBe(GOOD);
  });

  it('leaves a valid localStorage value alone', async () => {
    localStorage.setItem(PROGRESS_KEY, GOOD);
    await seedMirror(OTHER);
    await restoreProgressFromMirror();
    expect(localStorage.getItem(PROGRESS_KEY)).toBe(GOOD);
  });

  it('does not restore a corrupt mirror value', async () => {
    localStorage.setItem(PROGRESS_KEY, '{truncated');
    await seedMirror('also{corrupt');
    await restoreProgressFromMirror();
    // corrupt local value stays; safeStorage hydration treats it as absent
    expect(localStorage.getItem(PROGRESS_KEY)).toBe('{truncated');
  });
});

describe('startProgressMirror', () => {
  it('never flushes a corrupt localStorage value over the mirror', async () => {
    await seedMirror(GOOD);
    let notify: () => void = () => {};
    const stop = startProgressMirror((listener) => {
      notify = listener;
      return () => {};
    });
    localStorage.setItem(PROGRESS_KEY, '{truncated');
    // fake timers only around the debounce - fake-indexeddb itself needs
    // real timers to complete its transactions
    vi.useFakeTimers();
    notify();
    vi.advanceTimersByTime(1100);
    vi.useRealTimers();
    // flush is fire-and-forget; give a would-be idb put a tick to (not) land
    await new Promise((r) => setTimeout(r, 20));
    expect(await readMirror()).toBe(GOOD);
    stop();
  });

  it('flushes immediately on pagehide', async () => {
    const stop = startProgressMirror(() => () => {});
    localStorage.setItem(PROGRESS_KEY, GOOD);
    window.dispatchEvent(new Event('pagehide'));
    await new Promise((r) => setTimeout(r, 20));
    expect(await readMirror()).toBe(GOOD);
    stop();
  });

  it('flushes when the tab becomes hidden', async () => {
    const stop = startProgressMirror(() => () => {});
    localStorage.setItem(PROGRESS_KEY, GOOD);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 20));
    expect(await readMirror()).toBe(GOOD);
    stop();
  });
});
