# Auth design (Better Auth) — decisions needed before implementation

Goal: the hosted deployment (Vercel) offers accounts so quest progress syncs
across devices; self-hosted/local stays account-free (localStorage only), which
also keeps the "no account needed" promise on the home page true for local use.

## Proposed shape

- **What auth gates:** nothing read-only. Sign-in exists purely to *sync
  progress* (tracker state) across devices. Anonymous use keeps working.
- **Server surface:** Better Auth mounted in a Vercel serverless function
  (`api/auth/[...all]`), plus one `api/progress` GET/PUT endpoint guarded by the
  session. The SPA stays static; `VITE_AUTH_ENABLED` (set only on Vercel) shows
  the sign-in UI and the sync toggle.
- **Store integration:** tracker state already lives in one zustand slice; sync
  = debounce-push on change + pull-and-merge on sign-in (last-write-wins per
  quest id, level = max).

## Blocked on Mark

1. **Database** — Better Auth needs one. Cheapest fits: Neon (Postgres) or
   Turso (libSQL); both have free tiers. Which?
2. **Sign-in methods** — email+password is zero-config; Google/Discord OAuth
   need app registrations (Discord fits the audience).
3. **Vercel project** — connecting the repo requires a GitHub remote (repo is
   local-only today) and a Vercel account.

Say the word on 1–3 and the implementation is a normal planned feature.

## Sync contract (implemented client-side already)

Local persistence is a real database now: the zustand store persists to
IndexedDB (`raidplanner-state`/`kv`, localStorage fallback + one-time legacy
import — see `apps/web/src/lib/storage.ts`). The persisted JSON value is the
sync unit for the hosted version:

- `PUT /api/progress` pushes `{version, state}` (debounced on change);
  `GET /api/progress` pulls on sign-in.
- Conflict rule: per game-mode profile, last-write-wins on scalars
  (level, faction, hideout levels take the newer write), set-union on
  `completedTaskIds` (a quest completed on either device stays completed).
- The same zustand `migrate` versioning applies server-side payloads, so old
  clients can always be upgraded on read.
