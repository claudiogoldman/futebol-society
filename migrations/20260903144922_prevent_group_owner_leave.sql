-- Integrity rule: the group owner must remain a member of the group.
-- Ownership transfer is not exposed as a documented application operation.

CREATE OR REPLACE FUNCTION public.prevent_group_owner_leave()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.id = OLD.group_id
      AND g.created_by = OLD.user_id
  ) THEN
    RAISE EXCEPTION 'O proprietário do grupo não pode sair enquanto for o proprietário';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_group_owner_leave ON public.group_members;
CREATE TRIGGER trg_prevent_group_owner_leave
BEFORE DELETE ON public.group_members
FOR EACH ROW
EXECUTE FUNCTION public.prevent_group_owner_leave();

REVOKE ALL ON FUNCTION public.prevent_group_owner_leave() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_group_owner_leave() FROM anon;
GRANT EXECUTE ON FUNCTION public.prevent_group_owner_leave() TO authenticated;
