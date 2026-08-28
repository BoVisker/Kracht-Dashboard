-- Weekly training-plan template (roadmap: "trainingsplan-editor"). This is
-- deliberately separate from the Push/Pull/Legs + Heavy/Volume
-- *classification* on training_sessions (that reads what you already did,
-- derived from Hevy titles) -- this is about planning what to do next.
--
-- One row per planned slot in the week, not per calendar date: a plan is a
-- repeating template ("dinsdag = Pull Heavy + Easy Run"), not a schedule of
-- specific days. A weekday can have more than one slot (that same Tuesday
-- example), ordered by sort_order. training_sessions.planned_session_id
-- (added in 0001) is left for a future pass that matches an actual session
-- back to the slot it fulfilled -- out of scope here, see README.
create table planned_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day_of_week text not null check (day_of_week in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  sort_order integer not null default 0,
  training_type text not null check (training_type in ('push', 'pull', 'legs', 'cardio', 'rest', 'other')),
  training_subtype text check (training_subtype in ('heavy', 'volume')),
  label text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table planned_sessions enable row level security;
create policy "planned_sessions: owner all" on planned_sessions for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create index planned_sessions_user_day_idx on planned_sessions (user_id, day_of_week, sort_order);

-- Add fk now that the referenced table exists (0001 left this column
-- unconstrained since planned_sessions didn't exist yet).
alter table training_sessions
  add constraint training_sessions_planned_session_id_fkey
  foreign key (planned_session_id) references planned_sessions (id) on delete set null;
