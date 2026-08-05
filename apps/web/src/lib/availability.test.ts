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

  it('gates on trader loyalty and hides locked traders entirely', () => {
    const ll2 = { ...tHighLevel, loyaltyLevel: 2 };
    const traderName = tHighLevel.trader.name;
    // default loyalty is LL1: an LL2 quest is hidden, an ungated one shows
    expect(isAvailable(ll2, tracker({ level: 30 }))).toBe(false);
    expect(isAvailable(tHighLevel, tracker({ level: 30 }))).toBe(true);
    expect(
      isAvailable(ll2, tracker({ level: 30, traderLoyalty: { [traderName]: 2 } })),
    ).toBe(true);
    // locked trader (loyalty 0) hides even its LL1 quests
    expect(
      isAvailable(tHighLevel, tracker({ level: 30, traderLoyalty: { [traderName]: 0 } })),
    ).toBe(false);
  });

  it("gates 'active'-status requirements on the prereq being obtainable", () => {
    // Postman Pat - Part 2 requires Part 1 "active"; while Part 1 sits
    // behind trader LL2 the game shows neither
    const part1 = {
      ...tHighLevel,
      id: 'pp1',
      minPlayerLevel: 1,
      loyaltyLevel: 2,
      taskRequirements: [],
    };
    const part2 = {
      ...tHighLevel,
      id: 'pp2',
      minPlayerLevel: 1,
      taskRequirements: [{ taskId: 'pp1', status: ['active'] }],
    };
    const byId = new Map([['pp1', part1], ['pp2', part2]]);
    const traderName = tHighLevel.trader.name;
    expect(isAvailable(part2, tracker(), byId)).toBe(false);
    expect(
      isAvailable(part2, tracker({ traderLoyalty: { [traderName]: 2 } }), byId),
    ).toBe(true);
    expect(isAvailable(part2, tracker({ completedTaskIds: ['pp1'] }), byId)).toBe(true);
    // unknown prereq ids stay lenient (dropped/renamed tasks)
    const dangling = { ...part2, id: 'pp3', taskRequirements: [{ taskId: 'gone', status: ['active'] }] };
    expect(isAvailable(dangling, tracker(), byId)).toBe(true);
  });

  it('treats a mangled factionName as open to both factions', () => {
    // the 2026-08 snapshots shipped 'Any' blind-translated into 'any target',
    // which made every common quest disappear for USEC/BEAR trackers
    const mangled = { ...tHighLevel, factionName: 'any target' };
    expect(isAvailable(mangled, tracker({ level: 30, faction: 'USEC' }))).toBe(true);
    expect(isAvailable(mangled, tracker({ level: 30, faction: 'BEAR' }))).toBe(true);
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
