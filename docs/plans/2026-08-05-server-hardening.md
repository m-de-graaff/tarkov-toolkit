# Server & Deploy Hardening Implementation Plan (Roadmap Slice 3)

> **To execute:** use the `executing-plans` skill. Steps use `- [ ]` for tracking.

**Goal:** `api/` is type-checked and tested in CI; the sync endpoint validates
and rate-limits input; auth config is env-driven and rate-limited; the setup
endpoint uses a dedicated constant-time secret; deploy config gains security
headers and reproducible installs.

**Architecture:** Keep `api/` OUTSIDE the pnpm workspace (a package.json inside
`api/` risks changing Vercel's function dependency resolution) — instead CI
gains explicit steps: `tsc -p api/tsconfig.json` and a root-level vitest config
that runs `api/_tests/**` (underscore paths are not deployed as functions).
Validation is a hand-rolled pure function (no zod — no new runtime deps in
functions). Rate limiting: better-auth's built-in limiter switched to database
storage (works across serverless instances); the progress PUT gets a 1-write/
second-per-user floor enforced in the upsert's WHERE clause.

**Tech stack:** node 24, pg 8, better-auth 1.6, vitest 2 (root devDep, node env).

## Global Constraints

- No new runtime dependencies in `api/`.
- Test files live in `api/_tests/` only (never `api/*.test.ts` — Vercel would
  deploy them as endpoints).
- All api handlers keep the `(req: IncomingMessage, res: ServerResponse)`
  default-export shape.
- New env vars: `SETUP_SECRET` (setup endpoint), `TRUSTED_ORIGINS`
  (comma-separated, optional). Both documented in the PR body.

---

### Task 1: CI covers api/

**Files:**
- Create: `vitest.api.config.ts` (repo root: node environment, include
  `api/_tests/**/*.test.ts`)
- Modify: `package.json` (root: devDep `vitest`, scripts `typecheck:api`,
  `test:api`)
- Modify: `.github/workflows/ci.yml` (two steps after `pnpm test`)

**Interfaces:**
- Produces: `pnpm typecheck:api` → `tsc -p api/tsconfig.json`;
  `pnpm test:api` → `vitest run -c vitest.api.config.ts`.

- [ ] Add config + scripts + CI steps; verify `pnpm typecheck:api` passes and
  `pnpm test:api` passes (with Task 7's tests; `--passWithNoTests` until then).
  Commit with Task 7.

### Task 2: db.ts pool hardening

**Files:** Modify `api/_lib/db.ts`.

- Attach `pool.on('error', ...)` logging handler (an idle-client error is
  otherwise an unhandled 'error' event that kills the lambda).
- `connectionTimeoutMillis: 5_000`, `query_timeout: 10_000`,
  `statement_timeout: 10_000`. SSL stays in the connection string (Neon URLs
  carry `sslmode=require`; forcing `ssl` here would break local docker pg).

- [ ] Implement; type-check. Commit with Task 3.

### Task 3: progress.ts — validation, rate floor, error handling

**Files:**
- Create: `api/_lib/validateProgress.ts`
- Modify: `api/progress.ts`
- Test: `api/_tests/validateProgress.test.ts`, `api/_tests/progress.test.ts`

**Interfaces:**
- Produces: `validateSyncedState(value: unknown): string | null` — returns an
  error message or null when valid. Rules: object; `gameMode` ∈
  {'pvp','pve'}; `tracker` object with `level` number 1..79, `faction` one of
  'Any'|'USEC'|'BEAR', `completedTaskIds` string[] (≤ 5000 entries),
  `hideoutLevels`/`itemsHave` records of string→finite number ≥ 0;
  `profiles` object whose values pass the tracker rules; optional
  `craftBlacklist` string[] (≤ 2000).
- progress.ts PUT: 400 with the validator's message when invalid; upsert gains
  `WHERE progress.updated_at < now() - interval '1 second'` + `RETURNING`,
  no row → 429 `{ error: 'too many writes' }` (client debounce is 3s, so real
  clients never hit it).
- Both GET and PUT query paths wrapped in try/catch → `console.error` +
  500 `{ error: 'database error' }`.

- [ ] Tests first (validator cases + handler: 401 unauthenticated, 400 invalid
  body, 400 invalid state, 200 valid PUT, 429 on second write inside 1s, 500 on
  query throw, 204/200 GET) with `vi.mock` of `../_lib/auth.js` and
  `../_lib/db.js`; then implement; green. Commit Tasks 2+3.

### Task 4: auth.ts — env-driven origins + database rate limiting

**Files:** Modify `api/_lib/auth.ts`. Test: extend `api/_tests` only via
config parse helper if extracted — keep simple, no test (config-only).

- `trustedOrigins`: `TRUSTED_ORIGINS` env (comma-separated) appended to the
  two defaults, plus `https://${process.env.VERCEL_URL}` and
  `https://${process.env.VERCEL_BRANCH_URL}` when set (preview deploys).
- `rateLimit: { enabled: true, storage: 'database' }` — cross-instance; table
  is created by better-auth migrations (setup endpoint re-run required, noted
  in PR).

- [ ] Implement; type-check. Commit.

### Task 5: setup.ts — dedicated secret, constant-time compare

**Files:** Modify `api/setup.ts`. Test: `api/_tests/setup.test.ts`.

- Key becomes `SETUP_SECRET` (no fallback to `BETTER_AUTH_SECRET` — reusing
  the session-signing secret as a bearer token was the finding). Unset →
  always 401.
- Compare via `crypto.timingSafeEqual` on utf8 buffers (length check first).

- [ ] Test: 401 when unset / wrong key / non-POST; migrations mocked. Implement;
  green; commit.

### Task 6: deploy config

**Files:** Modify `vercel.json`, `.dockerignore`.

- `installCommand: "pnpm install --frozen-lockfile"`.
- `headers`: for `/(.*)`: `Strict-Transport-Security: max-age=63072000;
  includeSubDomains`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`,
  `X-Frame-Options: DENY`. **CSP deliberately deferred** — a wrong policy
  bricks the SPA; it needs a browser-verified pass of its own (roadmap note).
- `.dockerignore`: add `.env*`.

- [ ] Implement; commit.

### Task 7: api tests wired into CI

Covered by Tasks 1/3/5 test files; final step:

- [ ] `pnpm typecheck:api && pnpm test:api` green locally; full web suite still
  green; push; CI green on the PR.
