import { describe, expect, it } from 'vitest';
import type { TrackerState } from './availability';
import { fixtureSnapshot } from './fixtures';
import { recommendMaps } from './recommend';

const tracker = (overrides: Partial<TrackerState> = {}): TrackerState => ({
  level: 15,
  faction: 'Any',
  completedTaskIds: [],
  ...overrides,
});

describe('recommendMaps', () => {
  it('ranks the map with more available quests first', () => {
    // map-a: t-locked + t-multi = 2; map-b: t-multi = 1 (t-high-level needs level 20)
    const scores = recommendMaps(fixtureSnapshot, tracker());
    expect(scores.map((s) => s.mapId)).toEqual(['map-a', 'map-b']);
    expect(scores[0].availableQuestCount).toBe(2);
    expect(scores[0].mapLockedCount).toBe(1);
    expect(scores[1].availableQuestCount).toBe(1);
  });

  it('does not count completed quests', () => {
    // faction BEAR keeps the unlocked USEC follow-up (t-req) out of the count
    const scores = recommendMaps(
      fixtureSnapshot,
      tracker({ completedTaskIds: ['t-locked'], faction: 'BEAR' }),
    );
    expect(scores.find((s) => s.mapId === 'map-a')?.availableQuestCount).toBe(1);
  });

  it('excludes maps with zero available quests', () => {
    const scores = recommendMaps(
      fixtureSnapshot,
      tracker({ completedTaskIds: ['t-locked', 't-multi', 't-req'] }),
    );
    expect(scores.some((s) => s.mapId === 'map-a')).toBe(false);
  });
});
