import { parseScreenshotName, pickNewestFix } from '@raidplanner/live';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlanner } from '../store';

const POLL_MS = 2000;
const COMPANION_URL = 'ws://127.0.0.1:17520';
const COMPANION_RETRY_MS = 5000;

export interface LiveWatcher {
  supported: boolean;
  connected: boolean;
  /** true when the standalone companion watcher is feeding positions */
  companion: boolean;
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
  const [companion, setCompanion] = useState(false);
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

  // Companion transport: quietly try the standalone watcher and keep retrying;
  // when it's running, positions arrive with no folder picker at all.
  useEffect(() => {
    if (typeof WebSocket === 'undefined') return;
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const scheduleRetry = () => {
      if (!disposed && retry === null) {
        retry = setTimeout(() => {
          retry = null;
          open();
        }, COMPANION_RETRY_MS);
      }
    };

    const open = () => {
      if (disposed) return;
      try {
        ws = new WebSocket(COMPANION_URL);
      } catch {
        scheduleRetry();
        return;
      }
      ws.onopen = () => setCompanion(true);
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data));
          if (message.type === 'fix' && message.fix) setLiveFix(message.fix);
        } catch {
          /* malformed frame — ignore */
        }
      };
      ws.onclose = () => {
        setCompanion(false);
        scheduleRetry();
      };
      ws.onerror = () => ws?.close();
    };

    open();
    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [setLiveFix]);

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

  return { supported, connected, companion, connect, disconnect, error };
}
