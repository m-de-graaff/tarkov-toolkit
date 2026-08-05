import type { MapCalibration } from '@raidplanner/data';
import { describe, expect, it } from 'vitest';
import type { NavGrid } from './navGrid';
import {
  cellOf,
  findPath,
  lineOfSight,
  makeMultiNavigator,
  makeNavigator,
  makeProjector,
  nearestWalkable,
  smoothPath,
} from './navGrid';

/** Build a grid from ascii art: '.' walkable, '#' blocked, 'S' walkable stair. */
function gridFrom(rows: string[], cal?: MapCalibration): NavGrid {
  const height = rows.length;
  const width = rows[0].length;
  const cells = new Uint8Array(width * height);
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x++) cells[y * width + x] = row[x] === '#' ? 0 : 1;
  });
  const calibration: MapCalibration = cal ?? {
    // identity-ish: game x -> px, game z -> -py; bounds cover the grid exactly
    transform: [1, 0, 1, 0],
    coordinateRotation: 0,
    bounds: [
      [0, 0],
      [width, -height],
    ],
  };
  return { width, height, cells, projector: makeProjector(calibration, width, height) };
}

/** LevelGrid from ascii art; 'S' cells also land in the stair mask. */
function levelFrom(rows: string[], heightRange?: [number, number]) {
  const grid = gridFrom(rows);
  const stairs = new Uint8Array(grid.cells.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < grid.width; x++) if (row[x] === 'S') stairs[y * grid.width + x] = 1;
  });
  return { grid, stairs, heightRange };
}

describe('makeProjector', () => {
  const cal: MapCalibration = {
    transform: [2, 10, 2, 40],
    coordinateRotation: 90,
    bounds: [
      [-50, -50],
      [50, 50],
    ],
  };

  it('roundtrips game -> cell -> game', () => {
    const proj = makeProjector(cal, 200, 200);
    const p = { x: 12.5, y: 0, z: -30 };
    const [cx, cy] = proj.toCell(p);
    const back = proj.toGame(cx, cy);
    expect(back.x).toBeCloseTo(p.x, 6);
    expect(back.z).toBeCloseTo(p.z, 6);
  });

  it('maps the bounds corners onto the raster corners', () => {
    const simple: MapCalibration = {
      transform: [1, 0, 1, 0],
      coordinateRotation: 0,
      bounds: [
        [0, 0],
        [100, -50],
      ],
    };
    const proj = makeProjector(simple, 200, 100);
    // game (0, 0): px = 0, py = 0 -> cell (0, 0)
    expect(proj.toCell({ x: 0, y: 0, z: 0 })).toEqual([0, 0]);
    // game (100, -50): px = 100, py = 50 -> cell (200, 100)
    expect(proj.toCell({ x: 100, y: 0, z: -50 })).toEqual([200, 100]);
  });
});

describe('findPath', () => {
  it('routes around a wall instead of through it', () => {
    const grid = gridFrom([
      '.....',
      '.###.',
      '.#.#.',
      '.###.',
      '.....',
    ]);
    const path = findPath(grid, [0, 2], [4, 2])!;
    expect(path).not.toBeNull();
    // must not pass through any blocked cell
    for (const [x, y] of path) expect(grid.cells[y * grid.width + x]).toBe(1);
    // and must be longer than the straight line it cannot take
    expect(path.length).toBeGreaterThan(5);
  });

  it('returns null when the goal is walled off', () => {
    const grid = gridFrom([
      '.....',
      '.###.',
      '.#.#.',
      '.###.',
      '.....',
    ]);
    expect(findPath(grid, [0, 0], [2, 2])).toBeNull();
  });

  it('does not cut corners diagonally between two blocked cells', () => {
    const grid = gridFrom([
      '.#',
      '#.',
    ]);
    expect(findPath(grid, [0, 0], [1, 1])).toBeNull();
  });
});

describe('lineOfSight', () => {
  const grid = gridFrom([
    '...#...',
    '...#...',
    '.......',
  ]);
  it('blocked through the wall, clear through the gap', () => {
    expect(lineOfSight(grid, [0, 0], [6, 0])).toBe(false);
    expect(lineOfSight(grid, [0, 2], [6, 2])).toBe(true);
  });
});

describe('smoothPath', () => {
  it('collapses a dog-legged grid path to its visible corners', () => {
    const grid = gridFrom([
      '....',
      '###.',
      '....',
    ]);
    const path = findPath(grid, [0, 0], [0, 2])!;
    const smoothed = smoothPath(grid, path);
    expect(smoothed.length).toBeLessThan(path.length);
    expect(smoothed[0]).toEqual([0, 0]);
    expect(smoothed.at(-1)).toEqual([0, 2]);
    // every kept segment must still be walkable
    for (let i = 1; i < smoothed.length; i++) {
      expect(lineOfSight(grid, smoothed[i - 1], smoothed[i])).toBe(true);
    }
  });
});

describe('nearestWalkable', () => {
  it('finds the closest open cell around a blocked one', () => {
    const grid = gridFrom([
      '###',
      '#.#',
      '###',
    ]);
    expect(nearestWalkable(grid, [0, 0])).toEqual([1, 1]);
    expect(nearestWalkable(grid, [1, 1])).toEqual([1, 1]);
  });

  it('gives up beyond maxRadius', () => {
    const grid = gridFrom(['###', '###', '###']);
    expect(nearestWalkable(grid, [1, 1], 5)).toBeNull();
  });
});

describe('makeNavigator', () => {
  it('legs walk around water and measure the walked distance', () => {
    // a "river" splitting the map, with a gap (bridge) at the bottom
    const grid = gridFrom([
      '..#..',
      '..#..',
      '..#..',
      '.....',
    ]);
    const nav = makeNavigator(grid);
    const a = { x: 0.5, y: 0, z: -0.5 };
    const b = { x: 4.5, y: 0, z: -0.5 };
    const leg = nav.leg(a, b);
    expect(leg.direct).toBe(false);
    // must detour down to the gap and back: clearly longer than the straight 4
    expect(leg.distance).toBeGreaterThan(6);
    expect(leg.distance).toBeLessThan(9);
    expect(leg.points[0]).toEqual(a);
    expect(leg.points.at(-1)).toEqual(b);
  });

  it('falls back to the straight line when endpoints are disconnected', () => {
    const grid = gridFrom([
      '..#..',
      '..#..',
      '..#..',
      '..#..',
    ]);
    const nav = makeNavigator(grid);
    const leg = nav.leg({ x: 0.5, y: 0, z: -0.5 }, { x: 4.5, y: 0, z: -0.5 });
    expect(leg.direct).toBe(true);
    expect(leg.distance).toBeCloseTo(4);
  });

  it('snaps endpoints inside blocked areas to the nearest walkable cell', () => {
    const grid = gridFrom([
      '.....',
      '.###.',
      '.....',
    ]);
    const nav = makeNavigator(grid);
    // endpoint dead-center in the blocked block
    const leg = nav.leg({ x: 2, y: 0, z: -1 }, { x: 0.5, y: 0, z: -0.5 });
    expect(leg.direct).toBe(false);
  });
});

describe('makeMultiNavigator', () => {
  // base: open field; upper floor: everything blocked except one corridor row
  const base = gridFrom(['.....', '.....', '.....']);
  const upper = gridFrom(['#####', '.....', '#####']);

  it('routes on the level matching the endpoints height', () => {
    const nav = makeMultiNavigator({ grid: base, heightRange: [-1, 3] }, [
      { grid: upper, heightRange: [3, 6] },
    ]);
    // both on the upper floor (y = 4): must use the corridor grid
    const upstairs = nav.leg({ x: 0.5, y: 4, z: -1.5 }, { x: 4.5, y: 4, z: -1.5 });
    expect(upstairs.direct).toBe(false);
    // both on the ground floor (y = 0): open field, direct-ish path
    const ground = nav.leg({ x: 0.5, y: 0, z: -0.5 }, { x: 4.5, y: 0, z: -0.5 });
    expect(ground.direct).toBe(false);
  });

  it('falls back to a straight line across levels sharing no walkable overlap', () => {
    const west = gridFrom(['..###', '..###', '..###']);
    const east = gridFrom(['###..', '###..', '###..']);
    const nav = makeMultiNavigator({ grid: west, heightRange: [-1, 3] }, [
      { grid: east, heightRange: [3, 6] },
    ]);
    const cross = nav.leg({ x: 0.5, y: 0, z: -0.5 }, { x: 4.5, y: 4, z: -0.5 });
    expect(cross.direct).toBe(true);
  });

  it('connects stairless levels at footprint-boundary overlap (garage ramp)', () => {
    // garage under the plaza: entrance where both are walkable at the garage edge
    const plaza = levelFrom(['.....', '.....', '.....'], [0, 100]);
    const garage = levelFrom(['##...', '#####', '#####'], [-100, 0]);
    const nav = makeMultiNavigator(plaza, [garage]);
    const leg = nav.leg({ x: 0.5, y: 5, z: -2.5 }, { x: 2.4, y: -5, z: -0.4 });
    expect(leg.direct).toBe(false);
  });

  it('routes across levels through a shared stairway', () => {
    // stair at the right end (x=4): walkable on both floors, marked S upstairs
    const ground = levelFrom(['.....', '.....', '.....'], [-1, 3]);
    const second = levelFrom(['####S', '#####', '#####'], [3, 6]);
    const nav = makeMultiNavigator(ground, [second]);
    // from ground far left to the upper stair landing
    const leg = nav.leg({ x: 0.5, y: 0, z: -1.5 }, { x: 4.4, y: 4, z: -0.4 });
    expect(leg.direct).toBe(false);
    // must pass through the stair cell area (x near 4)
    expect(leg.distance).toBeGreaterThan(3.5);
    expect(leg.points.length).toBeGreaterThan(2);
  });

  it('chains through the base when two upper floors share no stair', () => {
    const ground = levelFrom(['S...s'.replace('s', 'S'), '.....'], [-10, 0]);
    const second = levelFrom(['S####', '#####'], [0, 5]);
    const third = levelFrom(['####S', '#####'], [5, 10]);
    const nav = makeMultiNavigator(ground, [second, third]);
    const leg = nav.leg({ x: 0.4, y: 2, z: -0.4 }, { x: 4.4, y: 7, z: -0.4 });
    expect(leg.direct).toBe(false);
    // down at x=0, across the ground, up at x=4: longer than the euclid 4.0
    expect(leg.distance).toBeGreaterThan(4.4);
  });

  it('layer height without nearby layer content resolves to the base grid', () => {
    // "2nd floor" height, but the floor is not drawn anywhere near: terrain
    // at that elevation is still ground level
    const emptyUpper = gridFrom(['#####', '#####', '#####']);
    const nav = makeMultiNavigator({ grid: base, heightRange: [-1000, -1] }, [
      { grid: emptyUpper, heightRange: [-1, 2] },
    ]);
    const leg = nav.leg({ x: 0.5, y: 0, z: -0.5 }, { x: 4.5, y: 0, z: -0.5 });
    expect(leg.direct).toBe(false);
  });

  it('heights outside every layer resolve to the base grid', () => {
    const nav = makeMultiNavigator({ grid: base }, [{ grid: upper, heightRange: [3, 6] }]);
    const leg = nav.leg({ x: 0.5, y: 40, z: -0.5 }, { x: 4.5, y: 40, z: -0.5 });
    expect(leg.direct).toBe(false);
  });
});

describe('cellOf', () => {
  it('clamps out-of-bounds positions onto the grid', () => {
    const grid = gridFrom(['...', '...']);
    expect(cellOf(grid, { x: -100, y: 0, z: 100 })).toEqual([0, 0]);
    expect(cellOf(grid, { x: 100, y: 0, z: -100 })).toEqual([2, 1]);
  });
});

describe('makeProjector against real map calibrations', () => {
  it('projects nearly all player spawns inside the raster on every SVG map', async () => {
    const { snapshot } = await import('@raidplanner/data');
    const svgMaps = snapshot.maps.filter((m) => m.calibration?.svgFile && m.spawns.length > 0);
    expect(svgMaps.length).toBeGreaterThan(5);
    for (const map of svgMaps) {
      const proj = makeProjector(map.calibration!, 900, 900);
      let inside = 0;
      for (const spawn of map.spawns) {
        const [cx, cy] = proj.toCell(spawn.position);
        if (cx >= 0 && cx <= 900 && cy >= 0 && cy <= 900) inside++;
      }
      // spawn data is community-sourced; allow a straggler or two off the edge
      expect(inside / map.spawns.length, map.name).toBeGreaterThan(0.9);
    }
  });
});
