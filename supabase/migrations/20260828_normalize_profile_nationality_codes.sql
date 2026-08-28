-- Nationality is stored as ISO 3166-1 alpha-2 so the UI can deterministically
-- render the associated flag without duplicating a country name/flag pair.
alter table public.profiles alter column nationality_code set default 'BR';
update public.profiles set nationality_code = upper(trim(nationality_code)) where nationality_code is not null;
update public.profiles set nationality_code = 'BR' where nationality_code is null or nationality_code = '';
alter table public.profiles drop constraint if exists profiles_nationality_code_format;
alter table public.profiles add constraint profiles_nationality_code_format check (nationality_code ~ '^[A-Z]{2}$');
