import { describe, expect, it } from 'vitest';
import { isScreenshotName, parseScreenshotName } from './parse';

describe('parseScreenshotName', () => {
  it('parses a standard EFT screenshot filename', () => {
    const fix = parseScreenshotName(
      '2026-08-04[21-33]_-105.40, 2.80, 116.40_0.0, -0.1, 1.0, -0.1 (0).png',
    );
    expect(fix).not.toBeNull();
    expect(fix!.position).toEqual({ x: -105.4, y: 2.8, z: 116.4 });
    expect(Number.isFinite(fix!.yawDeg)).toBe(true);
    expect(fix!.takenAt).toBe('2026-08-04[21-33]');
    expect(fix!.raw).toContain('-105.40');
  });

  it('parses a filename with the trailing fov segment', () => {
    const fix = parseScreenshotName(
      '2026-08-04[21-35]_12.55, 0.94, -54.30_0.0, 0.7071, 0.0, 0.7071_12.20 (0).png',
    );
    expect(fix).not.toBeNull();
    expect(fix!.position).toEqual({ x: 12.55, y: 0.94, z: -54.3 });
  });

  it('computes yaw from the quaternion (identity → 0°, y-half-turn → 90°)', () => {
    const identity = parseScreenshotName(
      '2026-08-04[21-36]_0.00, 0.00, 0.00_0.0, 0.0, 0.0, 1.0 (0).png',
    );
    expect(identity!.yawDeg).toBeCloseTo(0, 1);
    const quarter = parseScreenshotName(
      '2026-08-04[21-37]_0.00, 0.00, 0.00_0.0, 0.7071, 0.0, 0.7071 (0).png',
    );
    expect(quarter!.yawDeg).toBeCloseTo(90, 0);
  });

  it('parses the real practice-raid filename from 2026-08-05', () => {
    const fix = parseScreenshotName(
      '2026-08-05[00-04]_179.37, 18.38, -6.33_-0.03947, 0.18638, 0.05768, -0.97999_13.54 (0).png',
    );
    expect(fix).not.toBeNull();
    expect(fix!.position).toEqual({ x: 179.37, y: 18.38, z: -6.33 });
  });

  it('accepts multi-digit screenshot counters like (12)', () => {
    const fix = parseScreenshotName(
      '2026-08-05[00-09]_1.00, 2.00, 3.00_0.0, 0.0, 0.0, 1.0 (12).png',
    );
    expect(fix).not.toBeNull();
  });

  it('rejects non-screenshot names', () => {
    expect(parseScreenshotName('inventory.png')).toBeNull();
    expect(parseScreenshotName('')).toBeNull();
    expect(parseScreenshotName('2026-08-04 21-33 screenshot.png')).toBeNull();
  });
});

describe('isScreenshotName', () => {
  it('matches only EFT position screenshots', () => {
    expect(
      isScreenshotName('2026-08-04[21-33]_-105.40, 2.80, 116.40_0.0, -0.1, 1.0, -0.1 (0).png'),
    ).toBe(true);
    expect(isScreenshotName('desktop.ini')).toBe(false);
    expect(isScreenshotName('inventory.png')).toBe(false);
  });
});
