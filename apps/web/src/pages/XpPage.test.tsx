// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { skillGuides } from '../data/skillGuides';
import { usePlanner } from '../store';
import { XpPage } from './XpPage';

const initial = usePlanner.getState();

const page = (
  <MemoryRouter>
    <XpPage />
  </MemoryRouter>
);

describe('XpPage', () => {
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

  it('renders every curated skill and the crafting section', async () => {
    await act(async () => root.render(page));
    for (const guide of skillGuides) {
      expect(container.textContent).toContain(guide.name);
    }
    expect(container.textContent).toContain('best crafts per station');
    expect(container.textContent).toContain('Shortest, any price');
  });

  it('search filters skills by method text', async () => {
    await act(async () => root.render(page));
    const input = container.querySelector<HTMLInputElement>('input[type=search]')!;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )!.set!;
      setter.call(input, 'grenades');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.textContent).toContain('Strength');
    expect(container.textContent).not.toContain('Covert Movement');
  });
});
