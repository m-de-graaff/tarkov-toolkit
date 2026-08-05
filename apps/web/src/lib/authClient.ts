// Account support exists only on the hosted deployment: the Vercel build sets
// VITE_AUTH_ENABLED, which shows the account UI and enables progress sync.
// Local dev, static and docker self-hosting stay account-free (localStorage).
import { createAuthClient } from 'better-auth/react';

// env vars are strings: Boolean("false") is true, so parse explicitly
export const parseAuthEnabled = (value: unknown): boolean =>
  /^(1|true)$/i.test(String(value ?? ''));

export const AUTH_ENABLED = parseAuthEnabled(import.meta.env?.VITE_AUTH_ENABLED);

export const authClient = createAuthClient();
