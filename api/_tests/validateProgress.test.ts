import { describe, expect, it } from 'vitest';
import { validateSyncedState } from '../_lib/validateProgress.js';

const tracker = (over: Record<string, unknown> = {}) => ({
  level: 10,
  faction: 'Any',
  completedTaskIds: ['a', 'b'],
  hideoutLevels: { workbench: 2 },
  itemsHave: { bolts: 3 },
  ...over,
});

const state = (over: Record<string, unknown> = {}) => ({
  gameMode: 'pvp',
  tracker: tracker(),
  profiles: { pve: tracker() },
  craftBlacklist: ['c1'],
  ...over,
});

describe('validateSyncedState', () => {
  it('accepts a full valid state', () => {
    expect(validateSyncedState(state())).toBeNull();
  });

  it('accepts missing optional fields', () => {
    expect(validateSyncedState({ gameMode: 'pve', tracker: tracker() })).toBeNull();
    expect(
      validateSyncedState({
        gameMode: 'pvp',
        tracker: tracker({ hideoutLevels: undefined, itemsHave: undefined }),
      }),
    ).toBeNull();
  });

  it.each([
    [null, 'state must be an object'],
    ['str', 'state must be an object'],
    [state({ gameMode: 'arena' }), 'state.gameMode must be pvp or pve'],
    [state({ tracker: 'nope' }), 'state.tracker must be an object'],
    [state({ tracker: tracker({ level: 0 }) }), 'state.tracker.level must be a number between 1 and 79'],
    [state({ tracker: tracker({ level: 80 }) }), 'state.tracker.level must be a number between 1 and 79'],
    [state({ tracker: tracker({ level: Number.NaN }) }), 'state.tracker.level must be a number between 1 and 79'],
    [state({ tracker: tracker({ faction: 'None' }) }), 'state.tracker.faction must be one of Any, USEC, BEAR'],
    [state({ tracker: tracker({ completedTaskIds: 'oops' }) }), `state.tracker.completedTaskIds must be an array of at most 5000 ids`],
    [state({ tracker: tracker({ completedTaskIds: [1, 2] }) }), `state.tracker.completedTaskIds must be an array of at most 5000 ids`],
    [state({ tracker: tracker({ hideoutLevels: { x: -1 } }) }), 'state.tracker.hideoutLevels must map ids to non-negative numbers'],
    [state({ tracker: tracker({ itemsHave: { x: 'many' } }) }), 'state.tracker.itemsHave must map ids to non-negative numbers'],
    [state({ profiles: { arena: tracker() } }), 'state.profiles has unknown mode "arena"'],
    [state({ profiles: { pve: tracker({ level: 999 }) } }), 'state.profiles.pve.level must be a number between 1 and 79'],
    [state({ craftBlacklist: [42] }), 'state.craftBlacklist must be an array of at most 2000 ids'],
  ])('rejects %#', (value, message) => {
    expect(validateSyncedState(value)).toBe(message);
  });

  it('caps array sizes', () => {
    const huge = Array.from({ length: 5001 }, (_, i) => `id-${i}`);
    expect(validateSyncedState(state({ tracker: tracker({ completedTaskIds: huge }) }))).toMatch(
      /at most 5000/,
    );
  });
});
