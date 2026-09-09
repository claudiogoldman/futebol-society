import { supabase } from '../supabaseClient';

export async function listGameChatMessages(gameId, { limit = 100 } = {}) {
  return supabase
    .from('game_chat_messages')
    .select('id, game_id, user_id, message, created_at, updated_at')
    .eq('game_id', gameId)
    .order('created_at', { ascending: true })
    .limit(limit);
}

export async function sendGameChatMessage(gameId, userId, message) {
  const text = String(message || '').trim();
  if (!text) return { data: null, error: { message: 'Mensagem vazia.' } };
  if (text.length > 2000) return { data: null, error: { message: 'Mensagem excede 2000 caracteres.' } };

  return supabase
    .from('game_chat_messages')
    .insert({ game_id: gameId, user_id: userId, message: text })
    .select('id, game_id, user_id, message, created_at, updated_at')
    .single();
}

export async function createGameChatMentions(messageId, userIds = []) {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length) return { data: [], error: null };
  return supabase.from('game_chat_message_mentions').insert(
    ids.map((mentioned_user_id) => ({ message_id: messageId, mentioned_user_id }))
  );
}

export async function updateGameChatMessage(messageId, userId, message) {
  const text = String(message || '').trim();
  if (!text) return { data: null, error: { message: 'Mensagem vazia.' } };
  if (text.length > 2000) return { data: null, error: { message: 'Mensagem excede 2000 caracteres.' } };

  return supabase
    .from('game_chat_messages')
    .update({ message: text })
    .eq('id', messageId)
    .eq('user_id', userId)
    .select('id, game_id, user_id, message, created_at, updated_at')
    .single();
}

export async function deleteGameChatMessage(messageId, userId) {
  return supabase
    .from('game_chat_messages')
    .delete()
    .eq('id', messageId)
    .eq('user_id', userId);
}

export async function listGameChatReactions(messageIds = []) {
  const ids = [...new Set(messageIds)].filter(Boolean);
  if (!ids.length) return { data: [], error: null };
  return supabase
    .from('game_chat_message_reactions')
    .select('id, message_id, user_id, reaction, created_at')
    .in('message_id', ids);
}

export async function toggleGameChatReaction(messageId, userId, reaction) {
  const allowed = ['👍', '❤️', '😂', '⚽'];
  if (!allowed.includes(reaction)) return { data: null, error: { message: 'Reação inválida.' } };

  const { data: existing, error: findError } = await supabase
    .from('game_chat_message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('reaction', reaction)
    .maybeSingle();
  if (findError) return { data: null, error: findError };

  if (existing) {
    return supabase.from('game_chat_message_reactions').delete().eq('id', existing.id).eq('user_id', userId);
  }
  return supabase.from('game_chat_message_reactions').insert({ message_id: messageId, user_id: userId, reaction });
}

export function subscribeToGameChat(gameId, onInsert, onUpdate, onDelete, onReactionChange) {
  const channel = supabase
    .channel(`game-chat:${gameId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_chat_messages', filter: `game_id=eq.${gameId}` }, (payload) => onInsert?.(payload.new))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_chat_messages', filter: `game_id=eq.${gameId}` }, (payload) => onUpdate?.(payload.new))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'game_chat_messages', filter: `game_id=eq.${gameId}` }, (payload) => onDelete?.(payload.old))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_chat_message_reactions' }, (payload) => onReactionChange?.({ type: 'INSERT', reaction: payload.new }))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'game_chat_message_reactions' }, (payload) => onReactionChange?.({ type: 'DELETE', reaction: payload.old }))
    .subscribe();

  return () => supabase.removeChannel(channel);
}
