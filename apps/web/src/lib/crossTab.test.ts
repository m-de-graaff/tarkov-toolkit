// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startCrossTabSync } from './crossTab';
import { PROGRESS_KEY } from './storage';

const storageEvent = (key: string | null, newValue: string | null) =>
  new StorageEvent('storage', { key, newValue });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('startCrossTabSync', () => {
  it('rehydrates once after a burst of writes to the progress key', () => {
    const rehydrate = vi.fn();
    const stop = startCrossTabSync(rehydrate);
    window.dispatchEvent(storageEvent(PROGRESS_KEY, '{"a":1}'));
    window.dispatchEvent(storageEvent(PROGRESS_KEY, '{"a":2}'));
    expect(rehydrate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(rehydrate).toHaveBeenCalledTimes(1);
    stop();
  });

  it('ignores other keys and key removal', () => {
    const rehydrate = vi.fn();
    const stop = startCrossTabSync(rehydrate);
    window.dispatchEvent(storageEvent('other-key', '{}'));
    window.dispatchEvent(storageEvent(PROGRESS_KEY, null));
    vi.advanceTimersByTime(150);
    expect(rehydrate).not.toHaveBeenCalled();
    stop();
  });

  it('cleanup removes the listener', () => {
    const rehydrate = vi.fn();
    const stop = startCrossTabSync(rehydrate);
    stop();
    window.dispatchEvent(storageEvent(PROGRESS_KEY, '{}'));
    vi.advanceTimersByTime(150);
    expect(rehydrate).not.toHaveBeenCalled();
  });
});
