import type { GamePosition } from '@raidplanner/data';
import { describe, expect, it } from 'vitest';
import { distance2d } from './geometry';
import type { RouteStop } from './route';
import { optimizeRoute } from './route';

const at = (x: number, z: number): GamePosition => ({ x, y: 0, z });

const stop = (id: string, x: number, z: number): RouteStop => ({
  taskId: `task-${id}`,
  taskName: `Task ${id}`,
  objectiveId: id,
  description: `Objective ${id}`,
  position: at(x, z),
});

function pathLength(start: GamePosition, stops: RouteStop[]): number {
  let total = 0;
  let prev = start;
  for (const s of stops) {
    total += distance2d(prev, s.position);
    prev = s.position;
  }
  return total;
}

function* permutations<T>(items: T[]): Generator<T[]> {
  if (items.length <= 1) {
    yield items;
    return;
  }
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const perm of permutations(rest)) {
      yield [items[i], ...perm];
    }
  }
}

describe('optimizeRoute', () => {
  it('orders collinear stops by distance from start', () => {
    const shuffled = [stop('c', 20, 0), stop('a', 0, 0), stop('d', 30, 0), stop('b', 10, 0)];
    const route = optimizeRoute(at(0, 0), shuffled);
    expect(route.stops.map((s) => s.objectiveId)).toEqual(['a', 'b', 'c', 'd']);
    expect(route.totalDistance).toBeCloseTo(30);
  });

  it('matches the brute-force optimum on a crossing configuration', () => {
    const start = at(0, 0);
    const stops = [stop('n', 0, 10), stop('e', 10, 0), stop('ne', 10, 10), stop('n2', 0, 11)];
    let best = Infinity;
    for (const perm of permutations(stops)) {
      best = Math.min(best, pathLength(start, perm));
    }
    const route = optimizeRoute(start, stops);
    expect(route.totalDistance).toBeCloseTo(best, 5);
  });

  it('returns an empty route for no stops', () => {
    const route = optimizeRoute(at(5, 5), []);
    expect(route.stops).toEqual([]);
    expect(route.totalDistance).toBe(0);
  });

  it('a fixed end point reverses the visiting order when it lies behind the start', () => {
    const stops = [stop('a', 10, 0), stop('b', 20, 0), stop('c', 30, 0)];
    // start at 0, extract far right → natural order a b c
    expect(optimizeRoute(at(0, 0), stops, at(40, 0)).stops.map((s) => s.objectiveId)).toEqual(
      ['a', 'b', 'c'],
    );
    // start at 40, extract at 0 → must sweep back c b a
    expect(optimizeRoute(at(40, 0), stops, at(0, 0)).stops.map((s) => s.objectiveId)).toEqual(
      ['c', 'b', 'a'],
    );
    // end leg counts toward the total
    expect(optimizeRoute(at(0, 0), stops, at(40, 0)).totalDistance).toBeCloseTo(40);
  });

  it('routes to the end even with no stops', () => {
    const route = optimizeRoute(at(0, 0), [], at(30, 40));
    expect(route.totalDistance).toBeCloseTo(50);
  });
});
