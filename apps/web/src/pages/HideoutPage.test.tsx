// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { usePlanner } from '../store';
import { HideoutPage } from './HideoutPage';

const page = (
  <MemoryRouter>
    <HideoutPage />
  </MemoryRouter>
);

const initial = usePlanner.getState();

describe('HideoutPage', () => {
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

  it('renders without looping when the tracker predates hideoutLevels', () => {
    // simulate state persisted before the hideout feature: no hideoutLevels key
    usePlanner.setState((s) => ({
      tracker: { level: s.tracker.level, faction: s.tracker.faction, completedTaskIds: [] },
    }));
    expect(usePlanner.getState().tracker.hideoutLevels).toBeUndefined();

    // an unstable selector snapshot makes this render loop until React throws
    act(() => root.render(page));
    expect(container.querySelectorAll('.hideout-station').length).toBeGreaterThan(20);
  });

  it('build is gated on collected items and consumes them when built', async () => {
    const { snapshot } = await import('@raidplanner/data');
    // a station whose level 1 has item requirements and no station prereqs
    const station = snapshot.hideout.find(
      (s) =>
        s.levels[0]?.itemRequirements.length &&
        s.levels[0].stationLevelRequirements.length === 0,
    )!;
    act(() => root.render(page));

    const card = [...container.querySelectorAll('.hideout-station')].find((el) =>
      el.querySelector('h3')?.textContent === station.name,
    )!;
    const buildButton = card.querySelector<HTMLButtonElement>('button[title*="Collect the missing"]');
    expect(buildButton?.disabled).toBe(true);

    // collect everything level 1 needs
    act(() => {
      for (const req of station.levels[0].itemRequirements) {
        usePlanner.getState().setItemHave(req.itemId, req.count);
      }
    });
    const readyButton = [...card.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Build level 1'),
    )!;
    expect(readyButton.disabled).toBe(false);
    act(() => readyButton.click());

    expect(usePlanner.getState().tracker.hideoutLevels?.[station.id]).toBe(1);
    // materials were consumed
    for (const req of station.levels[0].itemRequirements) {
      expect(usePlanner.getState().tracker.itemsHave?.[req.itemId]).toBe(0);
    }
  });
});
