import { describe, expect, it } from 'vitest';
import type { RpTask } from '@raidplanner/data';
import type { TrackerState } from './availability';
import { isAvailable } from './availability';
import { fixtureSnapshot, tHighLevel, tRequiresLocked } from './fixtures';
import { lockReasons } from './lockReasons';

const byId = new Map(fixtureSnapshot.tasks.map((t) => [t.id, t]));

const tracker = (overrides: Partial<TrackerState> = {}): TrackerState => ({
  level: 15,
  faction: 'Any',
  completedTaskIds: [],
  ...overrides,
});

describe('lockReasons', () => {
  it('names the level gate', () => {
    expect(lockReasons(tHighLevel, tracker({ level: 10 }), byId)).toEqual(['Lv 20']);
  });

  it('names the faction gate', () => {
    expect(
      lockReasons(tRequiresLocked, tracker({ faction: 'BEAR', completedTaskIds: ['t-locked'] }), byId),
    ).toEqual(['USEC only']);
  });

  it('names missing prerequisites by quest name, capped at two', () => {
    expect(lockReasons(tRequiresLocked, tracker({ faction: 'USEC' }), byId)).toEqual([
      'after Locked to A',
    ]);
    const many: RpTask = {
      ...tRequiresLocked,
      factionName: 'Any',
      taskRequirements: [
        { taskId: 't-locked', status: ['complete'] },
        { taskId: 't-multi', status: ['complete'] },
        { taskId: 't-anywhere', status: ['complete'] },
      ],
    };
    expect(lockReasons(many, tracker(), byId)).toEqual([
      'after Locked to A',
      'after Multi Map',
      '+1 more',
    ]);
  });

  it('non-complete requirement statuses do not lock (v1 simplification)', () => {
    const activeReq: RpTask = {
      ...tRequiresLocked,
      factionName: 'Any',
      taskRequirements: [{ taskId: 't-locked', status: ['active'] }],
    };
    expect(lockReasons(activeReq, tracker(), byId)).toEqual([]);
  });

  it('agrees with isAvailable for every fixture task and tracker combo', () => {
    const trackers = [
      tracker(),
      tracker({ level: 1 }),
      tracker({ level: 30 }),
      tracker({ faction: 'USEC' }),
      tracker({ faction: 'BEAR', level: 25 }),
      tracker({ completedTaskIds: ['t-locked'], faction: 'USEC', level: 25 }),
    ];
    for (const t of fixtureSnapshot.tasks) {
      for (const state of trackers) {
        if (state.completedTaskIds.includes(t.id)) continue;
        expect(lockReasons(t, state, byId).length === 0, `${t.id} vs ${JSON.stringify(state)}`).toBe(
          isAvailable(t, state),
        );
      }
    }
  });
});
