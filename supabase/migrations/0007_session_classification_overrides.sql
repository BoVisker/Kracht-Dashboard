-- Manual override for the Push/Pull/Legs + Heavy/Volume classification that
-- TrainingPage otherwise derives live from the Hevy title
-- (src/lib/training/classifySession.ts). Documented gap: roughly 40% of
-- this user's real session titles are Hevy's generic defaults ("Afternoon
-- workout") with no recognizable keyword, and some titles that do have
-- keywords still get it wrong. Editing the title in Hevy itself doesn't
-- help -- hevy-sync overwrites `notes` from Hevy on every sync -- so the
-- correction has to live here instead, keyed off the session rather than
-- the title text.
--
-- `types` is an array (not a single enum column, unlike
-- training_sessions.training_type) because classifySessionType() already
-- returns combined types for a session like "push + benen" -- a
-- single-value override would lose information the heuristic itself keeps.
create table session_classification_overrides (
  session_id uuid primary key references training_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  types text[] not null default '{}' check (types <@ array['push', 'pull', 'legs']::text[]),
  subtype text check (subtype in ('heavy', 'volume')),
  updated_at timestamptz not null default now()
);

alter table session_classification_overrides enable row level security;
create policy "session_classification_overrides: owner all" on session_classification_overrides for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
