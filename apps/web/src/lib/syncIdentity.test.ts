// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseAuthEnabled } from './authClient';
import type { TrackerState } from './availability';
import type { SyncedState, SyncPayload } from './progressSync';
import { freshSyncedState, resolveSignInState } from './syncIdentity';

const tracker = (over: Partial<TrackerState>): TrackerState => ({
  level: 10,
  faction: 'Any',
  completedTaskIds: [],
  hideoutLevels: {},
  itemsHave: {},
  ...over,
});

const local: SyncedState = {
  gameMode: 'pvp',
  tracker: tracker({ level: 30, completedTaskIds: ['local-quest'] }),
  profiles: {},
};

const remote: SyncPayload = {
  version: 3,
  state: {
    gameMode: 'pve',
    tracker: tracker({ level: 12, completedTaskIds: ['remote-quest'] }),
    profiles: {},
  },
};

describe('resolveSignInState', () => {
  it('first sign-in on this browser merges local into the account', () => {
    const out = resolveSignInState(remote, local, null, 'user-a');
    const all = [out.tracker, ...Object.values(out.profiles)];
    const ids = all.flatMap((t) => t?.completedTaskIds ?? []);
    expect(ids).toContain('local-quest');
    expect(ids).toContain('remote-quest');
  });

  it('same user as last time merges', () => {
    const out = resolveSignInState(remote, local, 'user-a', 'user-a');
    const ids = [out.tracker, ...Object.values(out.profiles)].flatMap(
      (t) => t?.completedTaskIds ?? [],
    );
    expect(ids).toContain('local-quest');
  });

  it('a different user adopts the remote copy verbatim - no leak', () => {
    const out = resolveSignInState(remote, local, 'user-a', 'user-b');
    expect(out).toEqual(remote.state);
    const ids = [out.tracker, ...Object.values(out.profiles)].flatMap(
      (t) => t?.completedTaskIds ?? [],
    );
    expect(ids).not.toContain('local-quest');
  });

  it('a different user with no server copy starts fresh', () => {
    const out = resolveSignInState(null, local, 'user-a', 'user-b');
    expect(out).toEqual(freshSyncedState());
  });

  it('same user with no server copy keeps local', () => {
    expect(resolveSignInState(null, local, 'user-a', 'user-a')).toBe(local);
  });
});

describe('parseAuthEnabled', () => {
  it('only "1" and "true" (any case) enable auth', () => {
    expect(parseAuthEnabled('true')).toBe(true);
    expect(parseAuthEnabled('TRUE')).toBe(true);
    expect(parseAuthEnabled('1')).toBe(true);
    expect(parseAuthEnabled('false')).toBe(false);
    expect(parseAuthEnabled('0')).toBe(false);
    expect(parseAuthEnabled('')).toBe(false);
    expect(parseAuthEnabled(undefined)).toBe(false);
  });
});
