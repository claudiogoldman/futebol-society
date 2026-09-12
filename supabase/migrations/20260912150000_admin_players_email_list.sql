CREATE OR REPLACE FUNCTION public.get_admin_players_with_email()
RETURNS TABLE (
  id uuid,
  name text,
  nickname text,
  avatar_url text,
  phone text,
  is_admin boolean,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  ) THEN
    RAISE EXCEPTION 'ADMIN_ONLY';
  END IF;

  RETURN QUERY
  SELECT p.id, p.name, p.nickname, p.avatar_url, p.phone, p.is_admin, u.email::text
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY lower(COALESCE(NULLIF(btrim(p.nickname), ''), p.name, ''));
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_players_with_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_players_with_email() TO authenticated;
