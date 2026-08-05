import type { GamePosition } from '@raidplanner/data';
import { distance2d } from './geometry';

export interface RouteStop {
  taskId: string;
  taskName: string;
  objectiveId: string;
  description: string;
  position: GamePosition;
}

export interface PlannedRoute {
  stops: RouteStop[];
  totalDistance: number;
}

function pathLength(start: GamePosition, stops: RouteStop[], end?: GamePosition): number {
  let total = 0;
  let prev = start;
  for (const s of stops) {
    total += distance2d(prev, s.position);
    prev = s.position;
  }
  if (end) total += distance2d(prev, end);
  return total;
}

function nearestNeighbourFrom(first: RouteStop, stops: RouteStop[]): RouteStop[] {
  const remaining = stops.filter((s) => s !== first);
  const ordered = [first];
  let current = first.position;
  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = distance2d(current, remaining[i].position);
      if (d < bestDist) {
        bestDist = d;
        bestIndex = i;
      }
    }
    const [next] = remaining.splice(bestIndex, 1);
    ordered.push(next);
    current = next.position;
  }
  return ordered;
}

function twoOpt(start: GamePosition, ordered: RouteStop[], end?: GamePosition): RouteStop[] {
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
        if (pathLength(start, candidate, end) < pathLength(start, path, end) - 1e-9) {
          path.splice(0, path.length, ...candidate);
          improved = true;
        }
      }
    }
  }
  return path;
}

/**
 * Open-path TSP heuristic with a fixed start (and optionally a fixed end —
 * the extract): multi-start nearest-neighbour followed by 2-opt; best wins.
 */
export function optimizeRoute(
  start: GamePosition,
  stops: RouteStop[],
  end?: GamePosition,
): PlannedRoute {
  if (stops.length === 0) {
    return { stops: [], totalDistance: end ? distance2d(start, end) : 0 };
  }

  let best: RouteStop[] | null = null;
  let bestLength = Infinity;
  for (const first of stops) {
    const candidate = twoOpt(start, nearestNeighbourFrom(first, stops), end);
    const length = pathLength(start, candidate, end);
    if (length < bestLength) {
      bestLength = length;
      best = candidate;
    }
  }
  return { stops: best!, totalDistance: bestLength };
}
