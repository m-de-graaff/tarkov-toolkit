import { describe, expect, it } from 'vitest';
import { pickNewestFix } from './pick';

const shot = (stamp: string) => `2026-08-04[${stamp}]_1.00, 2.00, 3.00_0.0, 0.0, 0.0, 1.0 (0).png`;

describe('pickNewestFix', () => {
  it('returns the newest unseen screenshot and marks all new names seen', () => {
    const seen = new Set<string>([shot('20-00')]);
    const result = pickNewestFix([shot('20-00'), shot('20-05'), shot('20-03'), 'junk.png'], seen);
    expect(result).toBe(shot('20-05'));
    expect(seen.has(shot('20-03'))).toBe(true);
    expect(seen.has('junk.png')).toBe(true);
  });

  it('returns null when nothing new matches', () => {
    const seen = new Set<string>();
    expect(pickNewestFix(['desktop.ini', 'inventory.png'], seen)).toBeNull();
    expect(pickNewestFix([], seen)).toBeNull();
  });

  it('ignores already-seen names on later polls', () => {
    const seen = new Set<string>();
    pickNewestFix([shot('20-00')], seen);
    expect(pickNewestFix([shot('20-00')], seen)).toBeNull();
  });
});
