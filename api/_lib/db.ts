// One pg pool per serverless instance, shared by Better Auth and /api/progress.
// DATABASE_URL comes from the Neon integration on the Vercel project.
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  idleTimeoutMillis: 10_000,
});
