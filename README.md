# Sport Performance Dashboard

Personal sport performance & goal management system — strength training (Hevy), cardio (Strava), Cluster 6 (Korps Mariniers) readiness, and a generic goal engine, in one dashboard. See [ARCHITECTURE.md](ARCHITECTURE.md) for how the pieces fit together and why.

**Status: Phase 2 (Hevy live wiring) complete.** Phase 1's foundation plus: Supabase Auth (single-user login/logout), a Settings form to save your Hevy API key server-side, and a working Sync page that calls the real `hevy-sync` Edge Function and shows real `integrations` status. None of this has been tested against a real Supabase project yet — only verified to degrade gracefully with fake/absent config. Strava OAuth, the goal engine's live data wiring, training-plan analysis, and the rest of the roadmap below are not built yet.

## Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS v4, deployed as a static site to GitHub Pages via GitHub Actions.
- **Backend**: Supabase (Postgres + Auth + Edge Functions). GitHub Pages cannot run a server, so anything needing a secret lives here instead.
- **Testing**: Vitest + React Testing Library.

## Setup

These are the steps only you can do — Claude cannot create accounts, register OAuth apps, or hold your credentials on your behalf.

### 1. Create a Supabase project

1. Sign up / log in at [supabase.com](https://supabase.com), create a new project (free tier is enough to start).
2. In the Supabase dashboard: **Project Settings → API** — copy the **Project URL** and the **anon public** key.
3. Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then from this repo:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push          # applies supabase/migrations/0001_init.sql
   supabase functions deploy hevy-sync
   supabase functions deploy save-provider-token
   ```
4. Set the Edge Function secrets (these are Supabase secrets, not GitHub secrets):
   ```bash
   supabase secrets set SUPABASE_URL=https://<your-project-ref>.supabase.co
   supabase secrets set SUPABASE_ANON_KEY=<anon-key-from-step-2>
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key-from-project-settings>
   ```
5. In Supabase Auth settings, create yourself a user (email/password or magic link — this is a single-user app, one account is enough).

### 2. Get a Hevy API key

Requires an active **Hevy Pro** subscription. Get the key at `hevy.com/settings?developer`.

**Do this regardless of anything else**: the previous prototype ([dashboard.html](dashboard.html) on the Desktop) has a live Hevy API key hardcoded in plaintext. Revoke/regenerate it in Hevy's settings — that file should not keep working after this migration.

Once you have a fresh key, save it through the app itself (Settings/Sync page → paste Hevy API key) once the frontend is deployed and pointed at your Supabase project — this calls `save-provider-token`, which is the only thing allowed to write it into the database.

### 3. Local development

```bash
cp .env.example .env.local   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

### 4. GitHub Pages deployment

1. Repo **Settings → Pages** — set source to "GitHub Actions".
2. Repo **Settings → Secrets and variables → Actions → Variables tab** — add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Repository variables, not secrets — see [ARCHITECTURE.md](ARCHITECTURE.md#9-how-are-secrets-managed) for why that's fine).
3. Push to `main`. [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) lints, typechecks, tests, builds, and deploys — in that order, and only on green.

### 5. Strava (not yet built)

The adapter and `cardio_sessions` schema exist; the OAuth callback and webhook Edge Functions don't yet. When that phase lands, you'll need to register an app at [developers.strava.com](https://developers.strava.com) yourself and store the client ID/secret as Supabase secrets, the same way as Hevy's key.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Typecheck + production build |
| `npm run typecheck` | TypeScript only, no emit |
| `npm run lint` | oxlint |
| `npm test` | Vitest |

## Roadmap

Foundation (phase 1) is done. Remaining phases, roughly in order: Strava integration, canonical training/cardio data wiring end-to-end, strength analytics, goal engine UI, Cluster 6 readiness data entry, recovery analytics, per-session training analysis, weekly/monthly reports, achievements + celebrations, forecasting, Garmin adapter (if Garmin ever opens individual access), then testing/perf/security polish.

## Known gaps / honesty notes

- Cluster 6 requirement numbers (`src/lib/cluster6/requirements.ts`) are sourced from a third-party site (fitvoordefensie.nl), not werkenbijdefensie.nl directly (that page 404'd during research) — verify before relying on them for anything that matters.
- The Hevy `/v1/workouts/events` incremental-sync endpoint's exact response shape wasn't directly observable (Hevy's Swagger UI doesn't serve to non-browser fetchers) — `hevy-sync` currently does a full refresh each run, which is correct but not incremental. See the comment in `supabase/functions/hevy-sync/index.ts`.
- No Settings UI yet to actually paste a Hevy key or edit goals/cluster requirements — those pages currently say so rather than pretending to work.
