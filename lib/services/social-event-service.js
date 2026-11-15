import { supabase } from '../supabaseClient';

// Churrasco Society service boundary.
// Public workflows must call token-validating RPCs; never query public tables directly.

const result = (response) => response;

export async function listSocialEvents(groupId) {
  return result(await supabase
    .from('social_events')
    .select('id, group_id, created_by, name, description, event_date, event_time, location, status, closure_type, closed_at, cancelled_at, created_at, updated_at')
    .eq('group_id', groupId)
    .order('event_date', { ascending: false })
    .order('event_time', { ascending: false }));
}

export async function createSocialEvent(fields) {
  return result(await supabase.rpc('create_social_event', {
    p_group_id: fields.groupId,
    p_name: fields.name,
    p_description: fields.description || null,
    p_event_date: fields.eventDate,
    p_event_time: fields.eventTime,
    p_location: fields.location || null,
  }));
}

export async function updateSocialEvent(eventId, fields) {
  return result(await supabase.rpc('update_social_event', {
    p_event_id: eventId,
    p_name: fields.name,
    p_description: fields.description || null,
    p_event_date: fields.eventDate,
    p_event_time: fields.eventTime,
    p_location: fields.location || null,
  }));
}

export async function closeSocialEvent(eventId) {
  return result(await supabase.rpc('close_social_event', { p_event_id: eventId }));
}

export async function reopenSocialEvent(eventId) {
  return result(await supabase.rpc('reopen_social_event', { p_event_id: eventId }));
}

export async function cancelSocialEvent(eventId) {
  return result(await supabase.rpc('cancel_social_event', { p_event_id: eventId }));
}

export async function addSocialEventGuest(eventId, name) {
  return result(await supabase.rpc('add_social_event_guest', {
    p_event_id: eventId,
    p_name: name,
  }));
}

export async function updateSocialEventGuest(guestId, name, status) {
  return result(await supabase.rpc('update_social_event_guest', {
    p_guest_id: guestId,
    p_name: name,
    p_status: status,
  }));
}

export async function deleteSocialEventGuest(guestId) {
  return result(await supabase.rpc('delete_social_event_guest', { p_guest_id: guestId }));
}

export async function getPublicSocialEvent(publicToken) {
  return result(await supabase.rpc('get_public_social_event', { p_public_token: publicToken }));
}

export async function addPublicSocialEventGuest(publicToken, name) {
  return result(await supabase.rpc('add_public_social_event_guest', {
    p_public_token: publicToken,
    p_name: name,
  }));
}

export async function setSocialEventGuestStatus(confirmationToken, status) {
  return result(await supabase.rpc('set_social_event_guest_status', {
    p_confirmation_token: confirmationToken,
    p_status: status,
  }));
}

export async function regenerateSocialEventPublicToken(eventId) {
  return result(await supabase.rpc('regenerate_social_event_public_token', { p_event_id: eventId }));
}

export async function listSocialEventGuests(eventId) {
  return result(await supabase
    .from('social_event_guests')
    .select('id, event_id, name, status, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true }));
}

export async function addSocialEventGuest(eventId, name) {
  return result(await supabase.rpc('add_social_event_guest', {
    p_event_id: eventId,
    p_name: name,
  }));
}
