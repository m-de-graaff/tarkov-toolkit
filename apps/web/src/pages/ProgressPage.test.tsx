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

  it('defaults to the quests tab; ?tab=story shows the storyline instead', () => {
    act(() =>
      root.render(
        <MemoryRouter initialEntries={['/progress?tab=story']}>
          <ProgressPage />
        </MemoryRouter>,
      ),
    );
    expect(container.textContent).toContain('chapters');
    expect(container.textContent).toContain('Tour');
    // quest list UI is not mounted on the story tab
    expect(container.querySelector('input[type=search]')).toBeNull();
    expect(container.querySelectorAll('.quest-row')).toHaveLength(0);
  });

  it('switching to the Story tab swaps the content', () => {
    act(() => root.render(<MemoryRouter><ProgressPage /></MemoryRouter>));
    expect(container.querySelector('input[type=search]')).toBeTruthy();

    const trigger = [...container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(
      (t) => t.textContent === 'Story',
    )!;
    // radix tabs activate on mousedown
    act(() => {
      trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });
    expect(container.textContent).toContain('Tour');
    expect(container.querySelector('input[type=search]')).toBeNull();
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

  const setSearch = (value: string) => {
    const input = container.querySelector<HTMLInputElement>('input[type=search]')!;
    const nativeSet = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!;
    act(() => {
      nativeSet.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  it('the All view shows what is open now, not every trader list stacked', () => {
    act(() => root.render(<MemoryRouter><ProgressPage /></MemoryRouter>));
    expect(container.textContent).toContain('Open now');
    expect(container.textContent).toContain('By trader');
    const allChip = [...container.querySelectorAll('button')].find((b) => b.textContent === 'All')!;
    expect(allChip.getAttribute('aria-pressed')).toBe('true');
    // far fewer rows than the full quest count - only open quests render
    const pvpCount = snapshot.tasks.filter((t) => t.modes.includes('pvp')).length;
    expect(container.querySelectorAll('.quest-row').length).toBeLessThan(pvpCount / 4);
  });

  it('selecting a trader groups quests and explains every lock', () => {
    act(() => root.render(<MemoryRouter><ProgressPage /></MemoryRouter>));
    const ragman = [...container.querySelectorAll<HTMLButtonElement>('.trader-rail button')].find(
      (b) => b.textContent?.startsWith('Ragman'),
    )!;
    act(() => ragman.click());
    expect(container.textContent).toContain('Locked');
    const lockedSection = container.querySelector('[aria-label="Locked quests"]')!;
    const rows = lockedSection.querySelectorAll('.quest-row');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.textContent).toMatch(/Lv \d+|after |USEC only|BEAR only/);
    }
  });

  it('completed quests collapse behind a details section', () => {
    const ragmanTask = snapshot.tasks.find(
      (t) => t.trader.name === 'Ragman' && t.modes.includes('pvp'),
    )!;
    act(() => {
      usePlanner.getState().toggleCompleted(ragmanTask.id);
      root.render(<MemoryRouter initialEntries={['/progress?trader=Ragman']}><ProgressPage /></MemoryRouter>);
    });
    const details = container.querySelector<HTMLDetailsElement>('details')!;
    expect(details.open).toBe(false);
    expect(details.textContent).toContain('Completed');
    act(() => {
      details.open = true;
      details.dispatchEvent(new Event('toggle'));
    });
    expect(details.querySelector('.quest-row')?.textContent).toContain(ragmanTask.name);
  });

  it('searching surfaces locked quests too, with pve-only quests gated by mode', () => {
    const pveOnly = snapshot.tasks.find((t) => t.modes.length === 1 && t.modes[0] === 'pve')!;

    act(() => root.render(<MemoryRouter><ProgressPage /></MemoryRouter>));
    setSearch(pveOnly.name);
    expect(container.textContent).not.toContain(pveOnly.name);

    act(() => usePlanner.getState().setGameMode('pve'));
    expect(container.textContent).toContain(pveOnly.name);
  });

  it('the kappa and unlocks chips narrow the open list', () => {
    act(() => {
      usePlanner.getState().setLevel(30);
      root.render(<MemoryRouter><ProgressPage /></MemoryRouter>);
    });
    const chip = (label: string) =>
      [...container.querySelectorAll('button')].find((b) => b.textContent === label)!;

    act(() => chip('Kappa only').click());
    const kappaRows = [...container.querySelectorAll('.quest-row')];
    expect(kappaRows.length).toBeGreaterThan(0);
    for (const row of kappaRows) expect(row.textContent).toContain('KAPPA');
    act(() => chip('Kappa only').click());

    act(() => chip('Unlocks quests').click());
    const rows = [...container.querySelectorAll('.quest-row')];
    expect(rows.length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('dead end');
  });

  it('typed level values are clamped into 1-79', () => {
    act(() => root.render(<MemoryRouter><ProgressPage /></MemoryRouter>));
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
