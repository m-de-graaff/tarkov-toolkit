// localStorage adapter for zustand persist that can't take the app down:
// corrupt values hydrate as "nothing stored" (the IndexedDB mirror gets a
// chance to repair them first, see storage.ts), and quota/security errors on
// write are swallowed - in-memory state stays correct and the mirror still
// captures it.
import type { StateStorage } from 'zustand/middleware';

export const isValidPersistedJson = (value: string | null): value is string => {
  if (value === null) return false;
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};

export const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      const value = localStorage.getItem(name);
      return isValidPersistedJson(value) ? value : null;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      /* quota exceeded or storage disabled - keep in-memory state */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};
