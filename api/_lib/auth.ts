// Better Auth server config for the hosted deployment (Vercel functions).
// Self-hosted/local builds never call these endpoints - the client hides all
// account UI unless VITE_AUTH_ENABLED is set at build time.
import { betterAuth } from 'better-auth';
import { pool } from './db.js';

// defaults + TRUSTED_ORIGINS (comma-separated) + the current Vercel preview
// URLs, so preview deployments and future custom domains don't silently fail
// auth against a hardcoded list
const trustedOrigins = [
  'https://tarkovtoolkit.vercel.app',
  'https://tarkov-toolkit.vercel.app',
  ...(process.env.TRUSTED_ORIGINS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) ?? []),
  ...[process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
    .filter(Boolean)
    .map((host) => `https://${host}`),
];

export const auth = betterAuth({
  database: pool,
  emailAndPassword: {
    enabled: true,
    // progress sync is the only thing an account gates; keep signup frictionless
    requireEmailVerification: false,
  },
  trustedOrigins,
  // the default in-memory store is per-serverless-instance, i.e. no limit at
  // all under load; the database store actually counts across instances
  rateLimit: {
    enabled: true,
    storage: 'database',
  },
});
