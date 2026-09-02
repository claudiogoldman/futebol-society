-- Functional rule: a grouped game's organizer must be a member of that group.
-- Group owners are members implicitly through is_group_member semantics.
-- Admins may change the organizer after creation; RLS already authorizes group-admin updates.

CREATE OR REPLACE FUNCTION public.validate_group_organizer_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.group_id IS NOT NULL AND NEW.organizer_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.groups g
      WHERE g.id = NEW.group_id
        AND (
          g.created_by = NEW.organizer_id
          OR EXISTS (
            SELECT 1
            FROM public.group_members gm
            WHERE gm.group_id = NEW.group_id
              AND gm.user_id = NEW.organizer_id
          )
        )
    ) THEN
      RAISE EXCEPTION 'O organizador da partida deve ser membro do grupo';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_group_organizer_membership ON public.games;
CREATE TRIGGER trg_validate_group_organizer_membership
BEFORE INSERT OR UPDATE OF group_id, organizer_id ON public.games
FOR EACH ROW
EXECUTE FUNCTION public.validate_group_organizer_membership();

-- The same rule applies to the group's configured default organizer.
CREATE OR REPLACE FUNCTION public.validate_group_default_organizer_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.default_organizer_id IS NOT NULL THEN
    IF NOT (
      NEW.created_by = NEW.default_organizer_id
      OR EXISTS (
        SELECT 1
        FROM public.group_members gm
        WHERE gm.group_id = NEW.id
          AND gm.user_id = NEW.default_organizer_id
      )
    ) THEN
      RAISE EXCEPTION 'O organizador padrão deve ser membro do grupo';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_group_default_organizer_membership ON public.groups;
CREATE TRIGGER trg_validate_group_default_organizer_membership
BEFORE INSERT OR UPDATE OF default_organizer_id, created_by ON public.groups
FOR EACH ROW
EXECUTE FUNCTION public.validate_group_default_organizer_membership();

REVOKE ALL ON FUNCTION public.validate_group_organizer_membership() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_group_organizer_membership() FROM anon;
GRANT EXECUTE ON FUNCTION public.validate_group_organizer_membership() TO authenticated;

REVOKE ALL ON FUNCTION public.validate_group_default_organizer_membership() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_group_default_organizer_membership() FROM anon;
GRANT EXECUTE ON FUNCTION public.validate_group_default_organizer_membership() TO authenticated;
