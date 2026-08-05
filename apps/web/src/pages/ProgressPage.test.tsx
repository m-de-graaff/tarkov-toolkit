// @vitest-environment jsdom
import { snapshot } from '@raidplanner/data';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
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
    const pvpCount = snapshot.tasks.filter((t) => t.modes.includes('pvp')).length;
    act(() => root.render(<MemoryRouter><ProgressPage /></MemoryRouter>));
    expect(container.textContent).toContain(`0 of ${pvpCount} quests finished`);

    const checkbox = container.querySelector<HTMLInputElement>('.quest-row input[type=checkbox]')!;
    act(() => checkbox.click());

    expect(usePlanner.getState().tracker.completedTaskIds).toHaveLength(1);
    expect(container.textContent).toContain(`1 of ${pvpCount} quests finished`);
  });

  it('shows pve-only quests only when the PvE profile is active', () => {
    const pveOnly = snapshot.tasks.find((t) => t.modes.length === 1 && t.modes[0] === 'pve')!;

    act(() => root.render(<MemoryRouter><ProgressPage /></MemoryRouter>));
    expect(container.textContent).not.toContain(pveOnly.name);

    act(() => usePlanner.getState().setGameMode('pve'));
    expect(container.textContent).toContain(pveOnly.name);
  });

  it('filter chips hide locked and non-kappa quests', () => {
    act(() => root.render(<MemoryRouter><ProgressPage /></MemoryRouter>));
    const rowsBefore = container.querySelectorAll('.quest-row').length;

    const chip = (label: string) =>
      [...container.querySelectorAll('button')].find((b) => b.textContent === label)!;

    act(() => chip('Locked').click());
    const rowsUnlockedOnly = container.querySelectorAll('.quest-row').length;
    expect(rowsUnlockedOnly).toBeLessThan(rowsBefore);

    act(() => chip('Locked').click()); // back on
    act(() => chip('Kappa only').click());
    const kappaRows = container.querySelectorAll('.quest-row').length;
    const kappaCount = snapshot.tasks.filter(
      (t) => t.modes.includes('pvp') && t.kappaRequired,
    ).length;
    expect(kappaRows).toBe(kappaCount);
  });

  it('the unlocks-quests chip hides dead-end quests', () => {
    act(() => root.render(<MemoryRouter><ProgressPage /></MemoryRouter>));
    const before = container.querySelectorAll('.quest-row').length;
    const chip = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Unlocks quests',
    )!;
    act(() => chip.click());
    const after = container.querySelectorAll('.quest-row').length;
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);
    // none of the visible rows are dead ends
    expect(container.textContent).not.toContain('dead end');
  });

  it('typed level values are clamped into 1-79', () => {
    act(() => root.render(<ProgressPage />));
    const level = container.querySelector<HTMLInputElement>('input[type=number]')!;
    const nativeSet = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!;

    const type = (v: string) =>
      act(() => {
        nativeSet.call(level, v);
        level.dispatchEvent(new Event('input', { bubbles: true }));
      });

    type('999');
    expect(usePlanner.getState().tracker.level).toBe(79);
    type('0');
    expect(usePlanner.getState().tracker.level).toBe(1);
    type('42');
    expect(usePlanner.getState().tracker.level).toBe(42);
  });

  it('reset requires a second, explicit click', () => {
    act(() => {
      usePlanner.getState().toggleCompleted(snapshot.tasks[0].id);
      root.render(<MemoryRouter><ProgressPage /></MemoryRouter>);
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
