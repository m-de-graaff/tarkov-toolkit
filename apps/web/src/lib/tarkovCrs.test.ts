// @vitest-environment jsdom
import L from 'leaflet';
import { describe, expect, it } from 'vitest';
import { boundsToLatLng, distance2d, gameToLatLng, makeCrs, rotatePoint } from './tarkovCrs';

describe('rotatePoint', () => {
  it('rotates 180 degrees', () => {
    const [x, y] = rotatePoint(1, 0, 180);
    expect(x).toBeCloseTo(-1);
    expect(y).toBeCloseTo(0);
  });

  it('rotates 90 degrees counter-clockwise', () => {
    const [x, y] = rotatePoint(1, 0, 90);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(1);
  });

  it('is identity at 0 degrees', () => {
    expect(rotatePoint(3, 4, 0)).toEqual([3, 4]);
  });
});

describe('gameToLatLng', () => {
  it('maps game {x,z} to [z, x]', () => {
    expect(gameToLatLng({ x: 5, y: 0, z: 7 })).toEqual([7, 5]);
  });
});

describe('boundsToLatLng', () => {
  it('swaps [x,z] pairs into [z,x] latLng pairs', () => {
    expect(
      boundsToLatLng([
        [323, -295],
        [-280, 532],
      ]),
    ).toEqual([
      [-295, 323],
      [532, -280],
    ]);
  });
});

describe('distance2d', () => {
  it('is euclidean on x/z, ignoring y', () => {
    expect(distance2d({ x: 0, y: 99, z: 0 }, { x: 3, y: 0, z: 4 })).toBe(5);
  });
});

describe('makeCrs', () => {
  // Streets-of-Tarkov calibration: transform [0.38, 0, 0.38, 0], rotation 180.
  const crs = makeCrs({
    transform: [0.38, 0, 0.38, 0],
    coordinateRotation: 180,
    bounds: [
      [323, -295],
      [-280, 532],
    ],
    svgFile: 'streets-of-tarkov.svg',
  });

  it('projects latLng through rotation then affine transform', () => {
    // Derivation from the ported constants at zoom 0 (scale = 1):
    // rotate(lat 10, lng 20) by 180 -> (lat -10, lng -20)
    // LonLat.project -> point(x: -20, y: -10)
    // x' = transform[0] * x + transform[1] = 0.38 * -20 + 0 = -7.6
    // y' = -transform[2] * y + transform[3] = -0.38 * -10 + 0 = 3.8
    const point = crs.latLngToPoint(L.latLng(10, 20), 0);
    expect(point.x).toBeCloseTo(-7.6);
    expect(point.y).toBeCloseTo(3.8);
  });

  it('round-trips latLng -> point -> latLng', () => {
    const original = L.latLng(-83.59, 156.2);
    const back = crs.pointToLatLng(crs.latLngToPoint(original, 2), 2);
    expect(back.lat).toBeCloseTo(original.lat);
    expect(back.lng).toBeCloseTo(original.lng);
  });
});
