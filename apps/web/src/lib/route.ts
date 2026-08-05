import type { GamePosition, NeededItems } from '@raidplanner/data';
import { distance2d } from './geometry';
import type { NavLeg, Navigator } from './navGrid';

export interface RouteStop {
  taskId: string;
  taskName: string;
  objectiveId: string;
  description: string;
  position: GamePosition;
  /** items this objective consumes - bring them into the raid */
  neededItems?: NeededItems;
}

export interface RouteLeg {
  /** polyline in game coordinates, both endpoints included */
  points: GamePosition[];
  distance: number;
  /** straight-line fallback (no walkable path known) */
  direct: boolean;
}

export interface PlannedRoute {
  stops: RouteStop[];
  /** legs[i] leads INTO stops[i]; with an extract there is one final extra leg */
  legs: RouteLeg[];
  totalDistance: number;
}

type DistanceFn = (a: GamePosition, b: GamePosition) => number;

function pathLength(
  d: DistanceFn,
  start: GamePosition,
  stops: RouteStop[],
  end?: GamePosition,
): number {
  let total = 0;
  let prev = start;
  for (const s of stops) {
    total += d(prev, s.position);
    prev = s.position;
  }
  if (end) total += d(prev, end);
  return total;
}

function nearestNeighbourFrom(
  d: DistanceFn,
  first: RouteStop,
  stops: RouteStop[],
): RouteStop[] {
  const remaining = stops.filter((s) => s !== first);
  const ordered = [first];
  let current = first.position;
  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const dist = d(current, remaining[i].position);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    }
    const [next] = remaining.splice(bestIndex, 1);
    ordered.push(next);
    current = next.position;
  }
  return ordered;
}

function twoOpt(
  d: DistanceFn,
  start: GamePosition,
  ordered: RouteStop[],
  end?: GamePosition,
): RouteStop[] {
  const path = [...ordered];
  let improved = true;
  let passes = 0;
  while (improved && passes < 200) {
    improved = false;
    passes++;
    for (let i = 0; i < path.length - 1; i++) {
      for (let j = i + 1; j < path.length; j++) {
        const candidate = [
          ...path.slice(0, i),
          ...path.slice(i, j + 1).reverse(),
          ...path.slice(j + 1),
        ];
        if (pathLength(d, start, candidate, end) < pathLength(d, start, path, end) - 1e-9) {
          path.splice(0, path.length, ...candidate);
          improved = true;
        }
      }
    }
  }
  return path;
}

const straightLeg = (a: GamePosition, b: GamePosition): NavLeg => ({
  points: [a, b],
  distance: distance2d(a, b),
  direct: true,
});

function buildLegs(
  nav: Navigator | null,
  start: GamePosition,
  stops: RouteStop[],
  end?: GamePosition,
): RouteLeg[] {
  const legFor = nav ? nav.leg.bind(nav) : straightLeg;
  const legs: RouteLeg[] = [];
  let prev = start;
  for (const stop of stops) {
    legs.push(legFor(prev, stop.position));
    prev = stop.position;
  }
  if (end) legs.push(legFor(prev, end));
  return legs;
}

/**
 * Open-path TSP heuristic with a fixed start (and optionally a fixed end -
 * the extract): multi-start nearest-neighbour followed by 2-opt; best wins.
 * With a navigator the ordering optimizes real walkable distances and each
 * leg carries its walkable polyline; without one it falls back to straight
 * lines (maps with no SVG data).
 */
export function optimizeRoute(
  start: GamePosition,
  stops: RouteStop[],
  end?: GamePosition,
  nav?: Navigator | null,
): PlannedRoute {
  const navigator = nav ?? null;
  const d: DistanceFn = navigator
    ? (a, b) => navigator.leg(a, b).distance
    : distance2d;

  if (stops.length === 0) {
    const legs = buildLegs(navigator, start, [], end);
    return {
      stops: [],
      legs,
      totalDistance: legs.reduce((sum, l) => sum + l.distance, 0),
    };
  }

  let best: RouteStop[] | null = null;
  let bestLength = Infinity;
  for (const first of stops) {
    const candidate = twoOpt(d, start, nearestNeighbourFrom(d, first, stops), end);
    const length = pathLength(d, start, candidate, end);
    if (length < bestLength) {
      bestLength = length;
      best = candidate;
    }
  }
  const legs = buildLegs(navigator, start, best!, end);
  return {
    stops: best!,
    legs,
    totalDistance: legs.reduce((sum, l) => sum + l.distance, 0),
  };
}
