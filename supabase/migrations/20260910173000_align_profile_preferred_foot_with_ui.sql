-- Keep the persisted preferred-foot values aligned with the application UI.
-- The UI uses: direito, esquerdo, ambidestro.
-- Older production data used: destro, canhoto, ambidestro.

alter table public.profiles drop constraint if exists profiles_preferred_foot_check;

drop trigger if exists trg_normalize_profile_preferred_foot on public.profiles;
drop function if exists public.normalize_profile_preferred_foot();

update public.profiles
set preferred_foot = case preferred_foot
  when 'destro' then 'direito'
  when 'canhoto' then 'esquerdo'
  else preferred_foot
end
where preferred_foot in ('destro', 'canhoto');

alter table public.profiles
  add constraint profiles_preferred_foot_check
  check (preferred_foot = any (array['direito'::text, 'esquerdo'::text, 'ambidestro'::text]));
