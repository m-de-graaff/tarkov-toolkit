// Routing on tile-only maps: the precomputed walkability masks must produce
// real detouring paths, not straight-line fallbacks. Decodes the shipped
// Labyrinth mask with pngjs (node side - the browser loader in maskNav.ts
// uses canvas instead) and runs the actual navigator over it.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { snapshot } from '@raidplanner/data';
import {
  cellOf,
  findPath,
  lineOfSight,
  makeNavigator,
  makeProjector,
  nearestWalkable,
  type NavGrid,
} from './navGrid';

const labyrinth = snapshot.maps.find((m) => m.normalizedName === 'the-labyrinth')!;

function loadMaskGrid(): NavGrid {
  const cal = labyrinth.calibration!;
  const file = path.resolve(__dirname, '../../public/nav', cal.navFile!);
  const png = PNG.sync.read(readFileSync(file));
  const cells = new Uint8Array(png.width * png.height);
  for (let i = 0; i < cells.length; i++) {
    cells[i] = png.data[i * 4 + 1] > 127 ? 1 : 0;
  }
  return {
    width: png.width,
    height: png.height,
    cells,
    projector: makeProjector(cal, png.width, png.height),
  };
}

describe('the-labyrinth mask routing', () => {
  it('ships a mask with maze structure (mostly blocked, some walkable)', () => {
    expect(labyrinth.calibration?.navFile).toBe('the-labyrinth.png');
    const grid = loadMaskGrid();
    const walkable = grid.cells.reduce((a, b) => a + b, 0) / grid.cells.length;
    expect(walkable).toBeGreaterThan(0.02);
    expect(walkable).toBeLessThan(0.6);
  });

  it('finds a real detouring path between a spawn and an extract', () => {
    const grid = loadMaskGrid();
    const spawn = labyrinth.spawns[0].position;
    const extract = labyrinth.extracts[0].position;

    const a = nearestWalkable(grid, cellOf(grid, spawn));
    const b = nearestWalkable(grid, cellOf(grid, extract));
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();

    // a maze: the straight segment must NOT be clear...
    expect(lineOfSight(grid, a!, b!)).toBe(false);
    // ...but A* must still connect the two through the corridors
    expect(findPath(grid, a!, b!)).not.toBeNull();

    const leg = makeNavigator(grid).leg(spawn, extract);
    expect(leg.direct).toBe(false);
    const straight = Math.hypot(spawn.x - extract.x, spawn.z - extract.z);
    expect(leg.distance).toBeGreaterThan(straight);
  });
});
