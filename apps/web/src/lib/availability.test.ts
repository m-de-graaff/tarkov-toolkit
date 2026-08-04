import { describe, expect, it } from 'vitest';
import type { TrackerState } from './availability';
import { availableQuests, isAvailable } from './availability';
import { fixtureSnapshot, tHighLevel, tRequiresLocked } from './fixtures';

const tracker = (overrides: Partial<TrackerState> = {}): TrackerState => ({
  level: 15,
  faction: 'Any',
  completedTaskIds: [],
  ...overrides,
});

describe('isAvailable', () => {
  it('respects minPlayerLevel', () => {
    expect(isAvailable(tHighLevel, tracker({ level: 10 }))).toBe(false);
    expect(isAvailable(tHighLevel, tracker({ level: 20 }))).toBe(true);
  });

  it('respects faction', () => {
    expect(isAvailable(tRequiresLocked, tracker({ faction: 'BEAR', completedTaskIds: ['t-locked'] }))).toBe(false);
    expect(isAvailable(tRequiresLocked, tracker({ faction: 'USEC', completedTaskIds: ['t-locked'] }))).toBe(true);
  });

  it('requires prerequisite tasks to be completed', () => {
    expect(isAvailable(tRequiresLocked, tracker({ faction: 'USEC' }))).toBe(false);
    expect(isAvailable(tRequiresLocked, tracker({ faction: 'USEC', completedTaskIds: ['t-locked'] }))).toBe(true);
  });

  it('excludes already-completed tasks', () => {
    expect(isAvailable(tHighLevel, tracker({ level: 30, completedTaskIds: ['t-high-level'] }))).toBe(false);
  });
});

describe('availableQuests', () => {
  it('returns exactly the open tasks for the tracker state', () => {
    const ids = availableQuests(fixtureSnapshot, tracker()).map((t) => t.id);
    expect(ids).toContain('t-locked');
    expect(ids).toContain('t-multi');
    expect(ids).toContain('t-anywhere');
    expect(ids).not.toContain('t-high-level'); // level 15 < 20
    expect(ids).not.toContain('t-req'); // prerequisite not completed
  });
});
