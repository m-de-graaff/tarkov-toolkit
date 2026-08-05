// One-time database setup for the hosted deployment. Run after the Neon
// integration is attached to the Vercel project:
//   vercel env pull .env.local   (or set DATABASE_URL yourself)
//   node scripts/setup-db.mjs
// Creates Better Auth's tables (via its CLI) and the progress table.
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import pg from 'pg';

if (!process.env.DATABASE_URL && existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set (run: vercel env pull .env.local)');
  process.exit(1);
}

console.log('Running Better Auth migrations...');
execSync('npx @better-auth/cli@latest migrate --config api/_lib/auth.ts --yes', {
  stdio: 'inherit',
  env: process.env,
});

console.log('Creating progress table...');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
await pool.query(`
  CREATE TABLE IF NOT EXISTS progress (
    user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
    version integer NOT NULL,
    state jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`);
await pool.end();
console.log('Database ready.');
