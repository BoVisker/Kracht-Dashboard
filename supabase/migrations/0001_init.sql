-- Core schema, phase 1-2 (brief section 43). Every user-data table is
-- scoped to auth.uid() via RLS -- the anon key ships in the public
-- GitHub Pages bundle by design, so RLS is the only thing standing
-- between "safe to expose" and "anyone can read anyone's workouts".
--
-- OAuth tokens and API keys never go in a table the anon/authenticated
-- roles can read -- see provider_tokens at the bottom.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- profiles: one row per user, app-specific settings that don't belong on
-- auth.users itself.
-- ---------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  bodyweight_kg numeric,
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  timezone text not null default 'Europe/Amsterdam',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles: owner read" on profiles for select
  using ((select auth.uid()) = id);
create policy "profiles: owner update" on profiles for update
  using ((select auth.uid()) = id);
create policy "profiles: owner insert" on profiles for insert
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------
-- exercises: canonical exercise definitions (brief section 9).
-- ---------------------------------------------------------------------
create table exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  canonical_name text not null,
  source_names jsonb not null default '{}'::jsonb, -- e.g. {"hevy": "Bench Press (Barbell)"}
  muscle_groups_primary text[] not null default '{}',
  muscle_groups_secondary text[] not null default '{}',
  movement_pattern text not null default 'other'
    check (movement_pattern in (
      'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull',
      'squat', 'hinge', 'carry', 'core', 'other'
    )),
  equipment text,
  classification text not null default 'both' check (classification in ('strength', 'hypertrophy', 'both')),
  load_increment_kg numeric not null default 2.5,
  created_at timestamptz not null default now(),
  unique (user_id, canonical_name)
);

alter table exercises enable row level security;
create policy "exercises: owner all" on exercises for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- training_sessions + sets (brief section 9)
-- ---------------------------------------------------------------------
create table training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('hevy', 'strava', 'garmin', 'manual')),
  external_id text, -- Hevy workout id etc; null for manual entries
  date date not null,
  start_time timestamptz,
  end_time timestamptz,
  duration_seconds integer,
  training_type text not null default 'other'
    check (training_type in ('push', 'pull', 'legs', 'cardio', 'rest', 'other')),
  training_subtype text check (training_subtype in ('heavy', 'volume')),
  planned_session_id uuid,
  perceived_exertion smallint check (perceived_exertion between 1 and 10),
  notes text,
  raw jsonb, -- original provider payload, for re-processing without a re-fetch
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

alter table training_sessions enable row level security;
create policy "training_sessions: owner all" on training_sessions for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create index training_sessions_user_date_idx on training_sessions (user_id, date desc);

create table sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references training_sessions (id) on delete cascade,
  exercise_id uuid not null references exercises (id) on delete restrict,
  set_index integer not null,
  set_type text not null default 'work' check (set_type in ('warmup', 'work', 'failure', 'dropset', 'amrap')),
  weight_kg numeric,
  bodyweight_kg numeric,
  reps integer,
  distance_meters numeric,
  duration_seconds integer,
  rpe numeric,
  rir numeric,
  tempo text,
  quality text not null default 'imported' check (quality in ('verified', 'imported', 'estimated', 'missing', 'conflicting')),
  created_at timestamptz not null default now()
);

-- RLS on sets is via the parent session's user_id (no user_id column here
-- to avoid it drifting out of sync with the session it belongs to).
alter table sets enable row level security;
create policy "sets: owner all" on sets for all
  using (exists (
    select 1 from training_sessions s
    where s.id = sets.session_id and s.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from training_sessions s
    where s.id = sets.session_id and s.user_id = (select auth.uid())
  ));

create index sets_session_idx on sets (session_id);
create index sets_exercise_idx on sets (exercise_id);

-- ---------------------------------------------------------------------
-- cardio_sessions (brief section 10)
-- ---------------------------------------------------------------------
create table cardio_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('hevy', 'strava', 'garmin', 'manual')),
  external_id text,
  sport text not null,
  date date not null,
  moving_time_seconds integer,
  elapsed_time_seconds integer,
  distance_meters numeric,
  average_speed_ms numeric,
  elevation_gain_meters numeric,
  average_heart_rate integer,
  max_heart_rate integer,
  average_power numeric,
  average_cadence numeric,
  calories numeric,
  quality text not null default 'imported' check (quality in ('verified', 'imported', 'estimated', 'missing', 'conflicting')),
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

alter table cardio_sessions enable row level security;
create policy "cardio_sessions: owner all" on cardio_sessions for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create index cardio_sessions_user_date_idx on cardio_sessions (user_id, date desc);

-- ---------------------------------------------------------------------
-- goals + goal_events (brief section 13-15)
-- ---------------------------------------------------------------------
create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text not null check (category in (
    'strength', 'reps', 'bodyweight_calisthenics', 'cardio_distance',
    'cardio_time', 'cluster6', 'bodyweight', 'consistency', 'training_volume'
  )),
  exercise_id uuid references exercises (id) on delete set null,
  unit text not null,
  start_value numeric,
  current_value numeric,
  target_value numeric not null,
  start_date date not null default current_date,
  deadline date,
  status text not null default 'insufficient_data' check (status in (
    'on_track', 'at_risk', 'behind', 'insufficient_data', 'achieved', 'expired'
  )),
  forecast_date date,
  confidence text check (confidence in ('low', 'medium', 'high')),
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table goals enable row level security;
create policy "goals: owner all" on goals for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table goal_events (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals (id) on delete cascade,
  event_type text not null check (event_type in ('created', 'progress_update', 'achieved', 'deadline_changed', 'target_changed', 'expired')),
  value numeric,
  occurred_at timestamptz not null default now(),
  note text
);

alter table goal_events enable row level security;
create policy "goal_events: owner all" on goal_events for all
  using (exists (select 1 from goals g where g.id = goal_events.goal_id and g.user_id = (select auth.uid())))
  with check (exists (select 1 from goals g where g.id = goal_events.goal_id and g.user_id = (select auth.uid())));

-- ---------------------------------------------------------------------
-- personal_records (brief section 27)
-- ---------------------------------------------------------------------
create table personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references exercises (id) on delete cascade,
  kind text not null check (kind in ('weight', 'reps', 'volume', 'estimated_1rm', 'distance', 'pace')),
  value numeric not null,
  unit text not null,
  achieved_at timestamptz not null,
  session_id uuid references training_sessions (id) on delete set null,
  previous_value numeric,
  created_at timestamptz not null default now()
);

alter table personal_records enable row level security;
create policy "personal_records: owner all" on personal_records for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create index personal_records_user_exercise_idx on personal_records (user_id, exercise_id, kind);

-- ---------------------------------------------------------------------
-- integrations + sync_runs (brief section 6/35) -- status only, no secrets.
-- ---------------------------------------------------------------------
create table integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('hevy', 'strava', 'garmin')),
  status text not null default 'not_configured' check (status in ('connected', 'not_configured', 'error', 'unavailable')),
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table integrations enable row level security;
create policy "integrations: owner all" on integrations for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('hevy', 'strava', 'garmin')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_fetched integer not null default 0,
  records_upserted integer not null default 0,
  records_deleted integer not null default 0,
  errors jsonb not null default '[]'::jsonb
);

alter table sync_runs enable row level security;
create policy "sync_runs: owner read" on sync_runs for select
  using ((select auth.uid()) = user_id);
-- No insert/update policy for authenticated/anon: only Edge Functions
-- (service_role, which bypasses RLS entirely) write sync_runs.

create index sync_runs_user_provider_idx on sync_runs (user_id, provider, started_at desc);

-- ---------------------------------------------------------------------
-- provider_tokens: OAuth/API secrets. Deliberately NOT selectable by
-- anon or authenticated roles -- only service_role (used inside Supabase
-- Edge Functions) can touch this table. There is no RLS policy granting
-- select/insert/update to anyone else, and RLS being enabled with zero
-- matching policies means "nobody but service_role", which is exactly
-- the point (see ARCHITECTURE.md, "Secrets").
-- ---------------------------------------------------------------------
create table provider_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('hevy', 'strava', 'garmin')),
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table provider_tokens enable row level security;
-- Intentionally no policies here.

-- ---------------------------------------------------------------------
-- cluster_tests + cluster_requirement_overrides (brief section 22-23)
-- ---------------------------------------------------------------------
create table cluster_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  requirement_id text not null, -- matches lib/cluster6/requirements.ts ids
  value numeric not null,
  tested_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

alter table cluster_tests enable row level security;
create policy "cluster_tests: owner all" on cluster_tests for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create index cluster_tests_user_requirement_idx on cluster_tests (user_id, requirement_id, tested_at desc);

create table cluster_requirement_overrides (
  user_id uuid not null references auth.users (id) on delete cascade,
  requirement_id text not null,
  target_value numeric,
  buffer_margin numeric,
  strong_buffer_margin numeric,
  updated_at timestamptz not null default now(),
  primary key (user_id, requirement_id)
);

alter table cluster_requirement_overrides enable row level security;
create policy "cluster_requirement_overrides: owner all" on cluster_requirement_overrides for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- achievements (brief section 49)
-- ---------------------------------------------------------------------
create table achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_key text not null, -- e.g. 'first_pr', 'bench_100kg', 'cluster6_run_target'
  achieved_at timestamptz not null default now(),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, achievement_key)
);

alter table achievements enable row level security;
create policy "achievements: owner all" on achievements for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
