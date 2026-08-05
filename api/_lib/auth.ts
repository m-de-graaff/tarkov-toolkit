// Better Auth server config for the hosted deployment (Vercel functions).
// Self-hosted/local builds never call these endpoints - the client hides all
// account UI unless VITE_AUTH_ENABLED is set at build time.
import { betterAuth } from 'better-auth';
import { pool } from './db.js';

export const auth = betterAuth({
  database: pool,
  emailAndPassword: {
    enabled: true,
    // progress sync is the only thing an account gates; keep signup frictionless
    requireEmailVerification: false,
  },
  trustedOrigins: [
    'https://tarkovtoolkit.vercel.app',
    'https://tarkov-toolkit.vercel.app',
  ],
});
