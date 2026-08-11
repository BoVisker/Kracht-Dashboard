# Architecture

Answers to the ten questions that had to be settled before any integration code got written (per the original brief, section 43N).

## 1. What runs on GitHub Pages?

Only the built static frontend (React + Vite + TypeScript + Tailwind, output of `npm run build`). No server code, no secrets, no database. GitHub Pages cannot run a backend — see [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) for the build-and-deploy pipeline.

## 2. What runs server-side?

Supabase Edge Functions (Deno, hosted by Supabase — not GitHub Pages). Anything that needs a secret credential lives here: `supabase/functions/hevy-sync`, `supabase/functions/save-provider-token`, and future Strava OAuth callback / webhook handlers. The frontend calls these via `supabase.functions.invoke(...)`, authenticated with the user's Supabase session JWT.

## 3. Where is the database?

Supabase Postgres. Schema lives in `supabase/migrations/`. Every user-data table has Row Level Security scoped to `auth.uid()` — see migration `0001_init.sql`.

## 4. Where are OAuth tokens stored?

In the `provider_tokens` table, which has **no RLS policies granting access to `anon` or `authenticated`** — only `service_role` (used exclusively inside Edge Functions) can read or write it. The frontend never sees a token after the initial paste/OAuth-callback moment.

## 5. Where are API keys stored?

Same table, same rule, for Hevy's static `api-key`. Supabase project secrets (`supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...` etc., configured once via the Supabase CLI or dashboard) hold the credentials Edge Functions themselves need to talk to Supabase with elevated privileges. Nothing here is a GitHub Actions secret, and nothing here is a `VITE_*` variable.

## 6. How do Hevy and Strava sync?

- **Hevy**: polling only — Hevy has no webhooks. `hevy-sync` fetches `/v1/workouts` (paginated) and upserts into canonical tables keyed on `(user_id, source, external_id)`, making re-runs idempotent. The user (or a future scheduled trigger) calls "Sync now" on the Sync page.
- **Strava**: OAuth2 (authorization-code flow, client secret stays server-side) plus real webhooks. Not yet implemented in this phase — `strava-oauth-callback` and `strava-webhook` Edge Functions are the next slice; the adapter interface and DB schema (`cardio_sessions`) are already in place for them.
- **Garmin**: no integration. Garmin Connect Developer Program is enterprise/partner-only; there is no self-serve path for an individual. The `FitnessDataProvider` adapter exists as a slot (`src/lib/providers/garmin.ts`), deliberately unimplemented.

## 7. How does new data reach the dashboard?

`Hevy/Strava API → Edge Function (secret-holding) → Postgres canonical tables (RLS-protected) → frontend queries via supabase-js (anon key + user JWT) → React Query cache → UI`. The frontend never talks to Hevy or Strava directly.

## 8. How is the backend deployed?

Supabase migrations and Edge Functions are deployed via the Supabase CLI (`supabase db push`, `supabase functions deploy`), run manually by the project owner for now. This is a manual step because Claude cannot create or authenticate into a Supabase account on the user's behalf — see the Setup section in [README.md](README.md).

## 9. How are secrets managed?

| Secret | Lives in | Who can read it |
|---|---|---|
| Hevy API key | `provider_tokens` table | `service_role` only (Edge Functions) |
| Strava client secret | Supabase project secret | Edge Functions only |
| Supabase `service_role` key | Supabase project secret (Edge Function env) | Edge Functions only |
| Supabase URL + anon key | `VITE_*` build vars / GitHub repo Variables | Public — safe by design, gated by RLS |

## 10. How is this tested locally vs in production?

- **Local dev**: `npm run dev`, pointed at either a local `supabase start` stack or a real (free-tier) Supabase project via `.env.local`.
- **Production**: GitHub Actions builds against GitHub repo Variables and deploys the static output to GitHub Pages on every push to `main` that passes lint + typecheck + test + build.
- There is currently no separate "staging" Supabase project — for a single-user personal dashboard this was judged not worth the complexity. Revisit if that changes.

---

## Canonical data model

Every provider adapter normalizes into the same shapes (`src/lib/types/canonical.ts`) before anything else touches the data — analytics, goal calculations, and UI components never see a raw Hevy workout or Strava activity. See `src/lib/providers/FitnessDataProvider.ts` for the adapter interface.

## Why HashRouter, not BrowserRouter

GitHub Pages serves static files with no server-side rewrite. A deep link to `/goals` under `BrowserRouter` 404s on a hard refresh unless a `404.html` redirect hack is added. `HashRouter` (`/#/goals`) needs no server cooperation — every route works as a direct link with zero extra moving parts, at the cost of a `#` in the URL. Revisit if a custom domain with a proper rewrite rule is ever set up.

## Why the Supabase anon key is safe to ship in the bundle

This is Supabase's intended model, not a shortcut: the anon key identifies the *project*, not a *user* or a *privilege level*. Every table it can touch is behind Row Level Security scoped to `auth.uid()`. It is fundamentally different from the Hevy API key or Strava client secret, which grant real access on their own and must never leave the server.
