import { supabase } from '../supabaseClient';

export async function setGroupParticipationPenaltySettings(groupId, { enabled, hours, games }) {
  return supabase
    .from('groups')
    .update({
      participation_penalty_enabled: Boolean(enabled),
      participation_penalty_hours: Number(hours),
      participation_penalty_games: Number(games),
    })
    .eq('id', groupId);
}
