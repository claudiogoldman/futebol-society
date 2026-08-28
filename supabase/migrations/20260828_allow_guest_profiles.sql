-- Guest players are represented by synthetic profiles created by the secured
-- add_game_guest() function. Their UUIDs are intentionally not auth.users IDs.
-- The function creates the guest profile with a generated UUID and links it to
-- game_guests; game_confirmations also uses the profile UUID as its participant ID.
-- Therefore the profiles.id -> auth.users.id FK cannot be enforced for guests.
alter table public.profiles drop constraint if exists profiles_id_fkey;
