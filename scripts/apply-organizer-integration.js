const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'app', 'page.js');
let s = fs.readFileSync(file, 'utf8');
function r(a,b,n){if(!s.includes(a)) throw new Error('organizer integration anchor not found: '+n); s=s.replace(a,b);}
r("function GameDetail({ game, roster, myId, isAdmin, onBack, onToggleMyRSVP, onSetCost, onSetGkPays, onSetMaxPlayers, onSetGamePixDetails, onSetGameLocation, onDraw, onTogglePaid, onSaveResult, onSavePlayerStats, onSaveRatings, onDelete, onShare }) {", "function GameDetail({ game, roster, groupMembers, myId, isAdmin, onBack, onToggleMyRSVP, onSetCost, onSetGkPays, onSetMaxPlayers, onSetGamePixDetails, onSetGameOrganizer, onSetGameLocation, onDraw, onTogglePaid, onSaveResult, onSavePlayerStats, onSaveRatings, onDelete, onShare }) {", 'GameDetail signature');
r("roster.filter((p) => !game.groupId || groupMembersForOrganizer(game, p.id))", "roster.filter((p) => !game.groupId || groupMembers.some((m) => m.group_id === game.groupId && m.user_id === p.id))", 'organizer membership');
r("            game={selectedGame}\n            roster={profiles}", "            game={selectedGame}\n            roster={profiles}\n            groupMembers={groupMembers}", 'GameDetail props');
fs.writeFileSync(file,s);
console.log('Organizer integration prepared.');
