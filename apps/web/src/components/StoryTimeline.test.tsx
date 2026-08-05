// @vitest-environment jsdom
import { snapshot } from '@raidplanner/data';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { storyChapters } from '../data/storyline';
import { usePlanner } from '../store';
import { StoryTimeline } from './StoryTimeline';

const initial = usePlanner.getState();

const render = (root: ReturnType<typeof createRoot>) =>
  act(() =>
    root.render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<StoryTimeline />} />
          <Route path="/planner" element={<p>PLANNER PAGE</p>} />
        </Routes>
      </MemoryRouter>,
    ),
  );

describe('StoryTimeline', () => {
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

  it('marks the first unfinished chapter as current, with its start instructions', () => {
    render(root);
    expect(container.textContent).toContain('Current chapter');
    expect(container.textContent).toContain(storyChapters[0].name);
    expect(container.textContent).toContain(storyChapters[0].start);
    expect(container.textContent).toContain('How to start');
  });

  it('advances the current marker when a chapter is ticked off', () => {
    render(root);
    const first = container.querySelector<HTMLInputElement>('input[type=checkbox]')!;
    act(() => first.click());
    expect(usePlanner.getState().tracker.storyChapterIds).toContain(storyChapters[0].id);
    // chapter 2's start text is now front and center in the current card
    expect(container.textContent).toContain(storyChapters[1].start);
    expect(container.textContent).toContain('1/10 chapters');
  });

  it('map chips open the planner with that map selected', () => {
    render(root);
    const chip = container.querySelector<HTMLButtonElement>('.story-map-chip')!;
    const label = chip.textContent!.replace(/^Starts on /, '');
    act(() => chip.click());
    expect(container.textContent).toContain('PLANNER PAGE');
    const selected = snapshot.maps.find((m) => m.id === usePlanner.getState().selectedMapId);
    expect(selected?.name).toBe(label);
  });
});
