create or replace function public.get_admin_user_profile(p_user_id uuid)
returns table (
  id uuid, name text, nickname text, avatar_url text, rating integer, created_at timestamptz,
  preferred_foot text, weight_kg numeric, positions text[], phone text, age integer,
  is_admin boolean, pix_key text, attr_ata integer, attr_def integer, attr_for integer,
  attr_hab integer, nationality_code text, email text
)
language plpgsql security definer set search_path = public, auth
as $$
begin
  if not public.is_global_admin() then raise exception 'ADMIN_ONLY'; end if;
  return query
  select p.id,p.name,p.nickname,p.avatar_url,p.rating,p.created_at,p.preferred_foot,p.weight_kg,
         p.positions,p.phone,p.age,p.is_admin,p.pix_key,p.attr_ata,p.attr_def,p.attr_for,p.attr_hab,
         p.nationality_code,u.email::text
  from public.profiles p
  left join auth.users u on u.id=p.id
  where p.id=p_user_id;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
end;
$$;

create or replace function public.admin_update_user_profile(
  p_user_id uuid, p_name text, p_nickname text, p_avatar_url text, p_rating integer,
  p_preferred_foot text, p_weight_kg numeric, p_positions text[], p_phone text, p_age integer,
  p_is_admin boolean, p_pix_key text, p_attr_ata integer, p_attr_def integer, p_attr_for integer,
  p_attr_hab integer, p_nationality_code text, p_email text
)
returns uuid
language plpgsql security definer set search_path = public, auth
as $$
begin
  if not public.is_global_admin() then raise exception 'ADMIN_ONLY'; end if;
  if p_user_id is null or not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'USER_NOT_FOUND'; end if;
  if nullif(btrim(coalesce(p_name,'')),'') is null then raise exception 'NAME_REQUIRED'; end if;
  if p_rating is null or p_rating < 0 or p_rating > 100 then raise exception 'INVALID_RATING'; end if;
  if p_age is not null and (p_age < 0 or p_age > 120) then raise exception 'INVALID_AGE'; end if;
  if p_weight_kg is not null and (p_weight_kg < 0 or p_weight_kg > 500) then raise exception 'INVALID_WEIGHT'; end if;
  if p_attr_ata is not null and (p_attr_ata < 0 or p_attr_ata > 100) then raise exception 'INVALID_ATA'; end if;
  if p_attr_def is not null and (p_attr_def < 0 or p_attr_def > 100) then raise exception 'INVALID_DEF'; end if;
  if p_attr_for is not null and (p_attr_for < 0 or p_attr_for > 100) then raise exception 'INVALID_FOR'; end if;
  if p_attr_hab is not null and (p_attr_hab < 0 or p_attr_hab > 100) then raise exception 'INVALID_HAB'; end if;
  if p_email is null or nullif(btrim(p_email),'') is null then raise exception 'EMAIL_REQUIRED'; end if;
  if p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'INVALID_EMAIL'; end if;
  if p_user_id=auth.uid() and p_is_admin=false then raise exception 'CANNOT_DEMOTE_SELF'; end if;

  update public.profiles set
    name=btrim(p_name), nickname=nullif(btrim(coalesce(p_nickname,'')),''), avatar_url=nullif(btrim(coalesce(p_avatar_url,'')),''),
    rating=p_rating, preferred_foot=nullif(btrim(coalesce(p_preferred_foot,'')),''), weight_kg=p_weight_kg,
    positions=coalesce(p_positions, array[]::text[]), phone=nullif(btrim(coalesce(p_phone,'')),''), age=p_age,
    is_admin=p_is_admin, pix_key=nullif(btrim(coalesce(p_pix_key,'')),''), attr_ata=p_attr_ata, attr_def=p_attr_def,
    attr_for=p_attr_for, attr_hab=p_attr_hab, nationality_code=nullif(btrim(coalesce(p_nationality_code,'')),'')
  where id=p_user_id;

  update auth.users set email=lower(btrim(p_email)), email_change=null, email_change_token_new=null, email_change_confirm_status=null
  where id=p_user_id;
  if not found then raise exception 'AUTH_USER_NOT_FOUND'; end if;
  return p_user_id;
exception when unique_violation then raise exception 'EMAIL_ALREADY_IN_USE';
end;
$$;

grant execute on function public.get_admin_user_profile(uuid) to authenticated;
grant execute on function public.admin_update_user_profile(uuid,text,text,text,integer,text,numeric,text[],text,integer,boolean,text,integer,integer,integer,integer,text,text) to authenticated;
