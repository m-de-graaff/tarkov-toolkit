// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

let shouldThrow = true;
function Bomb() {
  if (shouldThrow) throw new Error('boom');
  return <p>recovered</p>;
}

describe('ErrorBoundary', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    shouldThrow = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders the fallback when a child throws, and the child otherwise', () => {
    act(() =>
      root.render(
        <ErrorBoundary resetKey="/a">
          <Bomb />
        </ErrorBoundary>,
      ),
    );
    expect(container.textContent).toContain('Something went wrong');
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
  });

  it('"Try again" re-renders the children', () => {
    act(() =>
      root.render(
        <ErrorBoundary resetKey="/a">
          <Bomb />
        </ErrorBoundary>,
      ),
    );
    shouldThrow = false;
    const tryAgain = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Try again'),
    )!;
    act(() => tryAgain.click());
    expect(container.textContent).toContain('recovered');
  });

  it('navigating (resetKey change) clears the error state', () => {
    act(() =>
      root.render(
        <ErrorBoundary resetKey="/a">
          <Bomb />
        </ErrorBoundary>,
      ),
    );
    expect(container.textContent).toContain('Something went wrong');
    shouldThrow = false;
    act(() =>
      root.render(
        <ErrorBoundary resetKey="/b">
          <Bomb />
        </ErrorBoundary>,
      ),
    );
    expect(container.textContent).toContain('recovered');
  });
});
