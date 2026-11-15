-- Keep state transitions and token material behind validated RPCs.
-- Authenticated group members can read event metadata; only RPCs can mutate.
revoke insert, update, delete on table public.social_events from authenticated;
grant select on table public.social_events to authenticated;

-- Administrators read guest rows, but all guest writes use the RPCs.
revoke insert, update, delete on table public.social_event_guests from authenticated;
grant select on table public.social_event_guests to authenticated;
