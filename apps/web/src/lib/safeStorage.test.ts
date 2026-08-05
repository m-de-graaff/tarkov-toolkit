// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidPersistedJson, safeLocalStorage } from './safeStorage';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('isValidPersistedJson', () => {
  it('accepts valid JSON, rejects null and garbage', () => {
    expect(isValidPersistedJson('{"a":1}')).toBe(true);
    expect(isValidPersistedJson(null)).toBe(false);
    expect(isValidPersistedJson('{invalid')).toBe(false);
  });
});

describe('safeLocalStorage', () => {
  it('round-trips values', () => {
    safeLocalStorage.setItem('k', '{"a":1}');
    expect(safeLocalStorage.getItem('k')).toBe('{"a":1}');
  });

  it('returns null for missing and for unparsable values', () => {
    expect(safeLocalStorage.getItem('missing')).toBeNull();
    localStorage.setItem('bad', '{invalid');
    expect(safeLocalStorage.getItem('bad')).toBeNull();
  });

  it('swallows setItem failures (quota) instead of throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => safeLocalStorage.setItem('k', '{}')).not.toThrow();
  });

  it('swallows getItem/removeItem failures', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(safeLocalStorage.getItem('k')).toBeNull();
    expect(() => safeLocalStorage.removeItem('k')).not.toThrow();
  });
});
