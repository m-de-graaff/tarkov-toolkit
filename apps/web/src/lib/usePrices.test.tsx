// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CachedPrices } from './prices';
import { usePrices, type PricesState } from './usePrices';

vi.mock('./prices', () => ({
  loadCachedPrices: vi.fn(),
  fetchPrices: vi.fn(),
}));
// the hook skips auto-fetch under MODE === 'test'; these tests exist to pin
// the production policy, so force a non-test mode
vi.stubEnv('MODE', 'production');

import { fetchPrices, loadCachedPrices } from './prices';

const mockLoad = vi.mocked(loadCachedPrices);
const mockFetch = vi.mocked(fetchPrices);

const cachedAt = (fetchedAt: number): CachedPrices => ({
  formatVersion: 2,
  fetchedAt,
  prices: { item: { fleaAvg: 1, fleaLow: 1, basePrice: 1, bestTraderSell: 1 } },
});

function Harness({ onState }: { onState: (s: PricesState) => void }) {
  onState(usePrices());
  return null;
}

describe('usePrices fetch policy', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let latest: PricesState | null;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    latest = null;
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const mount = async () => {
    act(() => root.render(<Harness onState={(s) => (latest = s)} />));
    await act(async () => {});
  };

  it('does not fetch when a cache exists - even a stale one', async () => {
    const staleByHours = cachedAt(Date.now() - 6 * 60 * 60 * 1000);
    mockLoad.mockResolvedValue(staleByHours);
    await mount();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(latest!.cached).toEqual(staleByHours);
  });

  it('fetches once when no cache exists', async () => {
    mockLoad.mockResolvedValue(null);
    mockFetch.mockResolvedValue(cachedAt(Date.now()));
    await mount();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(latest!.cached).not.toBeNull();
  });

  it('manual refresh always fetches', async () => {
    mockLoad.mockResolvedValue(cachedAt(Date.now()));
    mockFetch.mockResolvedValue(cachedAt(Date.now() + 1));
    await mount();
    expect(mockFetch).not.toHaveBeenCalled();
    await act(async () => latest!.refresh());
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('surfaces a friendly error when the first fetch fails', async () => {
    mockLoad.mockResolvedValue(null);
    mockFetch.mockRejectedValue(new Error('offline'));
    await mount();
    expect(latest!.error).toContain('online');
    expect(latest!.loading).toBe(false);
  });
});
