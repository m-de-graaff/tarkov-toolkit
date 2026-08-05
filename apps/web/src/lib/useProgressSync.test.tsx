// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlanner } from '../store';
import type { SyncStatus } from './useProgressSync';
import { SYNC_VERSION, useProgressSync } from './useProgressSync';

vi.mock('./authClient', () => ({
  AUTH_ENABLED: true,
  parseAuthEnabled: () => true,
  authClient: {
    useSession: () => ({ data: { user: { id: 'user-1' } } }),
  },
}));

type FetchCall = { method: string; body?: unknown; keepalive?: boolean };

const okJson = (body: unknown, status = 200) =>
  ({ ok: true, status, json: () => Promise.resolve(body) }) as Response;
const noContent = () => ({ ok: true, status: 204 }) as Response;
const failure = () => ({ ok: false, status: 500 }) as Response;

function mockFetch(handlers: { get?: () => Promise<Response>; put?: () => Promise<Response> }) {
  const calls: FetchCall[] = [];
  const fn = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({
      method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      keepalive: init?.keepalive,
    });
    if (method === 'PUT') return handlers.put?.() ?? Promise.resolve(okJson({ ok: true }));
    return handlers.get?.() ?? Promise.resolve(noContent());
  });
  vi.stubGlobal('fetch', fn);
  return { calls, fn };
}

const puts = (calls: FetchCall[]) => calls.filter((c) => c.method === 'PUT');

function Harness({ onStatus }: { onStatus?: (s: SyncStatus) => void }) {
  useProgressSync(onStatus);
  return null;
}

const initial = usePlanner.getState();

describe('useProgressSync', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let statuses: SyncStatus[];

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    usePlanner.setState(initial, true);
    statuses = [];
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const mount = () =>
    act(() => root.render(<Harness onStatus={(s) => statuses.push(s)} />));
  const settle = () => act(async () => {}); // flush microtasks
  const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

  it('pulls, merges, and establishes the server copy on sign-in', async () => {
    const { calls } = mockFetch({
      get: () =>
        Promise.resolve(
          okJson({
            version: SYNC_VERSION,
            state: {
              gameMode: 'pvp',
              tracker: { ...initial.tracker, completedTaskIds: ['remote-quest'] },
              profiles: {},
            },
            updatedAt: new Date().toISOString(),
          }),
        ),
    });
    await mount();
    await settle();
    expect(usePlanner.getState().tracker.completedTaskIds).toContain('remote-quest');
    expect(puts(calls)).toHaveLength(1);
    expect(statuses.at(-1)).toBe('synced');
    expect(localStorage.getItem('raidplanner-last-user')).toBe('user-1');
  });

  it('refuses to merge or push when the server schema is newer', async () => {
    const before = usePlanner.getState().tracker;
    const { calls } = mockFetch({
      get: () =>
        Promise.resolve(
          okJson({
            version: SYNC_VERSION + 1,
            state: { gameMode: 'pvp', tracker: initial.tracker, profiles: {} },
          }),
        ),
    });
    await mount();
    await settle();
    // even a local change must not reach the server from a stale bundle
    act(() => usePlanner.getState().setLevel(55));
    await advance(60000);
    expect(puts(calls)).toHaveLength(0);
    expect(statuses.at(-1)).toBe('error');
    expect(usePlanner.getState().tracker.level).toBe(55);
    expect(before.completedTaskIds).toEqual(usePlanner.getState().tracker.completedTaskIds);
  });

  it('does not drop edits made during the pull window', async () => {
    let resolvePull!: (r: Response) => void;
    const { calls } = mockFetch({
      get: () => new Promise<Response>((r) => (resolvePull = r)),
    });
    await mount();
    // edit while the pull is still in flight
    act(() => usePlanner.getState().setLevel(42));
    act(() => resolvePull(noContent()));
    await settle(); // pull resolves, initial push issued
    await advance(4000); // pending-during-pull change gets its debounced push
    const p = puts(calls);
    expect(p.length).toBeGreaterThanOrEqual(2);
    const last = p.at(-1)!.body as { state: { tracker: { level: number } } };
    expect(last.state.tracker.level).toBe(42);
  });

  it('retries a failed push with backoff and recovers', async () => {
    let putFails = true;
    const { calls } = mockFetch({
      put: () => Promise.resolve(putFails ? failure() : okJson({ ok: true })),
    });
    await mount();
    await settle(); // pull 204; initial PUT fails, schedules retry
    const afterInitial = puts(calls).length;
    putFails = false;
    await advance(5000); // first backoff step
    expect(puts(calls).length).toBeGreaterThan(afterInitial);
    expect(statuses.at(-1)).toBe('synced');
  });

  it('a failed push retries when connectivity returns', async () => {
    let putFails = true;
    const { calls } = mockFetch({
      put: () => Promise.resolve(putFails ? failure() : okJson({ ok: true })),
    });
    await mount();
    await settle();
    act(() => usePlanner.getState().setLevel(33));
    await advance(3000); // debounce fires, PUT fails
    expect(statuses.at(-1)).toBe('error');
    putFails = false;
    const before = puts(calls).length;
    act(() => void window.dispatchEvent(new Event('online')));
    await settle();
    expect(puts(calls).length).toBe(before + 1);
    expect(statuses.at(-1)).toBe('synced');
  });

  it('flushes unsent changes with keepalive when the tab hides', async () => {
    const { calls } = mockFetch({});
    await mount();
    await settle();
    act(() => usePlanner.getState().setLevel(21));
    // debounce has not fired yet; hiding the tab must flush immediately
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    await settle();
    const last = puts(calls).at(-1)!;
    expect(last.keepalive).toBe(true);
    expect((last.body as { state: { tracker: { level: number } } }).state.tracker.level).toBe(21);
  });
});
