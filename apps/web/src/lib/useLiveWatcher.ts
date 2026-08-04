import { parseScreenshotName, pickNewestFix } from '@raidplanner/live';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlanner } from '../store';

const POLL_MS = 2000;

export interface LiveWatcher {
  supported: boolean;
  connected: boolean;
  connect(): Promise<void>;
  disconnect(): void;
  error: string | null;
}

/**
 * Watches the EFT Screenshots folder (user-granted, read-only) by polling the
 * directory every 2s; new screenshots become live fixes in the planner store.
 */
export function useLiveWatcher(): LiveWatcher {
  const supported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const cleanupListenersRef = useRef<(() => void) | null>(null);
  const setLiveFix = usePlanner((s) => s.setLiveFix);

  const disconnect = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    cleanupListenersRef.current?.();
    cleanupListenersRef.current = null;
    seenRef.current = new Set();
    setConnected(false);
    setLiveFix(null);
  }, [setLiveFix]);

  useEffect(() => disconnect, [disconnect]);

  const connect = useCallback(async () => {
    setError(null);
    let handle: FileSystemDirectoryHandle;
    try {
      handle = await window.showDirectoryPicker({ mode: 'read' });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // user cancelled
      setError('Could not open the folder. Grant read access and try again.');
      return;
    }

    const listNames = async () => {
      const names: string[] = [];
      for await (const entry of handle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.png')) names.push(entry.name);
      }
      return names;
    };

    const poll = async () => {
      try {
        const newest = pickNewestFix(await listNames(), seenRef.current);
        if (newest) {
          const fix = parseScreenshotName(newest);
          if (fix) setLiveFix(fix);
        }
      } catch {
        setError('Lost access to the screenshots folder.');
        disconnect();
      }
    };

    // The screenshot you already took counts: the newest existing screenshot
    // becomes the initial fix (its capture time is in the filename, so the UI
    // can show how old it is). Everything else is just marked as seen.
    seenRef.current = new Set();
    await poll();

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(poll, POLL_MS);

    // Background tabs get throttled timers; poll immediately when the user
    // tabs back from the game so the fix appears without waiting.
    const onVisible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    cleanupListenersRef.current = () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };

    setConnected(true);
  }, [disconnect, setLiveFix]);

  return { supported, connected, connect, disconnect, error };
}
