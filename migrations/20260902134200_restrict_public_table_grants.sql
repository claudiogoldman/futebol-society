-- RLS controls rows; table privileges also control operations such as TRUNCATE.
-- Close the public schema to anon and grant authenticated only required CRUD.
DO $$
declare t text;
begin
  foreach t in array array['profiles','games','groups','group_members','group_locations','game_confirmations','game_teams','game_guests','game_waitlist','goals','payments','ratings'] loop
    execute format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    execute format('REVOKE ALL ON TABLE public.%I FROM authenticated', t);
  end loop;
end $$;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.games TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_locations TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.game_confirmations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_guests TO authenticated;
GRANT SELECT, DELETE ON public.game_waitlist TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ratings TO authenticated;
