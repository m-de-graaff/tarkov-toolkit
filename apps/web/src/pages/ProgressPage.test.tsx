// @vitest-environment jsdom
import { snapshot } from '@raidplanner/data';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { usePlanner } from '../store';
import { ProgressPage } from './ProgressPage';

const initial = usePlanner.getState();

describe('ProgressPage', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    usePlanner.setState(initial, true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('ticking a quest updates the tracker and the finished count', () => {
    act(() => root.render(<ProgressPage />));
    expect(container.textContent).toContain(`0 of ${snapshot.tasks.length} quests finished`);

    const checkbox = container.querySelector<HTMLInputElement>('.quest-row input[type=checkbox]')!;
    act(() => checkbox.click());

    expect(usePlanner.getState().tracker.completedTaskIds).toHaveLength(1);
    expect(container.textContent).toContain(`1 of ${snapshot.tasks.length} quests finished`);
  });

  it('reset requires a second, explicit click', () => {
    act(() => {
      usePlanner.getState().toggleCompleted(snapshot.tasks[0].id);
      root.render(<ProgressPage />);
    });

    const buttons = () => [...container.querySelectorAll('button')];
    act(() => buttons().find((b) => b.textContent?.includes('Reset progress'))!.click());
    // arming does not wipe anything yet
    expect(usePlanner.getState().tracker.completedTaskIds).toHaveLength(1);

    act(() => buttons().find((b) => b.textContent?.includes('Yes, wipe my progress'))!.click());
    expect(usePlanner.getState().tracker.completedTaskIds).toHaveLength(0);
    expect(usePlanner.getState().tracker.level).toBe(1);
  });
});
