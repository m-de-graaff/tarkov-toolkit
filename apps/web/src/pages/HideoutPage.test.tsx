// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { usePlanner } from '../store';
import { HideoutPage } from './HideoutPage';

const initial = usePlanner.getState();

describe('HideoutPage', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    usePlanner.setState(initial, true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders without looping when the tracker predates hideoutLevels', () => {
    // simulate state persisted before the hideout feature: no hideoutLevels key
    usePlanner.setState((s) => ({
      tracker: { level: s.tracker.level, faction: s.tracker.faction, completedTaskIds: [] },
    }));
    expect(usePlanner.getState().tracker.hideoutLevels).toBeUndefined();

    // an unstable selector snapshot makes this render loop until React throws
    act(() => root.render(<HideoutPage />));
    expect(container.querySelectorAll('.hideout-station').length).toBeGreaterThan(20);
  });

  it('level controls update the aggregate count', () => {
    act(() => root.render(<HideoutPage />));
    const plus = container.querySelector<HTMLButtonElement>('button[aria-label^="Raise"]')!;
    act(() => plus.click());
    const station = usePlanner.getState().tracker.hideoutLevels ?? {};
    expect(Object.values(station).some((level) => level === 1)).toBe(true);
  });
});
