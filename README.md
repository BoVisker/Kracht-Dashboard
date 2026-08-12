# Sport Performance Dashboard

Personal sport performance & goal management system — strength training (Hevy), cardio (Strava), Cluster 6 (Korps Mariniers) readiness, and a generic goal engine, in one dashboard. See [ARCHITECTURE.md](ARCHITECTURE.md) for how the pieces fit together and why.

**Status: Phases 1-9 live and verified end-to-end against a real Supabase project.** Auth, Hevy sync (idempotent, batched, ~3-4s for 160 workouts / 3200+ sets), Strava OAuth + polling sync, Training/Cardio/Exercise pages on real data, strength analytics (e1RM, PR detection, exercise pinning), the full goal engine (trend fit, forecast date, schedule-pace note, create/edit/delete UI in Settings), Cluster 6 readiness tracking (with Strava-based suggestions for run/march tests), Push/Pull/Legs + Heavy/Volume session classification, and a PR achievements feed (Command Center + dedicated Achievements page) are all built and live. Remaining roadmap: recovery tracking, weekly/monthly reports, forecasting refinements, Strava webhooks (currently polling-only), and Garmin (blocked — enterprise-only API access).

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

Phases 1-9 done and live-verified (see Status above). Remaining, no fixed order: recovery/herstel tracking, weekly/monthly reports, forecasting refinements (e.g. confidence intervals on the trend fit), a Cluster 6 Settings UI to edit requirements (currently a hardcoded seed array, deliberately not hardcoded into logic — see `src/lib/cluster6/requirements.ts`), Strava webhooks (replacing polling), Garmin adapter (blocked — Garmin's individual-developer API access is enterprise-only, confirmed during Phase 1 research), then general testing/perf/security polish.

## Known gaps / honesty notes

- Cluster 6 requirement numbers (`src/lib/cluster6/requirements.ts`) are sourced from a third-party site (fitvoordefensie.nl), not werkenbijdefensie.nl directly (that page 404'd during research) — verify before relying on them for anything that matters.
- The Hevy `/v1/workouts/events` incremental-sync endpoint's exact response shape wasn't directly observable (Hevy's Swagger UI doesn't serve to non-browser fetchers) — `hevy-sync` currently does a full refresh each run, which is correct but not incremental. See the comment in `supabase/functions/hevy-sync/index.ts`.
- No Settings UI yet to edit Cluster 6 requirements — those are a hardcoded (but centralized, non-logic-embedded) seed array. Goals themselves are fully editable in Settings.
- Strava webhooks aren't implemented — sync is polling-only (click "Sync now"), same scope boundary as Hevy.
- Push/Pull/Legs and Heavy/Volume session classification is a keyword heuristic on the Hevy workout title only — roughly 40% of this user's real session titles are Hevy's generic defaults with no recognizable pattern, and those honestly stay unclassified rather than guessed.
