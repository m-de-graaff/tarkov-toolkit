import { describe, expect, it } from 'vitest';
import type { TrackerState } from './availability';
import type { SyncedState } from './progressSync';
import { mergeSyncedState, normalizeSynced } from './progressSync';

const tracker = (over: Partial<TrackerState>): TrackerState => ({
  level: 10,
  faction: 'Any',
  completedTaskIds: [],
  hideoutLevels: {},
  itemsHave: {},
  storyChapterIds: [],
  ...over,
});

const state = (over: Partial<SyncedState>): SyncedState => ({
  gameMode: 'pvp',
  tracker: tracker({}),
  profiles: {},
  ...over,
});

describe('mergeSyncedState', () => {
  it('newer wins scalars, completions union, level max', () => {
    const remote = state({
      tracker: tracker({
        level: 12,
        faction: 'USEC',
        completedTaskIds: ['a', 'b'],
        hideoutLevels: { workbench: 2 },
      }),
    });
    const local = state({
      tracker: tracker({
        level: 15,
        faction: 'BEAR',
        completedTaskIds: ['b', 'c'],
        hideoutLevels: { workbench: 1, lavatory: 3 },
      }),
    });
    const merged = mergeSyncedState(remote, local);
    expect(merged.tracker.level).toBe(15); // max survives even when remote is newer
    expect(merged.tracker.faction).toBe('USEC'); // newer wins scalars
    expect(merged.tracker.hideoutLevels).toEqual({ workbench: 2 }); // newer write
    expect([...merged.tracker.completedTaskIds].sort()).toEqual(['a', 'b', 'c']);
  });

  it('keeps per-mode profiles from both sides', () => {
    const remote = state({
      gameMode: 'pvp',
      tracker: tracker({ completedTaskIds: ['pvp-r'] }),
      profiles: { pve: tracker({ level: 20, completedTaskIds: ['pve-r'] }) },
    });
    const local = state({
      gameMode: 'pve',
      tracker: tracker({ level: 25, completedTaskIds: ['pve-l'] }),
      profiles: { pvp: tracker({ completedTaskIds: ['pvp-l'] }) },
    });
    const merged = mergeSyncedState(remote, local);
    expect(merged.gameMode).toBe('pvp');
    expect([...merged.tracker.completedTaskIds].sort()).toEqual(['pvp-l', 'pvp-r']);
    expect([...(merged.profiles.pve?.completedTaskIds ?? [])].sort()).toEqual([
      'pve-l',
      'pve-r',
    ]);
    expect(merged.profiles.pve?.level).toBe(25);
  });

  it('unions the craft blacklist', () => {
    const merged = mergeSyncedState(
      state({ craftBlacklist: ['x'] }),
      state({ craftBlacklist: ['y'] }),
    );
    expect([...(merged.craftBlacklist ?? [])].sort()).toEqual(['x', 'y']);
  });

  it('a side missing a mode entirely keeps the other side unchanged', () => {
    const remote = state({});
    const local = state({ profiles: { pve: tracker({ level: 30 }) } });
    const merged = mergeSyncedState(remote, local);
    expect(merged.profiles.pve?.level).toBe(30);
  });
});

describe('normalizeSynced', () => {
  it('fills schema holes left by pre-v3 remote payloads', () => {
    const holey = {
      gameMode: 'pvp',
      tracker: { level: 10, faction: 'Any' },
      profiles: { pve: { level: 5, faction: 'Any' } },
    } as unknown as SyncedState;
    const out = normalizeSynced(holey);
    expect(out.tracker.completedTaskIds).toEqual([]);
    expect(out.tracker.hideoutLevels).toEqual({});
    expect(out.tracker.itemsHave).toEqual({});
    expect(out.profiles.pve?.itemsHave).toEqual({});
    expect(out.craftBlacklist).toEqual([]);
  });

  it('leaves complete payloads unchanged', () => {
    const full = state({ craftBlacklist: ['c'] });
    expect(normalizeSynced(full)).toEqual(full);
  });

  it('unions story chapters and fills them on old payloads', () => {
    const remote = state({ tracker: tracker({ storyChapterIds: ['tour'] }) });
    const local = state({ tracker: tracker({ storyChapterIds: ['batya'] }) });
    expect(mergeSyncedState(remote, local).tracker.storyChapterIds?.sort()).toEqual([
      'batya',
      'tour',
    ]);

    const legacy = state({});
    delete (legacy.tracker as Partial<TrackerState>).storyChapterIds;
    expect(normalizeSynced(legacy).tracker.storyChapterIds).toEqual([]);
  });
});
