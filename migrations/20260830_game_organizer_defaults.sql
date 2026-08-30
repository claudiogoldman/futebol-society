-- Organizer defaults for groups and per-game organizer snapshots.
-- No existing organizer is inferred or backfilled.
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS default_organizer_id uuid;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS organizer_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'groups_default_organizer_id_fkey'
  ) THEN
    ALTER TABLE public.groups
      ADD CONSTRAINT groups_default_organizer_id_fkey
      FOREIGN KEY (default_organizer_id) REFERENCES public.profiles(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'games_organizer_id_fkey'
  ) THEN
    ALTER TABLE public.games
      ADD CONSTRAINT games_organizer_id_fkey
      FOREIGN KEY (organizer_id) REFERENCES public.profiles(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_groups_default_organizer_id
  ON public.groups(default_organizer_id);
CREATE INDEX IF NOT EXISTS idx_games_organizer_id
  ON public.games(organizer_id);

-- When a grouped game is created without explicit per-game organizer/PIX,
-- snapshot the configured group organizer and the appropriate PIX data.
CREATE OR REPLACE FUNCTION public.apply_game_organizer_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group public.groups%ROWTYPE;
  v_org public.profiles%ROWTYPE;
BEGIN
  IF NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_group FROM public.groups WHERE id = NEW.group_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.organizer_id IS NULL AND v_group.default_organizer_id IS NOT NULL THEN
    NEW.organizer_id := v_group.default_organizer_id;
  END IF;

  IF NEW.organizer_id IS NOT NULL THEN
    SELECT * INTO v_org FROM public.profiles WHERE id = NEW.organizer_id;
    IF FOUND AND NULLIF(trim(v_org.pix_key), '') IS NOT NULL THEN
      IF NULLIF(trim(NEW.pix_key), '') IS NULL THEN NEW.pix_key := v_org.pix_key; END IF;
      IF NULLIF(trim(NEW.pix_receiver_name), '') IS NULL THEN NEW.pix_receiver_name := v_org.name; END IF;
    END IF;
  END IF;

  IF NULLIF(trim(NEW.pix_key), '') IS NULL THEN NEW.pix_key := v_group.default_pix_key; END IF;
  IF NULLIF(trim(NEW.pix_receiver_name), '') IS NULL THEN NEW.pix_receiver_name := v_group.default_pix_receiver_name; END IF;
  IF NULLIF(trim(NEW.pix_city), '') IS NULL THEN NEW.pix_city := v_group.default_pix_city; END IF;
  IF NEW.pix_owner_id IS NULL THEN NEW.pix_owner_id := COALESCE(NEW.organizer_id, v_group.default_pix_owner_id); END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_game_organizer_defaults ON public.games;
CREATE TRIGGER trg_apply_game_organizer_defaults
BEFORE INSERT ON public.games
FOR EACH ROW EXECUTE FUNCTION public.apply_game_organizer_defaults();
