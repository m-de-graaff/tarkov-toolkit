import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../_lib/auth.js', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('../_lib/db.js', () => ({ pool: { query: vi.fn() } }));

import { auth } from '../_lib/auth.js';
import { pool } from '../_lib/db.js';
import handler from '../progress.js';

const getSession = vi.mocked(auth.api.getSession);
const query = vi.mocked(pool.query);

function makeReq(method: string, rawBody?: string): IncomingMessage {
  const req = rawBody === undefined ? Readable.from([]) : Readable.from([Buffer.from(rawBody)]);
  return Object.assign(req, { method, headers: {} }) as unknown as IncomingMessage;
}

function makeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    setHeader: vi.fn(),
    end(chunk?: string) {
      res.body = chunk === undefined ? undefined : JSON.parse(chunk);
    },
  };
  return res as unknown as ServerResponse & { body: unknown };
}

const validState = {
  gameMode: 'pvp',
  tracker: { level: 10, faction: 'Any', completedTaskIds: ['a'], hideoutLevels: {}, itemsHave: {} },
  profiles: {},
};

const signIn = () =>
  getSession.mockResolvedValue({ user: { id: 'user-1' } } as Awaited<ReturnType<typeof auth.api.getSession>>);

beforeEach(() => {
  process.env.DATABASE_URL = 'postgres://test';
  vi.resetAllMocks();
});
afterEach(() => {
  delete process.env.DATABASE_URL;
});

describe('/api/progress', () => {
  it('503 when the deployment has no database', async () => {
    delete process.env.DATABASE_URL;
    const res = makeRes();
    await handler(makeReq('GET'), res);
    expect(res.statusCode).toBe(503);
  });

  it('401 when not signed in', async () => {
    getSession.mockResolvedValue(null);
    const res = makeRes();
    await handler(makeReq('GET'), res);
    expect(res.statusCode).toBe(401);
  });

  it('GET 204 when nothing stored', async () => {
    signIn();
    query.mockResolvedValue({ rows: [] } as never);
    const res = makeRes();
    await handler(makeReq('GET'), res);
    expect(res.statusCode).toBe(204);
  });

  it('GET returns the stored payload', async () => {
    signIn();
    query.mockResolvedValue({
      rows: [{ version: 3, state: validState, updated_at: '2026-08-05T00:00:00Z' }],
    } as never);
    const res = makeRes();
    await handler(makeReq('GET'), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ version: 3, state: validState });
  });

  it('GET 500 with a generic message on db failure', async () => {
    signIn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    query.mockRejectedValue(new Error('relation "progress" does not exist'));
    const res = makeRes();
    await handler(makeReq('GET'), res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'database error' }); // no db detail leaks
  });

  it('PUT 400 on unparsable json', async () => {
    signIn();
    const res = makeRes();
    await handler(makeReq('PUT', '{oops'), res);
    expect(res.statusCode).toBe(400);
  });

  it('PUT 400 without version/state', async () => {
    signIn();
    const res = makeRes();
    await handler(makeReq('PUT', JSON.stringify({ state: validState })), res);
    expect(res.statusCode).toBe(400);
  });

  it('PUT 400 on an invalid state shape, naming the field', async () => {
    signIn();
    const res = makeRes();
    const bad = { ...validState, tracker: { ...validState.tracker, completedTaskIds: 'oops' } };
    await handler(makeReq('PUT', JSON.stringify({ version: 3, state: bad })), res);
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toContain('completedTaskIds');
    expect(query).not.toHaveBeenCalled();
  });

  it('PUT 200 stores a valid payload', async () => {
    signIn();
    query.mockResolvedValue({ rows: [{ user_id: 'user-1' }] } as never);
    const res = makeRes();
    await handler(makeReq('PUT', JSON.stringify({ version: 3, state: validState })), res);
    expect(res.statusCode).toBe(200);
    expect(query).toHaveBeenCalledOnce();
  });

  it('PUT 429 when writing faster than the per-user floor', async () => {
    signIn();
    query.mockResolvedValue({ rows: [] } as never);
    const res = makeRes();
    await handler(makeReq('PUT', JSON.stringify({ version: 3, state: validState })), res);
    expect(res.statusCode).toBe(429);
  });

  it('PUT 500 with a generic message on db failure', async () => {
    signIn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    query.mockRejectedValue(new Error('boom'));
    const res = makeRes();
    await handler(makeReq('PUT', JSON.stringify({ version: 3, state: validState })), res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'database error' });
  });

  it('405 for other methods', async () => {
    signIn();
    const res = makeRes();
    await handler(makeReq('DELETE'), res);
    expect(res.statusCode).toBe(405);
  });
});
