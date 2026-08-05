// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountMenu } from './AccountMenu';

vi.mock('../lib/authClient', () => ({
  AUTH_ENABLED: true,
  parseAuthEnabled: () => true,
  authClient: {
    useSession: () => ({ data: null }),
    signOut: vi.fn(),
    signIn: { email: vi.fn() },
    signUp: { email: vi.fn() },
  },
}));
vi.mock('../lib/useProgressSync', () => ({
  useProgressSync: () => {},
  SYNC_VERSION: 3,
}));

describe('AccountMenu', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const trigger = () =>
    [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Sign in'))!;

  it('opens a labelled dialog and moves focus into it', () => {
    act(() => root.render(<AccountMenu />));
    act(() => trigger().click());
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-label')).toBe('Sign in');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('Escape closes and returns focus to the trigger', () => {
    act(() => root.render(<AccountMenu />));
    const t = trigger();
    act(() => t.click());
    const dialog = container.querySelector('[role="dialog"]')!;
    act(() => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(t);
  });

  it('the click-away scrim is not focusable', () => {
    act(() => root.render(<AccountMenu />));
    act(() => trigger().click());
    const scrim = container.querySelector('[aria-hidden="true"].fixed');
    expect(scrim).toBeTruthy();
    expect(scrim!.tagName).not.toBe('BUTTON');
    expect(scrim!.getAttribute('tabindex')).toBeNull();
  });
});
