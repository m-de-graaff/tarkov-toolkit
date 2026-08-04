// @vitest-environment jsdom
import { snapshot } from '@raidplanner/data';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { usePlanner } from './store';

const initial = usePlanner.getState();

describe('App', () => {
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

  it('shows quests for the selected map and marks selected objectives on it', () => {
    const customs = snapshot.maps.find((m) => m.normalizedName === 'customs')!;

    act(() => root.render(<App />));
    expect(container.textContent).toContain('Select a map to begin planning.');

    act(() => usePlanner.getState().selectMap(customs.id));
    const rows = container.querySelectorAll('.quest-row');
    expect(rows.length).toBeGreaterThan(10);
    expect(container.querySelectorAll('.badge-map').length).toBeGreaterThan(0);

    // pick the first selectable quest that has located objectives on customs
    const checkbox = [...container.querySelectorAll<HTMLInputElement>('.quest-row input[type=checkbox]')][0];
    act(() => checkbox.click());
    expect(usePlanner.getState().selectedTaskIds).toHaveLength(1);
  });
});
