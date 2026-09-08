-- Security hardening identified by Supabase advisors.
-- Keep trigger behavior unchanged while fixing search_path mutability and
-- remove unauthenticated EXECUTE access from an internal protection trigger.

ALTER FUNCTION public.set_game_chat_message_updated_at()
  SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.prevent_group_owner_change() FROM anon;
