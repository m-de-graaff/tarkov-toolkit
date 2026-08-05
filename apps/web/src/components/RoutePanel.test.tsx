// @vitest-environment jsdom
import { snapshot } from '@raidplanner/data';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PlannedRoute } from '../lib/route';
import { RoutePanel } from './RoutePanel';

const [knownItemId, knownItem] = Object.entries(snapshot.itemsLite)[0];

const route: PlannedRoute = {
  stops: [
    {
      taskId: 't1',
      taskName: 'Delivery from the past',
      objectiveId: 'o1',
      description: 'Stash the case',
      position: { x: 0, y: 0, z: 0 },
      neededItems: { itemIds: [knownItemId, 'alt-id'], count: 2, foundInRaid: true },
    },
    {
      taskId: 't2',
      taskName: 'Debut',
      objectiveId: 'o2',
      description: 'Eliminate scavs',
      position: { x: 10, y: 0, z: 10 },
    },
  ],
  legs: [
    { points: [{ x: 0, y: 0, z: -10 }, { x: 0, y: 0, z: 0 }], distance: 10, direct: false },
    { points: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 10 }], distance: 15, direct: true },
  ],
  totalDistance: 25,
};

describe('RoutePanel', () => {
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

  it('shows needed items with count and FIR only on stops that have them', async () => {
    await act(async () =>
      root.render(
        <RoutePanel
          route={route}
          originPosition={{ x: 0, y: 0, z: -10 }}
          originLabel="spawn"
          hasSelection
        />,
      ),
    );
    expect(container.textContent).toContain(knownItem.name);
    expect(container.textContent).toContain('2×');
    expect(container.textContent).toContain('FIR');
    const rows = container.querySelectorAll('.route-steps > li');
    expect(rows[0].querySelector('.stop-items')).not.toBeNull();
    expect(rows[1].querySelector('.stop-items')).toBeNull();
  });
});
