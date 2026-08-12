-- Lets a user pin exercises they check often (bench/dips/pull-ups etc.)
-- to the top of the Exercises list. Server-side, not localStorage --
-- the user explicitly wants this to sync between phone and computer.
alter table exercises add column is_pinned boolean not null default false;
