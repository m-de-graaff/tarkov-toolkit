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

  it('routes selected objectives from a spawn point', () => {
    const customs = snapshot.maps.find((m) => m.normalizedName === 'customs')!;
    const located = snapshot.tasks
      .filter((t) =>
        t.objectives.some((o) => o.points.some((p) => p.map === customs.id)),
      )
      .slice(0, 2);

    act(() => root.render(<App />));
    act(() => {
      usePlanner.getState().selectMap(customs.id);
      for (const t of located) usePlanner.getState().toggleTask(t.id);
      usePlanner.getState().setSpawn({ kind: 'custom', position: { x: 0, y: 0, z: 0 } });
    });

    expect(container.querySelectorAll('.route-steps li').length).toBeGreaterThan(0);
    expect(container.textContent).toMatch(/Total ≈ \d+m/);
    expect(container.querySelectorAll('.marker.spawn').length).toBe(1);
    // numbered objective markers follow the optimized order
    expect(container.querySelector('.marker.objective')?.textContent).toBe('1');
  });
});
