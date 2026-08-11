-- Strava's activity API returns average_heartrate (and sometimes
-- max_heartrate) as a float, e.g. 143.8 -- an average over an activity is
-- legitimately fractional. `integer` rejected that outright ("invalid
-- input syntax for type integer") the first time a real sync ran.
alter table cardio_sessions
  alter column average_heart_rate type numeric,
  alter column max_heart_rate type numeric;
