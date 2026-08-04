// Game-coordinate handling ported from the-hideout/tarkov-dev (MIT),
// src/pages/map/index.jsx: an extended CRS.Simple whose projection rotates
// lat/lng by the map's coordinateRotation and whose transformation applies the
// map's affine calibration. A game position {x,y,z} lands at latLng [z, x].
import L from 'leaflet';
import type { GamePosition, MapCalibration } from '@raidplanner/data';

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

function applyRotation(latLng: L.LatLng, rotation: number): L.LatLng {
  if (!latLng.lng && !latLng.lat) return L.latLng(0, 0);
  if (!rotation) return latLng;
  const [x, y] = rotatePoint(latLng.lng, latLng.lat, rotation);
  return L.latLng(y, x);
}

export function makeCrs(cal: MapCalibration): L.CRS {
  const [scaleX, marginX, rawScaleY, marginY] = cal.transform;
  const rotation = cal.coordinateRotation;
  return L.Util.extend({}, L.CRS.Simple, {
    transformation: new L.Transformation(scaleX, marginX, -rawScaleY, marginY),
    projection: L.Util.extend({}, L.Projection.LonLat, {
      project(latLng: L.LatLng) {
        return L.Projection.LonLat.project(applyRotation(latLng, rotation));
      },
      unproject(point: L.Point) {
        return applyRotation(L.Projection.LonLat.unproject(point), -rotation);
      },
    }),
  });
}
