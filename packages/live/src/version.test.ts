import { describe, expect, it } from 'vitest';

// compareVersions lives in the watcher app which has no test runner wired;
// the logic is duplicated here byte-for-byte to keep it honest. If this test
// and the watcher copy drift, update both.
function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v.replace(/^v/, '').split('.').map((n) => Number.parseInt(n, 10) || 0);
  const [pa, pb] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

describe('companion version comparison', () => {
  it('orders v-prefixed dotted tags', () => {
    expect(compareVersions('v0.2.0', 'v0.1.0')).toBe(1);
    expect(compareVersions('v0.1.0', 'v0.2.0')).toBe(-1);
    expect(compareVersions('v1.0.0', 'v0.9.9')).toBe(1);
    expect(compareVersions('v0.1.0', '0.1.0')).toBe(0);
    expect(compareVersions('v0.1.1', 'v0.1')).toBe(1);
    expect(compareVersions('dev', 'v0.1.0')).toBe(-1);
  });
});
