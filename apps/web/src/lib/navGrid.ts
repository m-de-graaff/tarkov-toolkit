// Walkability grid + pathfinding, deliberately free of DOM/leaflet so it is
// testable in node. The grid is built elsewhere (svgNav.ts rasterizes the
// bundled map SVGs); this module only knows cells and coordinates.
import type { GamePosition, MapCalibration } from '@raidplanner/data';
import { rotatePoint } from './geometry';

export interface NavGrid {
  width: number;
  height: number;
  /** row-major walkability, 1 = walkable */
  cells: Uint8Array;
  projector: Projector;
}

export interface Projector {
  toCell(p: GamePosition): [number, number];
  toGame(cx: number, cy: number): GamePosition;
}

/**
 * Maps game coordinates onto raster pixels of the map SVG, replicating what
 * leaflet does with our rotated CRS: rotate (x, z) by coordinateRotation,
 * apply the affine calibration, then normalize into the projected rectangle
 * of svgBounds. Pure math clone of tarkovCrs.makeCrs + L.imageOverlay.
 */
export function makeProjector(
  cal: MapCalibration,
  rasterWidth: number,
  rasterHeight: number,
): Projector {
  const [scaleX, marginX, rawScaleY, marginY] = cal.transform;
  const rotation = cal.coordinateRotation;
  const project = (x: number, z: number): [number, number] => {
    const [rx, rz] = rotatePoint(x, z, rotation);
    return [scaleX * rx + marginX, -rawScaleY * rz + marginY];
  };
  const bounds = cal.svgBounds ?? cal.bounds;
  const [pa, pb] = [project(bounds[0][0], bounds[0][1]), project(bounds[1][0], bounds[1][1])];
  const minX = Math.min(pa[0], pb[0]);
  const maxX = Math.max(pa[0], pb[0]);
  const minY = Math.min(pa[1], pb[1]);
  const maxY = Math.max(pa[1], pb[1]);

  return {
    toCell(p) {
      const [px, py] = project(p.x, p.z);
      return [
        ((px - minX) / (maxX - minX)) * rasterWidth,
        ((py - minY) / (maxY - minY)) * rasterHeight,
      ];
    },
    toGame(cx, cy) {
      const px = (cx / rasterWidth) * (maxX - minX) + minX;
      const py = (cy / rasterHeight) * (maxY - minY) + minY;
      const x = (px - marginX) / scaleX;
      const z = (py - marginY) / -rawScaleY;
      const [ux, uz] = rotatePoint(x, z, -rotation);
      return { x: ux, y: 0, z: uz };
    },
  };
}

const at = (grid: NavGrid, x: number, y: number): number =>
  x < 0 || y < 0 || x >= grid.width || y >= grid.height ? 0 : grid.cells[y * grid.width + x];

export const isWalkable = (grid: NavGrid, x: number, y: number): boolean => at(grid, x, y) === 1;

/** Clamp + round a fractional cell coordinate onto the grid. */
export function cellOf(grid: NavGrid, p: GamePosition): [number, number] {
  const [fx, fy] = grid.projector.toCell(p);
  return [
    Math.min(grid.width - 1, Math.max(0, Math.round(fx))),
    Math.min(grid.height - 1, Math.max(0, Math.round(fy))),
  ];
}

/** Nearest walkable cell within maxRadius (ring search), or null. */
export function nearestWalkable(
  grid: NavGrid,
  [sx, sy]: [number, number],
  maxRadius = 48,
): [number, number] | null {
  if (isWalkable(grid, sx, sy)) return [sx, sy];
  for (let r = 1; r <= maxRadius; r++) {
    let best: [number, number] | null = null;
    let bestDist = Infinity;
    for (let dx = -r; dx <= r; dx++) {
      for (const dy of dx === -r || dx === r ? range(-r, r) : [-r, r]) {
        const x = sx + dx;
        const y = sy + dy;
        if (!isWalkable(grid, x, y)) continue;
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          best = [x, y];
        }
      }
    }
    if (best) return best;
  }
  return null;
}

function range(a: number, b: number): number[] {
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

/** Bresenham line-of-sight: true when the straight segment stays walkable. */
export function lineOfSight(
  grid: NavGrid,
  [x0, y0]: [number, number],
  [x1, y1]: [number, number],
): boolean {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    if (!isWalkable(grid, x, y)) return false;
    if (x === x1 && y === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) {
      // moving diagonally must not squeeze between two blocked corners
      if (e2 < dx && !isWalkable(grid, x + sx, y) && !isWalkable(grid, x, y + sy)) return false;
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

const SQRT2 = Math.SQRT2;

/**
 * A* over the grid, 8-connected, diagonals disallowed when they would cut a
 * blocked corner. Returns the cell path including both endpoints, or null
 * when the endpoints are disconnected.
 */
export function findPath(
  grid: NavGrid,
  start: [number, number],
  goal: [number, number],
): [number, number][] | null {
  const { width, height } = grid;
  const size = width * height;
  const startIdx = start[1] * width + start[0];
  const goalIdx = goal[1] * width + goal[0];
  if (!isWalkable(grid, start[0], start[1]) || !isWalkable(grid, goal[0], goal[1])) return null;
  if (startIdx === goalIdx) return [start];

  const gScore = new Float64Array(size).fill(Infinity);
  const parent = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  gScore[startIdx] = 0;

  // binary heap of [f, idx]
  const heap: number[] = [];
  const heapIdx: number[] = [];
  const push = (f: number, idx: number) => {
    let i = heap.length;
    heap.push(f);
    heapIdx.push(idx);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p] <= heap[i]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      [heapIdx[p], heapIdx[i]] = [heapIdx[i], heapIdx[p]];
      i = p;
    }
  };
  const pop = (): number => {
    const top = heapIdx[0];
    const lastF = heap.pop()!;
    const lastI = heapIdx.pop()!;
    if (heap.length > 0) {
      heap[0] = lastF;
      heapIdx[0] = lastI;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l] < heap[m]) m = l;
        if (r < heap.length && heap[r] < heap[m]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        [heapIdx[m], heapIdx[i]] = [heapIdx[i], heapIdx[m]];
        i = m;
      }
    }
    return top;
  };
  const h = (idx: number) => {
    const x = idx % width;
    const y = (idx / width) | 0;
    const dx = Math.abs(x - goal[0]);
    const dy = Math.abs(y - goal[1]);
    // octile distance
    return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
  };

  push(h(startIdx), startIdx);
  while (heap.length > 0) {
    const current = pop();
    if (current === goalIdx) {
      const path: [number, number][] = [];
      for (let idx = goalIdx; idx !== -1; idx = parent[idx]) {
        path.push([idx % width, (idx / width) | 0]);
      }
      return path.reverse();
    }
    if (closed[current]) continue;
    closed[current] = 1;
    const cx = current % width;
    const cy = (current / width) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (!isWalkable(grid, nx, ny)) continue;
        if (dx !== 0 && dy !== 0 && !isWalkable(grid, cx + dx, cy) && !isWalkable(grid, cx, cy + dy))
          continue;
        const nIdx = ny * width + nx;
        if (closed[nIdx]) continue;
        const step = dx !== 0 && dy !== 0 ? SQRT2 : 1;
        const g = gScore[current] + step;
        if (g < gScore[nIdx]) {
          gScore[nIdx] = g;
          parent[nIdx] = current;
          push(g + h(nIdx), nIdx);
        }
      }
    }
  }
  return null;
}

/** Greedy string-pulling: drop every waypoint the previous kept point can see. */
export function smoothPath(grid: NavGrid, path: [number, number][]): [number, number][] {
  if (path.length <= 2) return path;
  const out: [number, number][] = [path[0]];
  let anchor = 0;
  for (let i = 2; i < path.length; i++) {
    if (!lineOfSight(grid, path[anchor], path[i])) {
      out.push(path[i - 1]);
      anchor = i - 1;
    }
  }
  out.push(path[path.length - 1]);
  return out;
}

export interface NavLeg {
  /** walkable polyline from a to b in game coordinates, both endpoints included */
  points: GamePosition[];
  distance: number;
  /** true when no walkable path was found and this is a straight-line fallback */
  direct: boolean;
}

export interface Navigator {
  leg(a: GamePosition, b: GamePosition): NavLeg;
}

const gameDist = (a: GamePosition, b: GamePosition) => Math.hypot(a.x - b.x, a.z - b.z);

function polylineLength(points: GamePosition[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += gameDist(points[i - 1], points[i]);
  return total;
}

/**
 * Game-coordinate pathfinding over a grid: snaps endpoints to the nearest
 * walkable cell, A*s between them, smooths the result, and memoizes per
 * endpoint pair. Falls back to the straight line when either endpoint cannot
 * be snapped or the cells are disconnected - a wrong-but-visible route beats
 * no route.
 */
export function makeNavigator(grid: NavGrid): Navigator {
  const memo = new Map<string, NavLeg>();
  return {
    leg(a, b) {
      const ca = cellOf(grid, a);
      const cb = cellOf(grid, b);
      const key = `${ca[0]},${ca[1]}:${cb[0]},${cb[1]}`;
      const reversedKey = `${cb[0]},${cb[1]}:${ca[0]},${ca[1]}`;
      const cachedReverse = memo.get(reversedKey);
      if (cachedReverse) {
        return {
          points: [...cachedReverse.points].reverse(),
          distance: cachedReverse.distance,
          direct: cachedReverse.direct,
        };
      }
      const cached = memo.get(key);
      if (cached) return cached;

      const direct: NavLeg = { points: [a, b], distance: gameDist(a, b), direct: true };
      const sa = nearestWalkable(grid, ca);
      const sb = nearestWalkable(grid, cb);
      let result = direct;
      if (sa && sb) {
        const cellPath = findPath(grid, sa, sb);
        if (cellPath) {
          const smoothed = smoothPath(grid, cellPath);
          const points = [a, ...smoothed.map(([x, y]) => grid.projector.toGame(x, y)), b];
          // the snapped cell centers duplicate the endpoints visually; keep
          // them anyway (they are the walkable anchors) but measure honestly
          result = { points, distance: polylineLength(points), direct: false };
        }
      }
      memo.set(key, result);
      return result;
    },
  };
}
