import { supabase } from '../supabaseClient';

export async function listNotifications(userId, { limit = 40 } = {}) {
  return supabase
    .from('notifications')
    .select('id, user_id, actor_id, type, title, body, game_id, group_id, message_id, created_at, read_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
}

export async function markNotificationRead(id, userId) {
  return supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .single();
}

export async function markAllNotificationsRead(userId) {
  return supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
}

export function subscribeToNotifications(userId, onInsert, onUpdate) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => onInsert?.(payload.new))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => onUpdate?.(payload.new))
    .subscribe();

  return () => supabase.removeChannel(channel);
}
