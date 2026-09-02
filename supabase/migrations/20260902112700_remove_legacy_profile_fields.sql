-- Make the current profile model explicit: positions and age are the canonical fields used by the application.
-- The legacy single-position and birth-date columns are unused by the current app,
-- contain no data that cannot be preserved, and create two competing sources of truth.
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS position,
  DROP COLUMN IF EXISTS birth_date;
