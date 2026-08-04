// Pure coordinate math, deliberately free of leaflet so domain modules and
// their tests need no DOM.
import type { GamePosition } from '@raidplanner/data';

export function rotatePoint(x: number, y: number, degrees: number): [number, number] {
  if (!degrees) return [x, y];
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [x * cos - y * sin, x * sin + y * cos];
}

export function gameToLatLng(p: GamePosition): [number, number] {
  return [p.z, p.x];
}

export function boundsToLatLng(
  b: [[number, number], [number, number]],
): [[number, number], [number, number]] {
  return [
    [b[0][1], b[0][0]],
    [b[1][1], b[1][0]],
  ];
}

export function distance2d(a: GamePosition, b: GamePosition): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
