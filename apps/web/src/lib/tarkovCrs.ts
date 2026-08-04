// Game-coordinate handling ported from the-hideout/tarkov-dev (MIT),
// src/pages/map/index.jsx: an extended CRS.Simple whose projection rotates
// lat/lng by the map's coordinateRotation and whose transformation applies the
// map's affine calibration. A game position {x,y,z} lands at latLng [z, x].
import L from 'leaflet';
import type { MapCalibration } from '@raidplanner/data';
import { rotatePoint } from './geometry';

export { boundsToLatLng, distance2d, gameToLatLng, rotatePoint } from './geometry';

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
