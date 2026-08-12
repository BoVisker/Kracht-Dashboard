-- Recovery/herstel tracking (roadmap "phase 8"). No live Garmin sync exists
-- yet -- see README "Garmin research findings" for why (garth, the
-- reverse-engineered auth library nearly every unofficial Garmin tool
-- depends on, has been broken by Garmin's own bot-detection changes twice
-- in 2026 and has no working, portable-to-Deno replacement as of this
-- writing). Rows land here either via manual entry or via a best-effort
-- CSV/JSON upload of a file the user exported themselves from Garmin
-- Connect's own first-party export feature -- no credentials involved.
create table recovery_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  source text not null default 'manual' check (source in ('manual', 'garmin_csv', 'garmin_export')),
  resting_heart_rate numeric,
  hrv_ms numeric,
  sleep_duration_minutes numeric,
  sleep_score numeric,
  body_battery numeric,
  stress_average numeric,
  notes text,
  created_at timestamptz not null default now(),
  -- One row per day: a later import/entry for the same date overwrites
  -- rather than duplicating, unlike cluster_tests (which keeps every
  -- historical attempt) -- a resting heart rate is a daily fact, not a
  -- repeatable test result.
  unique (user_id, date)
);

alter table recovery_metrics enable row level security;
create policy "recovery_metrics: owner all" on recovery_metrics for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create index recovery_metrics_user_date_idx on recovery_metrics (user_id, date desc);
