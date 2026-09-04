alter table public.group_locations
  alter column created_by drop not null;

alter table public.game_guests
  alter column created_by drop not null;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  update public.games
     set created_by = null,
         organizer_id = null,
         pix_owner_id = null
   where created_by = v_user_id
      or organizer_id = v_user_id
      or pix_owner_id = v_user_id;

  update public.groups
     set created_by = null,
         default_organizer_id = null,
         default_pix_owner_id = null
   where created_by = v_user_id
      or default_organizer_id = v_user_id
      or default_pix_owner_id = v_user_id;

  update public.group_locations
     set created_by = null
   where created_by = v_user_id;

  update public.game_guests
     set created_by = null
   where created_by = v_user_id;

  delete from public.profiles
   where id = v_user_id;

  delete from auth.users
   where id = v_user_id;

  if not found then
    raise exception 'Conta de autenticação não encontrada';
  end if;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
