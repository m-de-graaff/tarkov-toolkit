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
    window.history.pushState({}, '', '/planner');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('every route mounts with visible content and the nav intact', () => {
    const routes = ['/', '/planner', '/progress', '/hideout', '/items', '/ammo', '/market', '/xp'];
    for (const path of routes) {
      window.history.pushState({}, '', path);
      act(() => root.render(<App />));
      expect(container.textContent, path).toBeTruthy();
      expect(container.querySelector('nav'), path).toBeTruthy();
      act(() => root.unmount());
      root = createRoot(container);
    }
  });

  it('redirects / to the planner', () => {
    window.history.pushState({}, '', '/');
    act(() => root.render(<App />));
    expect(window.location.pathname).toBe('/planner');
    expect(container.textContent).toContain('Select a map to begin planning.');
  });

  it('shows quests for the selected map and marks selected objectives on it', () => {
    const customs = snapshot.maps.find((m) => m.normalizedName === 'customs')!;

    act(() => root.render(<App />));
    expect(container.textContent).toContain('Select a map to begin planning.');

    // fresh profiles start at level 1 with every chain unfinished; open a
    // customs-locked quest the way the game would - level up and finish its
    // prerequisites (availability now mirrors in-game gating exactly)
    const mapQuest = snapshot.tasks.find(
      (t) =>
        t.mapId === customs.id &&
        t.minPlayerLevel <= 15 &&
        (t.loyaltyLevel ?? 1) <= 1 &&
        !t.storyChapter &&
        t.modes.includes('pvp'),
    )!;
    act(() => {
      usePlanner.getState().setLevel(15);
      for (const req of mapQuest.taskRequirements) {
        usePlanner.getState().toggleCompleted(req.taskId);
      }
    });
    act(() => usePlanner.getState().selectMap(customs.id));
    const rows = container.querySelectorAll('.quest-row');
    expect(rows.length).toBeGreaterThan(10);
    expect(container.querySelectorAll('.badge-map').length).toBeGreaterThan(0);

    // pick the first selectable quest that has located objectives on customs
    const checkbox = [...container.querySelectorAll<HTMLInputElement>('.quest-row input[type=checkbox]')][0];
    act(() => checkbox.click());
    expect(usePlanner.getState().selectedTaskIds).toHaveLength(1);
  });

  it('toggles the extracts and transits overlay on the planner map', () => {
    const customs = snapshot.maps.find((m) => m.normalizedName === 'customs')!;
    act(() => root.render(<App />));
    act(() => usePlanner.getState().selectMap(customs.id));

    // the overlay is on by default: every extract and transit is marked
    expect(container.querySelectorAll('.marker.transit').length).toBe(
      (customs.transits ?? []).length,
    );
    expect(container.querySelectorAll('.marker.extract').length).toBe(
      customs.extracts.length,
    );

    const toggle = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Extracts & transits',
    )!;
    act(() => toggle.click());
    expect(container.querySelectorAll('.marker.transit').length).toBe(0);
    expect(container.querySelectorAll('.marker.extract').length).toBe(0);
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

  it('routes from the live position, overriding the spawn', () => {
    const customs = snapshot.maps.find((m) => m.normalizedName === 'customs')!;
    const located = snapshot.tasks
      .filter((t) => t.objectives.some((o) => o.points.some((p) => p.map === customs.id)))
      .slice(0, 2);

    act(() => root.render(<App />));
    act(() => {
      usePlanner.getState().selectMap(customs.id);
      for (const t of located) usePlanner.getState().toggleTask(t.id);
      usePlanner.getState().setLiveFix({
        position: { x: 180, y: 0, z: 160 },
        yawDeg: 90,
        takenAt: '2026-08-04[21-40]',
        raw: 'x (0).png',
      });
    });

    // route exists without any spawn, marked as originating from the live fix
    expect(container.querySelectorAll('.route-steps li').length).toBeGreaterThan(0);
    expect(container.textContent).toContain('live position');
    expect(container.querySelectorAll('.marker.player').length).toBe(1);

    // a click while live overrides the origin (planning ahead of your position)
    act(() =>
      usePlanner.getState().setSpawn({ kind: 'custom', position: { x: -300, y: 0, z: -300 } }),
    );
    expect(container.textContent).not.toContain('live position');
    expect(container.textContent).toContain('Manual origin · back to live');

    // the next screenshot reclaims the origin for the live fix
    act(() =>
      usePlanner.getState().setLiveFix({
        position: { x: 200, y: 0, z: 180 },
        yawDeg: 45,
        takenAt: '2026-08-04[21-41]',
        raw: 'y (0).png',
      }),
    );
    expect(container.textContent).toContain('live position');
  });
});
