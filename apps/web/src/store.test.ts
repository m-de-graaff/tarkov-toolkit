// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { usePlanner } from './store';

const initial = usePlanner.getState();

beforeEach(() => {
  localStorage.clear();
  usePlanner.setState(initial, true);
});

describe('planner store', () => {
  it('selectMap resets task selection and spawn', () => {
    const s = usePlanner.getState();
    s.toggleTask('t-1');
    s.setSpawn({ kind: 'custom', position: { x: 1, y: 2, z: 3 } });
    usePlanner.getState().selectMap('map-a');
    const after = usePlanner.getState();
    expect(after.selectedMapId).toBe('map-a');
    expect(after.selectedTaskIds).toEqual([]);
    expect(after.spawn).toBeNull();
  });

  it('toggleTask adds then removes', () => {
    usePlanner.getState().toggleTask('t-1');
    expect(usePlanner.getState().selectedTaskIds).toEqual(['t-1']);
    usePlanner.getState().toggleTask('t-1');
    expect(usePlanner.getState().selectedTaskIds).toEqual([]);
  });

  it('toggleCompleted round-trips', () => {
    usePlanner.getState().toggleCompleted('t-9');
    expect(usePlanner.getState().tracker.completedTaskIds).toContain('t-9');
    usePlanner.getState().toggleCompleted('t-9');
    expect(usePlanner.getState().tracker.completedTaskIds).not.toContain('t-9');
  });

  it('has sensible tracker defaults', () => {
    const { tracker } = usePlanner.getState();
    expect(tracker).toEqual({
      level: 1,
      faction: 'Any',
      completedTaskIds: [],
      hideoutLevels: {},
      itemsHave: {},
      storyChapterIds: [],
    });
  });

  it('keeps PvP and PvE progress as separate profiles', () => {
    usePlanner.getState().setLevel(30);
    usePlanner.getState().toggleCompleted('t-pvp-quest');

    usePlanner.getState().setGameMode('pve');
    expect(usePlanner.getState().tracker.level).toBe(1); // fresh profile
    expect(usePlanner.getState().tracker.completedTaskIds).toEqual([]);
    usePlanner.getState().setLevel(7);

    usePlanner.getState().setGameMode('pvp');
    expect(usePlanner.getState().tracker.level).toBe(30);
    expect(usePlanner.getState().tracker.completedTaskIds).toEqual(['t-pvp-quest']);

    usePlanner.getState().setGameMode('pve');
    expect(usePlanner.getState().tracker.level).toBe(7);
  });

  it('switching mode clears the planned quest selection', () => {
    usePlanner.getState().toggleTask('t-1');
    usePlanner.getState().setGameMode('pve');
    expect(usePlanner.getState().selectedTaskIds).toEqual([]);
  });

  it('applyLogEvent auto-selects the detected map and completes quests', async () => {
    const { snapshot } = await import('@raidplanner/data');
    const withNameId = snapshot.maps.find((m) => m.nameId && m.calibration)!;
    usePlanner.getState().applyLogEvent({ type: 'map', nameId: withNameId.nameId! });
    expect(usePlanner.getState().selectedMapId).toBe(withNameId.id);
    expect(usePlanner.getState().lastAutoEvent).toContain(withNameId.name);

    const task = snapshot.tasks[0];
    usePlanner.getState().applyLogEvent({ type: 'task', taskId: task.id, status: 'finished' });
    expect(usePlanner.getState().tracker.completedTaskIds).toContain(task.id);
    // idempotent
    usePlanner.getState().applyLogEvent({ type: 'task', taskId: task.id, status: 'finished' });
    expect(
      usePlanner.getState().tracker.completedTaskIds.filter((id) => id === task.id),
    ).toHaveLength(1);
    // started events change nothing
    usePlanner.getState().applyLogEvent({ type: 'task', taskId: 'nope', status: 'started' });
    expect(usePlanner.getState().tracker.completedTaskIds).toHaveLength(1);
  });

  it('records finished quests the snapshot does not know yet', () => {
    // A game patch can ship quests before tarkov.dev has them; the completion
    // must survive so it shows up once the data catches up.
    const newQuestId = '69ffffffffffffffffffffff';
    usePlanner.getState().applyLogEvent({ type: 'task', taskId: newQuestId, status: 'finished' });
    expect(usePlanner.getState().tracker.completedTaskIds).toContain(newQuestId);
    expect(usePlanner.getState().lastAutoEvent).toMatch(/quest completed/i);
    // idempotent for unknown ids too
    usePlanner.getState().applyLogEvent({ type: 'task', taskId: newQuestId, status: 'finished' });
    expect(
      usePlanner.getState().tracker.completedTaskIds.filter((id) => id === newQuestId),
    ).toHaveLength(1);
    // log-parse noise that doesn't look like a task id is still dropped
    usePlanner.getState().applyLogEvent({ type: 'task', taskId: 'garbage line', status: 'finished' });
    expect(usePlanner.getState().tracker.completedTaskIds).not.toContain('garbage line');
  });

  it('migrates v1 persisted state to include hideoutLevels everywhere', () => {
    const migrate = usePlanner.persist.getOptions().migrate!;
    const migrated = migrate(
      {
        gameMode: 'pvp',
        tracker: { level: 33, faction: 'USEC', completedTaskIds: ['t-1'] },
        profiles: { pve: { level: 9, faction: 'Any', completedTaskIds: [] } },
      },
      1,
    ) as {
      tracker: { level: number; hideoutLevels?: Record<string, number> };
      profiles: Record<string, { hideoutLevels?: Record<string, number> }>;
    };
    expect(migrated.tracker.level).toBe(33);
    expect(migrated.tracker.hideoutLevels).toEqual({});
    expect(migrated.profiles.pve.hideoutLevels).toEqual({});
  });

  it('resetProgress wipes completions and returns to level 1', () => {
    usePlanner.getState().setLevel(42);
    usePlanner.getState().toggleCompleted('t-1');
    usePlanner.getState().resetProgress();
    expect(usePlanner.getState().tracker).toEqual({
      level: 1,
      faction: 'Any',
      completedTaskIds: [],
      hideoutLevels: {},
      itemsHave: {},
      storyChapterIds: [],
    });
  });

  it('persists state except the search box and live fix', async () => {
    usePlanner.getState().setSearch('sniper');
    usePlanner.getState().setLevel(42);
    usePlanner.getState().setLiveFix({
      position: { x: 1, y: 2, z: 3 },
      yawDeg: 45,
      takenAt: null,
      raw: 'x (0).png',
    });
    // persistence is async now (IndexedDB adapter; localStorage fallback in jsdom)
    await new Promise((resolve) => setTimeout(resolve, 0));
    const persisted = JSON.parse(localStorage.getItem('raidplanner-v1') ?? '{}');
    expect(persisted.state.tracker.level).toBe(42);
    expect(persisted.state.search).toBeUndefined();
    expect(persisted.state.liveFix).toBeUndefined();
  });

  it('setLiveFix round-trips', () => {
    const fix = { position: { x: 9, y: 0, z: -4 }, yawDeg: 180, takenAt: null, raw: 'y (0).png' };
    usePlanner.getState().setLiveFix(fix);
    expect(usePlanner.getState().liveFix).toEqual(fix);
    usePlanner.getState().setLiveFix(null);
    expect(usePlanner.getState().liveFix).toBeNull();
  });
});
