import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runMigrations = vi.fn();
vi.mock('better-auth/db/migration', () => ({
  getMigrations: vi.fn(async () => ({ runMigrations })),
}));
vi.mock('../_lib/auth.js', () => ({ auth: { options: {} } }));
vi.mock('../_lib/db.js', () => ({ pool: { query: vi.fn() } }));

import { pool } from '../_lib/db.js';
import handler from '../setup.js';

const query = vi.mocked(pool.query);

const makeReq = (method: string, key?: string) =>
  ({ method, headers: key === undefined ? {} : { 'x-setup-key': key } }) as unknown as IncomingMessage;

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

beforeEach(() => {
  process.env.DATABASE_URL = 'postgres://test';
  process.env.SETUP_SECRET = 'the-setup-secret';
  vi.clearAllMocks();
});
afterEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.SETUP_SECRET;
});

describe('/api/setup', () => {
  it('401 when SETUP_SECRET is not configured, regardless of header', async () => {
    delete process.env.SETUP_SECRET;
    const res = makeRes();
    await handler(makeReq('POST', 'anything'), res);
    expect(res.statusCode).toBe(401);
  });

  it('401 on a wrong key', async () => {
    const res = makeRes();
    await handler(makeReq('POST', 'wrong'), res);
    expect(res.statusCode).toBe(401);
    expect(runMigrations).not.toHaveBeenCalled();
  });

  it('401 on non-POST even with the right key', async () => {
    const res = makeRes();
    await handler(makeReq('GET', 'the-setup-secret'), res);
    expect(res.statusCode).toBe(401);
  });

  it('runs migrations and creates the progress and feedback tables', async () => {
    query.mockResolvedValue({ rows: [] } as never);
    const res = makeRes();
    await handler(makeReq('POST', 'the-setup-secret'), res);
    expect(res.statusCode).toBe(200);
    expect(runMigrations).toHaveBeenCalledOnce();
    const ddl = query.mock.calls.map(([sql]) => String(sql));
    expect(ddl.some((s) => s.includes('CREATE TABLE IF NOT EXISTS progress'))).toBe(true);
    expect(ddl.some((s) => s.includes('CREATE TABLE IF NOT EXISTS feedback'))).toBe(true);
  });
});
