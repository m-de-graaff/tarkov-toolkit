// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ItemIcon } from './ItemIcon';

// dev/test builds have no VITE_PRICES_TRIMMED, so the only source is iconLink

describe('ItemIcon', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders the icon as a decorative image', () => {
    act(() =>
      root.render(<ItemIcon iconLink="https://assets.example/abc-icon.webp" className="size-6" />),
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://assets.example/abc-icon.webp');
    expect(img?.getAttribute('alt')).toBe('');
  });

  it('renders nothing without any source', () => {
    act(() => root.render(<ItemIcon itemId="5ac3b934156ae10c4430e83c" />));
    expect(container.innerHTML).toBe('');
  });

  it('keeps a same-size decorative placeholder when every source fails', () => {
    act(() =>
      root.render(<ItemIcon iconLink="https://assets.example/broken.webp" className="size-6" />),
    );
    act(() => {
      container.querySelector('img')!.dispatchEvent(new Event('error'));
    });
    expect(container.querySelector('img')).toBeNull();
    const fallback = container.querySelector('span');
    expect(fallback?.className).toBe('size-6');
    expect(fallback?.getAttribute('aria-hidden')).toBe('true');
  });
});
