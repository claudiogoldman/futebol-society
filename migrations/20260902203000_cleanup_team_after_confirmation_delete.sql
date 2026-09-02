-- Keep team membership consistent with the game participant roster.
-- Business rule preserved: deleting a confirmation removes that player's
-- assignment from game_teams, while payments/goals/ratings are retained.
-- This avoids orphan team assignments without inventing financial/statistical
-- deletion semantics that are not defined by the current requirements.

create or replace function public.cleanup_game_team_after_confirmation_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.game_teams
  where game_id = old.game_id
    and user_id = old.user_id;
  return old;
end;
$$;

revoke all on function public.cleanup_game_team_after_confirmation_delete() from public, anon, authenticated;

drop trigger if exists trg_cleanup_game_team_after_confirmation_delete on public.game_confirmations;

create trigger trg_cleanup_game_team_after_confirmation_delete
after delete on public.game_confirmations
for each row
execute function public.cleanup_game_team_after_confirmation_delete();
