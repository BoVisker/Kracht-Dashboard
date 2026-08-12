-- Strava's webhook events only carry a numeric athlete id (owner_id), never
-- a Supabase user_id -- this is what routes an incoming event back to the
-- right user. Nullable/generic on provider_tokens rather than a
-- Strava-specific table, since Hevy/Garmin could plausibly need the same
-- kind of mapping if they ever grow push-based sync too.
alter table provider_tokens add column external_account_id text;
