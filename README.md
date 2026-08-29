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
   supabase db push          # applies every migration in supabase/migrations/
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
4. Set the secrets server-side (the webhook verify token can be any random string you generate yourself, e.g. `openssl rand -hex 24` — Strava just echoes it back once during the subscription handshake to prove the callback URL is really yours):
   ```bash
   supabase secrets set STRAVA_CLIENT_ID=<client-id>
   supabase secrets set STRAVA_CLIENT_SECRET=<client-secret>
   supabase secrets set STRAVA_WEBHOOK_VERIFY_TOKEN=<any-random-string>
   ```
5. Deploy `strava-webhook` with JWT verification disabled — Strava calls this endpoint directly and never carries a Supabase session:
   ```bash
   supabase functions deploy strava-webhook --no-verify-jwt
   ```
6. Add `VITE_STRAVA_CLIENT_ID=<client-id>` to `.env.local` for local dev, and as a GitHub repo Variable (same place as the Supabase ones) for production.
7. On the Sync page, click "Connect Strava" — it redirects to Strava, then back to the app, which exchanges the code for tokens via `strava-exchange-token` and stores them the same way Hevy's key is stored (server-side only, `provider_tokens` table with no client-readable RLS policy). This also auto-subscribes to Strava's webhook (`strava-webhook`, action `subscribe`) so future activity changes push in near real-time, not just on manual "Sync now".

Strava activity changes now push automatically via `strava-webhook` (real-time, on top of manual "Sync now" as a fallback) — see "Roadmap" below. Calories aren't available from the activity-list endpoint Strava uses here, so `cardio_sessions.calories` stays null rather than showing a fabricated number.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Typecheck + production build |
| `npm run typecheck` | TypeScript only, no emit |
| `npm run lint` | oxlint |
| `npm test` | Vitest |

## Roadmap

Phases 1-11 done and live-verified: the two above, plus a PR achievements feed (Command Center + `/achievements`) and a weekly/monthly report (`/reports`). Also done: recovery tracking (see below — built without live Garmin sync); a Cluster 6 Settings UI to edit requirement targets/buffer margins per user (`cluster_requirement_overrides`, wired into `Cluster6Page`); a forecasting refinement — `fitLinearTrend` now computes R² alongside the slope, and `trendConfidence` requires both enough points *and* a reasonably tight fit before calling a forecast "betrouwbaar" (`recomputeGoalProgress` writes this to `goals.confidence` on every sync; `GoalCard` shows it next to the forecast date); and Strava webhooks — `strava-webhook` (deployed with `--no-verify-jwt`, since Strava calls it directly with no Supabase session) subscribes once via Strava's push-subscription API, verifies the one-time `hub.challenge` handshake, and on every activity create/update/delete re-fetches just that one activity and upserts it -- confirmed live end-to-end (a real activity round-tripped through the handler within seconds of the event). `strava-sync` ("Sync now") stays as the bulk-catchup fallback for first connects or missed deliveries; both share `_shared/stravaAuth.ts` and `_shared/stravaCardio.ts` now instead of duplicating token-refresh and row-mapping logic.

Also done: the Command Center's four summary cards (Strength trend, Cardio trend, Cluster 6 readiness, Recent) were rendering an unconditional `<InsufficientData />` with no logic behind them -- now wired to real data, reusing `useReport`/`classifyClusterResult`/the training+cardio session hooks rather than new aggregation code; and a security/perf review (see below) plus route-level code-splitting.

Also done (2026-08-29): a **trainingsplan editor** (`planned_sessions` table, a repeating weekly template rather than a calendar, seeded with the athlete's own weekly split; edited in Settings, read by the Command Center's Today card); **units/privacy settings** (`profiles.units`/`bodyweight_kg` — existing columns that had zero frontend code until now — plus a full JSON data export and a type-to-confirm delete-all-my-data action, both scoped to owned tables and deliberately leaving `sync_runs`/`provider_tokens` untouched, see code comments in `useDataPrivacy.ts`); a **manual override for the Push/Pull/Legs + Heavy/Volume classification** (`session_classification_overrides`, editable inline on the Training page) for sessions the keyword heuristic gets wrong or can't read at all; and **incremental Hevy sync** via `GET /v1/workouts/events` (falls back to the full refresh — which was already correct, just slower — on any error or unexpected response shape; see the safety note in `supabase/functions/hevy-sync/index.ts`). Migrations 0006/0007 are applied and `hevy-sync` is deployed as of this writing.

What's genuinely still missing, as an honest stub: a units/privacy toggle that actually *converts* displayed values elsewhere in the app (right now the setting is stored and the Settings form itself converts, but exercise/cardio pages still always show kg/km regardless of the setting).

## Garmin research findings (2026-08-12)

Short version: **no live Garmin sync, and not because it wasn't tried.** Garmin has no individual/personal-use developer API (Connect Developer Program requires a company/university/institution — confirmed both during Phase 1 and again here). Every unofficial route runs through the same chokepoint: `garth`, the Python library that reverse-engineers Garmin Connect's mobile-app SSO flow and that GarminDB and virtually every other community tool (`python-garminconnect`, etc.) depend on for login.

That chokepoint broke, twice, in the months before this was written:
- **28 March 2026**: Garmin changed its SSO flow; `garth`'s maintainer declared it deprecated. New logins stopped working (a session with an already-valid token could keep working until it expires, ~1 year out, but nothing new could authenticate).
- **~June 2026**: `python-garminconnect` shipped a fix using `curl_cffi` (TLS-fingerprint impersonation of the Android app) — then Garmin tightened Cloudflare's TLS-fingerprinting bot detection and broke that too.

The community's current fallback is fully manual: log in through a browser yourself, open DevTools, and copy a `serviceTicketId` out of a network request by hand. That's not automatable from a stateless Supabase Edge Function — there's no browser, and `curl_cffi`'s TLS spoofing has no Deno equivalent to begin with. Garmin also has an active commercial reason to keep tightening this (a paid "Connect+" tier launched in 2026), so treating any unofficial fix as stable would be a bad bet, not just a hard one.

**What got built instead**, entirely credential-free: Garmin Connect has its own sanctioned export features — a per-metric "Download CSV" button (Health Stats → e.g. Heart Rate) and a full GDPR "Export Your Data" archive (Account Settings) that includes sleep/HRV/stress/body battery as JSON. `/recovery` supports manual daily entry (always reliable) plus a best-effort CSV importer (`src/lib/recovery/parseRecoveryImport.ts`) that matches columns by keyword rather than a fixed schema, since Garmin's export column names aren't documented and weren't independently verified against a real file. If a real export doesn't parse cleanly, that's expected — the importer reports exactly which columns it matched (or didn't) so the mapping can be adjusted against a real sample.

## Known gaps / honesty notes

- Cluster 6 requirement numbers (`src/lib/cluster6/requirements.ts`) are sourced from a third-party site (fitvoordefensie.nl), not werkenbijdefensie.nl directly (that page 404'd during research) — verify before relying on them for anything that matters.
- The Hevy `/v1/workouts/events` incremental-sync endpoint's exact response shape wasn't directly observable (Hevy's Swagger UI doesn't serve to non-browser fetchers) — `hevy-sync` currently does a full refresh each run, which is correct but not incremental. See the comment in `supabase/functions/hevy-sync/index.ts`.
- Push/Pull/Legs and Heavy/Volume session classification is a keyword heuristic on the Hevy workout title only — roughly 40% of this user's real session titles are Hevy's generic defaults with no recognizable pattern, and those honestly stay unclassified rather than guessed.
- The recovery CSV importer's column-matching (`src/lib/recovery/parseRecoveryImport.ts`) is untested against a real Garmin Connect export file — Garmin doesn't publish the column schema, and none was available while building this. It's unit-tested against the author's best guess at realistic headers, and the import UI reports exactly which columns it matched so a mismatch is visible rather than silently wrong; if a real export doesn't parse, the parser needs adjusting against the real header row.
- CORS on every Edge Function is `Access-Control-Allow-Origin: *` rather than locked to the GitHub Pages origin (see "Security review" below) — a deliberate trade-off, not an oversight, given the app's auth is bearer-token-based rather than cookie-based.
- No training-plan editor (a prescriptive weekly push/pull/legs schedule you define in advance) — the Command Center's "Today" card and Settings' "Trainingsplan" card are honest stubs for this. Distinct from the session *classification* that already works (see above): that reads what you already did from Hevy titles, this would be about planning what to do next. Also no unit/privacy settings (kg/lbs, km/mi, data export/delete).

## Security review (2026-08-13)

- **RLS**: every table has row-level security enabled, and every one either has an owner-scoped policy (`auth.uid() = user_id`, or an `exists` check through a parent table for child rows like `sets`/`goal_events`) or, for `provider_tokens` specifically, zero policies at all — meaning service_role-only, which is the intended lockout for secrets. No gaps found across all 5 migrations.
- **Secret handling**: `.env.local` was never committed (checked full git history, not just the working tree); `.env.example` only has placeholder values; no API keys or tokens found hardcoded anywhere in `src/`. The CI workflow only ever touches public `vars.*` (Supabase anon key, Strava client ID), never a secret, for the build step — real secrets live exclusively in Supabase project secrets, consumed only inside Edge Functions.
- **Every Edge Function** that isn't meant to be public verifies the caller's Supabase JWT server-side (`anonClient.auth.getUser()`) and scopes every write to *that* verified `user_id` — none of them trust a client-supplied user id. `strava-webhook` is the one deliberately-public exception (Strava calls it directly, with no session) — its trade-offs are documented in the function's own file header: forged events can only trigger a redundant re-sync or delete one cached row, both recoverable via a normal "Sync now", since row data always comes from a real Strava API call using this app's own stored token, never from the event body itself.
- **CORS** is wildcard (`*`) on every function. Normally a concern, but this app's auth is bearer-token (`Authorization` header), not cookie-based — browsers don't auto-attach a bearer token to a request the way they do a cookie, so a malicious third-party page can't ride a logged-in user's session cross-origin the way classic CSRF works. Locking CORS to the GitHub Pages origin would add defense-in-depth but also break local dev (`http://localhost:5173`) without an origin-allowlist rewrite; left as-is given the actual exploitability is already low.
- **XSS**: no `dangerouslySetInnerHTML`, `eval`, or `new Function` anywhere in `src/` — React's default JSX escaping is the only rendering path used.
- **Bundle size**: routes are now code-split (`React.lazy` + `Suspense`, wired in `App.tsx`/`AppShell.tsx`) — the single 560kB initial chunk (Vite's build warning) is now a 242kB shared chunk plus small per-page chunks loaded on navigation.
