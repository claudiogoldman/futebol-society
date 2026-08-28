-- Game location data is optional and independent from the existing local/name field.
alter table public.games add column if not exists location_address text;
alter table public.games add column if not exists location_city text;
alter table public.games add column if not exists location_state text;
alter table public.games add column if not exists location_latitude numeric(9,6);
alter table public.games add column if not exists location_longitude numeric(9,6);

alter table public.games drop constraint if exists games_location_latitude_range;
alter table public.games add constraint games_location_latitude_range
  check (location_latitude is null or location_latitude between -90 and 90);

alter table public.games drop constraint if exists games_location_longitude_range;
alter table public.games add constraint games_location_longitude_range
  check (location_longitude is null or location_longitude between -180 and 180);
