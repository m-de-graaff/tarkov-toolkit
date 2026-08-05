// @vitest-environment jsdom
import { snapshot } from '@raidplanner/data';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { objectivePoints } from '../lib/questIndex';
import type { MapMarker } from './MapCanvas';
import { MapCanvas } from './MapCanvas';

// Leaflet needs real element dimensions; jsdom reports 0x0, which leaflet
// tolerates for creation, markers, and overlays - enough for a smoke test.
describe('MapCanvas', () => {
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

  it('mounts a leaflet map with SVG overlay and objective markers', () => {
    const customs = snapshot.maps.find((m) => m.normalizedName === 'customs')!;
    const task = snapshot.tasks.find((t) => objectivePoints(t, customs.id).length > 0)!;
    const markers: MapMarker[] = objectivePoints(task, customs.id).flatMap(({ objective, points }) =>
      points.slice(0, 2).map((p) => ({
        id: p.id,
        position: p.position,
        label: objective.description,
        kind: 'objective' as const,
        taskName: task.name,
      })),
    );

    act(() => {
      root.render(<MapCanvas map={customs} markers={markers} route={null} />);
    });

    const canvas = container.querySelector('.map-canvas');
    expect(canvas?.classList.contains('leaflet-container')).toBe(true);
    // customs has a tile variant - the pretty tile layer is the base
    expect(container.querySelector('.map-tiles')).toBeTruthy();
    expect(container.querySelectorAll('.marker.objective').length).toBe(markers.length);
  });

  it('uses the bundled SVG overlay for svg-only maps', () => {
    const lighthouse = snapshot.maps.find((m) => m.normalizedName === 'lighthouse')!;
    act(() => {
      root.render(<MapCanvas map={lighthouse} markers={[]} route={null} />);
    });
    expect(
      container.querySelector(`img[src="/maps/${lighthouse.calibration!.svgFile}"]`),
    ).toBeTruthy();
  });
});
