-- Integrity rule: group ownership is immutable through the generic groups UPDATE policy.
-- Ownership transfer is not exposed as a documented application operation, so prevent
-- an administrator from changing created_by and thereby becoming the owner.

CREATE OR REPLACE FUNCTION public.prevent_group_owner_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'O proprietário do grupo não pode ser alterado diretamente';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_group_owner_change ON public.groups;
CREATE TRIGGER trg_prevent_group_owner_change
BEFORE UPDATE OF created_by ON public.groups
FOR EACH ROW
EXECUTE FUNCTION public.prevent_group_owner_change();

REVOKE ALL ON FUNCTION public.prevent_group_owner_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_group_owner_change() FROM anon;
GRANT EXECUTE ON FUNCTION public.prevent_group_owner_change() TO authenticated;
