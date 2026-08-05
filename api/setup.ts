// One-time schema setup, run where DATABASE_URL actually lives (the Neon
// integration marks it sensitive, so it cannot be pulled to a dev machine).
// POST with header x-setup-key: $SETUP_SECRET - a dedicated secret, NOT the
// session-signing secret (a leak of either must not compromise the other).
// Idempotent; remove the route once the deployment is set up if you prefer a
// smaller surface.
import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { getMigrations } from 'better-auth/db/migration';
import { auth } from './_lib/auth.js';
import { pool } from './_lib/db.js';

// hash both sides so the comparison is constant-time regardless of length
const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();

function keyMatches(provided: string | string[] | undefined, expected: string | undefined): boolean {
  if (typeof provided !== 'string' || !expected) return false;
  return timingSafeEqual(digest(provided), digest(expected));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const reply = (status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
  };
  if (!process.env.DATABASE_URL) {
    reply(503, { error: 'no database configured' });
    return;
  }
  if (req.method !== 'POST' || !keyMatches(req.headers['x-setup-key'], process.env.SETUP_SECRET)) {
    reply(401, { error: 'unauthorized' });
    return;
  }
  try {
    const { runMigrations } = await getMigrations(auth.options);
    await runMigrations();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS progress (
        user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
        version integer NOT NULL,
        state jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    reply(200, { ok: true });
  } catch (err) {
    reply(500, { error: err instanceof Error ? err.message : 'setup failed' });
  }
}
