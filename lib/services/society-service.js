import { supabase } from '../supabaseClient';

// Data-access layer for match/group mutations.
// Business rules remain in the caller/RPCs; this module only centralizes the
// existing Supabase writes already used by the Society UI.

const result = (response) => response;

export async function addGameParticipant(gameId, userId) {
  return result(await supabase.from('game_confirmations').insert({ game_id: gameId, user_id: userId }));
}
export async function removeGameParticipant(gameId, userId) {
  return result(await supabase.from('game_confirmations').delete().eq('game_id', gameId).eq('user_id', userId));
}
export async function toggleGameWaitlist(gameId, userId, queued) {
  return result(queued ? await supabase.from('game_waitlist').insert({ game_id: gameId, user_id: userId }) : await supabase.from('game_waitlist').delete().eq('game_id', gameId).eq('user_id', userId));
}
export async function setGameCost(gameId, cost) { return result(await supabase.from('games').update({ cost }).eq('id', gameId)); }
export async function setGameGoalkeeperPays(gameId, goalkeeperPays) { return result(await supabase.from('games').update({ goalkeeper_pays: goalkeeperPays }).eq('id', gameId)); }
export async function setGamePixDetails(gameId, { pixKey, pixReceiverName, pixCity, pixOwnerId }) {
  return result(await supabase.from('games').update({ pix_key: pixKey || null, pix_receiver_name: pixReceiverName || null, pix_city: pixCity || null, pix_owner_id: pixOwnerId || null }).eq('id', gameId));
}
export async function setGameOrganizer(gameId, organizerId) { return result(await supabase.from('games').update({ organizer_id: organizerId || null }).eq('id', gameId)); }
export async function setGameLocation(gameId, { local, locationAddress, locationCity, locationState, locationLatitude, locationLongitude }) {
  return result(await supabase.from('games').update({ local: local || null, location_address: locationAddress, location_city: locationCity, location_state: locationState, location_latitude: locationLatitude, location_longitude: locationLongitude }).eq('id', gameId));
}
export async function setGameMaxPlayers(gameId, maxPlayers) { return result(await supabase.from('games').update({ max_players: maxPlayers }).eq('id', gameId)); }
export async function setGameTeams(gameId, teamA, teamB) { return result(await supabase.rpc('set_game_teams', { p_game_id: gameId, p_team_a: teamA, p_team_b: teamB })); }
export async function setGamePayment(gameId, userId, paid) { return result(await supabase.from('payments').upsert({ game_id: gameId, user_id: userId, paid })); }
export async function setPlayerStats(gameId, userId, goals, assists) { return result(await supabase.from('goals').upsert({ game_id: gameId, user_id: userId, goals, assists })); }
export async function setGameResult(gameId, scoreA, scoreB) { return result(await supabase.from('games').update({ score_a: scoreA, score_b: scoreB }).eq('id', gameId)); }
export async function setGameGoals(gameId, rows) { return result(await supabase.from('goals').upsert(rows)); }
export async function setGameRatings(rows) { return result(await supabase.from('ratings').upsert(rows)); }
export async function createGame(fields) { return result(await supabase.from('games').insert(fields).select().single()); }
export async function createGroupLocation(groupId, draft, createdBy) {
  return result(await supabase.from('group_locations').insert({ group_id: groupId, name: draft.name.trim(), address: draft.address.trim() || null, city: draft.city.trim() || null, state: draft.state.trim().toUpperCase() || null, latitude: draft.latitude === '' ? null : Number(draft.latitude), longitude: draft.longitude === '' ? null : Number(draft.longitude), is_default: !!draft.isDefault, created_by: createdBy }).select().single());
}
export async function updateGroupLocation(groupId, locationId, draft) {
  return result(await supabase.from('group_locations').update({ name: draft.name.trim(), address: draft.address.trim() || null, city: draft.city.trim() || null, state: draft.state.trim().toUpperCase() || null, latitude: draft.latitude === '' ? null : Number(draft.latitude), longitude: draft.longitude === '' ? null : Number(draft.longitude) }).eq('id', locationId).eq('group_id', groupId));
}
export async function deleteGroupLocation(locationId) { return result(await supabase.from('group_locations').delete().eq('id', locationId)); }
export async function setGroupDefaultLocation(groupId, locationId) { return result(await supabase.rpc('set_group_default_location', { p_group_id: groupId, p_location_id: locationId || null })); }
export async function setGroupDefaults(groupId, fields) { return result(await supabase.from('groups').update(fields).eq('id', groupId)); }
export async function removeGroupMember(groupId, userId) { return result(await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId)); }
export async function leaveGroup(groupId, userId) { return removeGroupMember(groupId, userId); }
export async function deleteGame(gameId) { return result(await supabase.from('games').delete().eq('id', gameId)); }
export async function deleteGroup(groupId) { return result(await supabase.from('groups').delete().eq('id', groupId)); }
export async function updateMyProfile(userId, fields) { return result(await supabase.from('profiles').update(fields).eq('id', userId)); }
export async function setAdmin(userId, isAdmin) { return result(await supabase.from('profiles').update({ is_admin: isAdmin }).eq('id', userId)); }
export async function joinGameByToken(token) { return result(await supabase.rpc('join_game_by_token', { p_token: token })); }
export async function joinGroupByToken(token) { return result(await supabase.rpc('join_group_by_token', { p_token: token })); }
export async function addGameGuest(gameId, name, email, position) {
  return result(await supabase.rpc('add_game_guest', { p_game_id: gameId, p_name: name, p_email: email || null, p_nationality_code: 'BR', p_positions: position ? [position] : [] }));
}
export async function confirmOrganizer(gameId, userId) { return result(await supabase.from('game_confirmations').upsert({ game_id: gameId, user_id: userId }, { onConflict: 'game_id,user_id' })); }
export async function createGroup(fields) { return result(await supabase.from('groups').insert(fields).select().single()); }
export async function addGroupMember(groupId, userId) { return result(await supabase.from('group_members').insert({ group_id: groupId, user_id: userId })); }

export async function uploadProfileAvatar(userId, file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${userId}/avatar.${ext}`;
  const upload = await supabase.storage.from('avatars').upload(path, file, { upsert: true, cacheControl: '3600' });
  if (upload.error) return upload;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return { data: { path, publicUrl: data.publicUrl }, error: null };
}

export async function uploadGroupImage(groupId, userId, file) {
  const safeName = (file.name || 'grupo').replace(/[^a-zA-Z0-9._-]/g, '-');
  const filePath = groupId + '/' + userId + '/' + Date.now() + '-' + safeName;
  const upload = await supabase.storage.from('group-images').upload(filePath, file, { upsert: false, contentType: file.type });
  if (upload.error) return upload;
  const { data } = supabase.storage.from('group-images').getPublicUrl(filePath);
  return { data: { path: filePath, publicUrl: data.publicUrl }, error: null };
}
