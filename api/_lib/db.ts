// One pg pool per serverless instance, shared by Better Auth and /api/progress.
// DATABASE_URL comes from the Neon integration on the Vercel project; SSL is
// carried by the connection string (sslmode=require) so local docker pg keeps
// working without it.
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
  query_timeout: 10_000,
  statement_timeout: 10_000,
});

// an error on an idle client is an 'error' event on the pool; unhandled it
// crashes the lambda instead of surfacing as a failed query
pool.on('error', (err) => {
  console.error('pg pool error:', err);
});
