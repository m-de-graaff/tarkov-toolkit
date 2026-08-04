// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlanner } from '../store';
import type { LiveWatcher } from './useLiveWatcher';
import { useLiveWatcher } from './useLiveWatcher';

const SHOT_OLD = '2026-08-05[00-04]_179.37, 18.38, -6.33_-0.03947, 0.18638, 0.05768, -0.97999_13.54 (0).png';
const SHOT_OLDER = '2026-08-04[23-50]_10.00, 0.00, 20.00_0.0, 0.0, 0.0, 1.0 (0).png';

function fakeDirectoryHandle(names: string[]) {
  return {
    kind: 'directory' as const,
    name: 'Screenshots',
    async *values() {
      for (const name of names) {
        yield { kind: 'file' as const, name };
      }
    },
  };
}

function HookHarness({ onReady }: { onReady: (w: LiveWatcher) => void }) {
  onReady(useLiveWatcher());
  return null;
}

const initial = usePlanner.getState();

describe('useLiveWatcher', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let watcher: LiveWatcher;

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
    delete (window as { showDirectoryPicker?: unknown }).showDirectoryPicker;
  });

  it('uses the newest existing screenshot as the initial fix on connect', async () => {
    (window as { showDirectoryPicker?: unknown }).showDirectoryPicker = async () =>
      fakeDirectoryHandle([SHOT_OLDER, SHOT_OLD, 'inventory.png']);

    act(() => root.render(<HookHarness onReady={(w) => (watcher = w)} />));
    await act(async () => {
      await watcher.connect();
    });

    const fix = usePlanner.getState().liveFix;
    expect(fix).not.toBeNull();
    expect(fix!.position).toEqual({ x: 179.37, y: 18.38, z: -6.33 });
    expect(fix!.takenAt).toBe('2026-08-05[00-04]');
  });

  it('detects a screenshot that appears after connecting (the watch path)', async () => {
    const names: string[] = ['inventory.png'];
    (window as { showDirectoryPicker?: unknown }).showDirectoryPicker = async () =>
      fakeDirectoryHandle(names);

    vi.useFakeTimers();
    try {
      act(() => root.render(<HookHarness onReady={(w) => (watcher = w)} />));
      await act(async () => {
        await watcher.connect();
      });
      expect(usePlanner.getState().liveFix).toBeNull();

      // a screenshot lands in the folder mid-raid…
      names.push(SHOT_OLD);
      // …and the next 2s poll must pick it up
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2100);
      });

      const fix = usePlanner.getState().liveFix;
      expect(fix).not.toBeNull();
      expect(fix!.position).toEqual({ x: 179.37, y: 18.38, z: -6.33 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('sets no fix when the folder has no screenshots yet', async () => {
    (window as { showDirectoryPicker?: unknown }).showDirectoryPicker = async () =>
      fakeDirectoryHandle(['desktop.ini']);

    act(() => root.render(<HookHarness onReady={(w) => (watcher = w)} />));
    await act(async () => {
      await watcher.connect();
    });

    expect(usePlanner.getState().liveFix).toBeNull();
  });
});
