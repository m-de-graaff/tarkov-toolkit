// Account support exists only on the hosted deployment: the Vercel build sets
// VITE_AUTH_ENABLED, which shows the account UI and enables progress sync.
// Local dev, static and docker self-hosting stay account-free (localStorage).
import { createAuthClient } from 'better-auth/react';

export const AUTH_ENABLED = Boolean(import.meta.env?.VITE_AUTH_ENABLED);

export const authClient = createAuthClient();
