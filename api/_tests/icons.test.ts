import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../icons.js';

const makeReq = (method: string, id?: string): IncomingMessage =>
  ({ method, url: `/api/icons${id === undefined ? '' : `?id=${id}`}`, headers: {} }) as IncomingMessage;

function makeRes() {
  const res = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      res.headers[name] = value;
    },
    end(chunk?: string | Buffer) {
      res.body = chunk;
    },
  };
  return res as unknown as ServerResponse & { headers: Record<string, string>; body: unknown };
}

const VALID_ID = '5ac3b934156ae10c4430e83c';
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('/api/icons', () => {
  it('405 for non-GET', async () => {
    const res = makeRes();
    await handler(makeReq('POST', VALID_ID), res);
    expect(res.statusCode).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('400 for a malformed id (never reaches upstream)', async () => {
    for (const bad of ['', 'abc', '../secrets', `${VALID_ID}extra`, 'zzc3b934156ae10c4430e83c']) {
      const res = makeRes();
      await handler(makeReq('GET', bad), res);
      expect(res.statusCode, `id=${bad}`).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('proxies the icon with a long edge cache', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/webp' }),
      arrayBuffer: async () => bytes,
    });
    const res = makeRes();
    await handler(makeReq('GET', VALID_ID), res);
    expect(fetchMock).toHaveBeenCalledWith(`https://assets.tarkov.dev/${VALID_ID}-icon.webp`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/webp');
    expect(res.headers['cache-control']).toContain('s-maxage=2592000');
    expect(Buffer.isBuffer(res.body)).toBe(true);
  });

  it('404 when upstream has no icon', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    const res = makeRes();
    await handler(makeReq('GET', VALID_ID), res);
    expect(res.statusCode).toBe(404);
  });

  it('502 when upstream is down', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    const res = makeRes();
    await handler(makeReq('GET', VALID_ID), res);
    expect(res.statusCode).toBe(502);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
