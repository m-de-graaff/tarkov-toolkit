// Progress sync endpoint: one JSON blob of tracker state per user.
// GET  -> { version, state, updatedAt } | 204 when nothing stored yet
// PUT  <- { version, state }            (last write wins; merging is client-side)
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './_lib/auth.js';
import { pool } from './_lib/db.js';
import { validateSyncedState } from './_lib/validateProgress.js';

const MAX_BYTES = 1_000_000; // tracker state is a few KB; 1MB is generous

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BYTES) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const json = (res: ServerResponse, status: number, body?: unknown) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(body === undefined ? undefined : JSON.stringify(body));
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!process.env.DATABASE_URL) {
    json(res, 503, { error: 'accounts are not configured on this deployment' });
    return;
  }
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    json(res, 401, { error: 'not signed in' });
    return;
  }
  const userId = session.user.id;

  if (req.method === 'GET') {
    try {
      const { rows } = await pool.query(
        'SELECT version, state, updated_at FROM progress WHERE user_id = $1',
        [userId],
      );
      if (rows.length === 0) {
        json(res, 204);
        return;
      }
      json(res, 200, {
        version: rows[0].version,
        state: rows[0].state,
        updatedAt: new Date(rows[0].updated_at).toISOString(),
      });
    } catch (err) {
      console.error('progress GET db error:', err);
      json(res, 500, { error: 'database error' });
    }
    return;
  }

  if (req.method === 'PUT') {
    let payload: { version?: number; state?: unknown };
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      json(res, 400, { error: 'invalid body' });
      return;
    }
    if (typeof payload.version !== 'number' || payload.state === null || typeof payload.state !== 'object') {
      json(res, 400, { error: 'expected { version, state }' });
      return;
    }
    const invalid = validateSyncedState(payload.state);
    if (invalid) {
      json(res, 400, { error: invalid });
      return;
    }
    try {
      // the WHERE clause is a per-user write floor: the client debounces at
      // 3s, so anything faster than 1/s is not a real client
      const { rows } = await pool.query(
        `INSERT INTO progress (user_id, version, state, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (user_id) DO UPDATE
         SET version = EXCLUDED.version, state = EXCLUDED.state, updated_at = now()
         WHERE progress.updated_at < now() - interval '1 second'
         RETURNING user_id`,
        [userId, payload.version, JSON.stringify(payload.state)],
      );
      if (rows.length === 0) {
        json(res, 429, { error: 'too many writes' });
        return;
      }
      json(res, 200, { ok: true });
    } catch (err) {
      console.error('progress PUT db error:', err);
      json(res, 500, { error: 'database error' });
    }
    return;
  }

  json(res, 405, { error: 'method not allowed' });
}
