-- Trigger-only SECURITY DEFINER functions are not application RPCs.
-- Remove direct EXECUTE from authenticated clients and keep them callable by PostgreSQL triggers.
revoke execute on function public.enforce_game_confirmation_capacity() from authenticated;
revoke execute on function public.ensure_payment_participant_confirmation() from authenticated;
revoke execute on function public.validate_group_default_organizer_membership() from authenticated;
revoke execute on function public.validate_group_organizer_membership() from authenticated;
