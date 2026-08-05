// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';

describe('NotFoundPage', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders inside the shell for unknown paths, with a way out', () => {
    window.history.pushState({}, '', '/no-such-page');
    act(() => root.render(<App />));
    expect(container.textContent).toContain('Page not found');
    expect(container.textContent).toContain('/no-such-page');
    // the nav survives so the user isn't stranded
    expect(container.querySelector('a[href="/planner"]')).toBeTruthy();
  });
});
