const fs = require('fs');
const path = 'app/society-page.js';
let s = fs.readFileSync(path, 'utf8');
const importLine = "import { formatDatePtBr, WEEKDAY_LABELS, nextDateForWeekday, money, gameLocationQuery, gameMapUrls } from '../lib/ui/society-formatters';";
const serviceImport = "import { addGameParticipant, removeGameParticipant, toggleGameWaitlist, setGameCost, setGameGoalkeeperPays, setGamePixDetails, setGameOrganizer, setGameLocation, setGameMaxPlayers, setGameTeams } from '../lib/services/society-service';";
if (!s.includes(serviceImport)) {
  if (!s.includes(importLine)) throw new Error('formatter import not found');
  s = s.replace(importLine, `${importLine}\n${serviceImport}`);
}
const replacements = [
  ["const { error } = await supabase.from('game_confirmations').insert({ game_id: gameId, user_id: userId });", "const { error } = await addGameParticipant(gameId, userId);"],
  ["const { error } = await supabase.from('game_confirmations').delete().eq('game_id', gameId).eq('user_id', userId);", "const { error } = await removeGameParticipant(gameId, userId);"],
  ["const { error } = await supabase.from('games').update({ cost }).eq('id', gameId);", "const { error } = await setGameCost(gameId, cost);"],
  ["const { error } = await supabase.from('games').update({ goalkeeper_pays }).eq('id', gameId);", "const { error } = await setGameGoalkeeperPays(gameId, goalkeeper_pays);"],
  ["const { error } = await supabase.from('games').update({\n      pix_key: pixKey || null,\n      pix_receiver_name: pixReceiverName || null,\n      pix_city: pixCity || null,\n      pix_owner_id: pixOwnerId || null,\n    }).eq('id', gameId);", "const { error } = await setGamePixDetails(gameId, { pixKey, pixReceiverName, pixCity, pixOwnerId });"],
  ["const { error } = await supabase.from('games').update({ organizer_id: organizerId || null }).eq('id', gameId);", "const { error } = await setGameOrganizer(gameId, organizerId);"],
  ["const { error } = await supabase.from('games').update({ local: local || null, location_address: locationAddress, location_city: locationCity, location_state: locationState, location_latitude: locationLatitude, location_longitude: locationLongitude }).eq('id', gameId);", "const { error } = await setGameLocation(gameId, { local, locationAddress, locationCity, locationState, locationLatitude, locationLongitude });"],
  ["const { error } = await supabase.from('games').update({ max_players: maxPlayers }).eq('id', gameId);", "const { error } = await setGameMaxPlayers(gameId, maxPlayers);"],
  ["const { error } = await supabase.rpc('set_game_teams', { p_game_id: gameId, p_team_a: teamA, p_team_b: teamB });", "const { error } = await setGameTeams(gameId, teamA, teamB);"],
  ["const { error } = await supabase.rpc('set_game_teams', { p_game_id: gameId, p_team_a: teamA.map((p) => p.id), p_team_b: teamB.map((p) => p.id) });", "const { error } = await setGameTeams(gameId, teamA.map((p) => p.id), teamB.map((p) => p.id));"],
];
for (const [oldText, newText] of replacements) {
  if (!s.includes(oldText)) throw new Error(`pattern not found: ${oldText.slice(0, 90)}`);
  s = s.replace(oldText, newText);
}
const oldRsvp = `    let error = null;\n    if (g.confirmed.includes(myId)) {\n      ({ error } = await supabase.from('game_confirmations').delete().eq('game_id', gameId).eq('user_id', myId));\n    } else if ((g.waitlist || []).includes(myId)) {\n      ({ error } = await supabase.from('game_waitlist').delete().eq('game_id', gameId).eq('user_id', myId));\n    } else {\n      ({ error } = await supabase.from('game_confirmations').insert({ game_id: gameId, user_id: myId }));\n    }`;
const newRsvp = `    let response;\n    if (g.confirmed.includes(myId)) {\n      response = await removeGameParticipant(gameId, myId);\n    } else if ((g.waitlist || []).includes(myId)) {\n      response = await toggleGameWaitlist(gameId, myId, false);\n    } else {\n      response = await addGameParticipant(gameId, myId);\n    }\n    const { error } = response;`;
if (!s.includes(oldRsvp)) throw new Error('RSVP block not found');
s = s.replace(oldRsvp, newRsvp);
fs.writeFileSync(path, s);
console.log('Society service wiring applied');
