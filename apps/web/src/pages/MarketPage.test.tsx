// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CachedPrices } from '../lib/prices';
import { MarketPage } from './MarketPage';

vi.mock('../lib/prices', () => ({
  loadCachedPrices: vi.fn(),
  fetchPrices: vi.fn(),
}));

import { loadCachedPrices } from '../lib/prices';

const mockLoad = vi.mocked(loadCachedPrices);

describe('MarketPage price states', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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
    act(() => root.render(<MarketPage />));
    await act(async () => {});
  };

  it('without prices it offers a load action instead of a stuck spinner', async () => {
    mockLoad.mockResolvedValue(null);
    await mount();
    expect(container.textContent).not.toContain('Fetching');
    expect(container.textContent).toContain('not loaded');
    const load = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Load prices'),
    );
    expect(load).toBeTruthy();
  });

  it('a filter that matches nothing says so instead of a blank table', async () => {
    const empty: CachedPrices = { formatVersion: 2, fetchedAt: Date.now(), prices: {} };
    mockLoad.mockResolvedValue(empty);
    await mount();
    // barters tab is default; zero rows must render the empty message
    expect(container.textContent).toContain('Nothing profitable in this category');
  });
});
