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
    expect(tracker).toEqual({ level: 15, faction: 'Any', completedTaskIds: [] });
  });

  it('resetProgress wipes completions and returns to level 1', () => {
    usePlanner.getState().setLevel(42);
    usePlanner.getState().toggleCompleted('t-1');
    usePlanner.getState().resetProgress();
    expect(usePlanner.getState().tracker).toEqual({
      level: 1,
      faction: 'Any',
      completedTaskIds: [],
    });
  });

  it('persists state except the search box and live fix', () => {
    usePlanner.getState().setSearch('sniper');
    usePlanner.getState().setLevel(42);
    usePlanner.getState().setLiveFix({
      position: { x: 1, y: 2, z: 3 },
      yawDeg: 45,
      takenAt: null,
      raw: 'x (0).png',
    });
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
