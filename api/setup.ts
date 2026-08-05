// One-time schema setup, run where DATABASE_URL actually lives (the Neon
// integration marks it sensitive, so it cannot be pulled to a dev machine).
// POST with header x-setup-key: $BETTER_AUTH_SECRET. Idempotent; remove the
// route once the deployment is set up if you prefer a smaller surface.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { getMigrations } from 'better-auth/db/migration';
import { auth } from './_lib/auth.js';
import { pool } from './_lib/db.js';

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
  if (
    req.method !== 'POST' ||
    !process.env.BETTER_AUTH_SECRET ||
    req.headers['x-setup-key'] !== process.env.BETTER_AUTH_SECRET
  ) {
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
