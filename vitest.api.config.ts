// Tests for the Vercel functions in api/ - which is deliberately outside the
// pnpm workspace (a package.json in api/ could change how Vercel resolves
// function dependencies). CI runs this via `pnpm test:api`.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['api/_tests/**/*.test.ts'],
  },
});
