# Sport Performance Dashboard

Personal sport performance & goal management system — strength training (Hevy), cardio (Strava), Cluster 6 (Korps Mariniers) readiness, and a generic goal engine, in one dashboard. See [ARCHITECTURE.md](ARCHITECTURE.md) for how the pieces fit together and why.

**Status: Phase 3 (Strava OAuth + sync) built, pending your Strava app credentials to go live.** Phases 1-2 are live and verified end-to-end against a real Supabase project: auth, Hevy sync (idempotent, batched, ~3-4s for 160 workouts / 3200+ sets), and goal `current_value` computed automatically from synced sets after every sync. Strava's OAuth flow, token refresh, and cardio sync are built the same way but need your Strava API app's Client ID/Secret to actually run — see "Strava" below. Training-plan analysis, Cluster 6 data entry, and the rest of the roadmap are not built yet.

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
   supabase functions deploy strava-exchange-token
   supabase functions deploy strava-sync
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

### 5. Strava

1. Create an API app at [strava.com/settings/api](https://www.strava.com/settings/api).
2. Set **Authorization Callback Domain** to your GitHub Pages domain only — no `https://`, no path. For the default project URL that's `bovisker.github.io`; if you ever add a custom domain, update this to match.
3. Note the **Client ID** (public) and **Client Secret** (not public).
4. Set the secret server-side:
   ```bash
   supabase secrets set STRAVA_CLIENT_ID=<client-id>
   supabase secrets set STRAVA_CLIENT_SECRET=<client-secret>
   ```
5. Add `VITE_STRAVA_CLIENT_ID=<client-id>` to `.env.local` for local dev, and as a GitHub repo Variable (same place as the Supabase ones) for production.
6. On the Sync page, click "Connect Strava" — it redirects to Strava, then back to the app, which exchanges the code for tokens via `strava-exchange-token` and stores them the same way Hevy's key is stored (server-side only, `provider_tokens` table with no client-readable RLS policy).

Not implemented: Strava webhooks (brief section 7) — sync is polling-only for now, same as Hevy. Calories aren't available from the activity-list endpoint Strava uses here, so `cardio_sessions.calories` stays null rather than showing a fabricated number.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Typecheck + production build |
| `npm run typecheck` | TypeScript only, no emit |
| `npm run lint` | oxlint |
| `npm test` | Vitest |

## Roadmap

Phases 1-2 done and live-verified. Phase 3 (Strava) is built pending your app credentials. Remaining, roughly in order: wire Training/Cardio/Exercise pages to the real synced data (they're currently honest placeholders even though the data exists), strength analytics (e1RM/PR/volume per exercise, generalizing what `recomputeGoalProgress` does for goals specifically), full goal engine UI (trend/forecast, editable in Settings), Cluster 6 readiness data entry, recovery analytics, per-session training analysis, weekly/monthly reports, achievements + celebrations, forecasting, Garmin adapter (if Garmin ever opens individual access), Strava webhooks, then testing/perf/security polish.

## Known gaps / honesty notes

- Cluster 6 requirement numbers (`src/lib/cluster6/requirements.ts`) are sourced from a third-party site (fitvoordefensie.nl), not werkenbijdefensie.nl directly (that page 404'd during research) — verify before relying on them for anything that matters.
- The Hevy `/v1/workouts/events` incremental-sync endpoint's exact response shape wasn't directly observable (Hevy's Swagger UI doesn't serve to non-browser fetchers) — `hevy-sync` currently does a full refresh each run, which is correct but not incremental. See the comment in `supabase/functions/hevy-sync/index.ts`.
- No Settings UI yet to edit goals/cluster requirements — those pages currently say so rather than pretending to work. The Hevy key form does work (Settings → Hevy).
- Strava webhooks aren't implemented — sync is polling-only (click "Sync now"), same scope boundary as Hevy.
- `recomputeGoalProgress` (in `hevy-sync`) only updates `current_value`; it doesn't compute `forecast_date` or a trend-based status yet — goals show real current/target numbers but the status badge stays conservative until that lands.
- Training/Cardio/Exercise-detail pages don't query real data yet even though `training_sessions`/`sets`/`cardio_sessions` are populated — that wiring is a specific, separate next step, not implied by "sync works".
