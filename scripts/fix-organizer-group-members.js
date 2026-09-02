const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'app', 'page.js');
let s = fs.readFileSync(file, 'utf8');

function r(oldText, newText, label) {
  if (!s.includes(oldText)) throw new Error(`anchor not found: ${label}`);
  s = s.replace(oldText, newText);
}

// Keep organizer membership filters safe while group data is still loading.
s = s.replaceAll('groupMembers.some(', '(groupMembers || []).some(');

// The organizer patch adds groupMembers to GameDetail, but the call site in the
// base source did not pass it. Without it the organizer dropdown contains only
// "Não definido" for grouped games.
r(
  `            roster={profiles}\n            myId={myId}`,
  `            roster={profiles}\n            groupMembers={groupMembers}\n            myId={myId}`,
  'GameDetail groupMembers prop'
);

// The RSVP card is a "Confirmados" card. It must list only confirmed users,
// never every profile in the database.
r(
  `        <div className="sf-rsvp-list" style={{ marginTop: 10 }}>\n          {roster.map((p) => {`,
  `        <div className="sf-rsvp-list" style={{ marginTop: 10 }}>\n          {roster.filter((p) => game.confirmed.includes(p.id)).map((p) => {`,
  'confirmed-only roster'
);

// Organizer can add an unconfirmed member of the game's group to the match.
r(
  `function GameDetail({ game, roster, groupMembers, myId, isAdmin, onBack, onToggleMyRSVP, onSetCost, onSetGkPays, onSetMaxPlayers, onSetGamePixDetails, onSetGameOrganizer, onSetGameLocation, onDraw, onTogglePaid, onSaveResult, onSavePlayerStats, onSaveRatings, onDelete, onShare }) {`,
  `function GameDetail({ game, roster, groupMembers, groupMemberIds, myId, isAdmin, onBack, onToggleMyRSVP, onAddParticipant, onRemoveParticipant, onSetCost, onSetGkPays, onSetMaxPlayers, onSetGamePixDetails, onSetGameOrganizer, onSetGameLocation, onDraw, onTogglePaid, onSaveResult, onSavePlayerStats, onSaveRatings, onDelete, onShare }) {`,
  'GameDetail participant props'
);

r(
  `  const [pixOwnerDraft, setPixOwnerDraft] = useState('');`,
  `  const [pixOwnerDraft, setPixOwnerDraft] = useState('');\n  const [participantDraft, setParticipantDraft] = useState('');`,
  'participant state'
);

r(
  `          })}\n        </div>\n      </section>\n\n      <section className="sf-card">\n        <div className="sf-card-title"><Shuffle size={16} /> Times</div>`,
  `          })}\n        </div>\n        {canManage && game.groupId && (\n          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginTop: 10 }}>\n            <select className="sf-input" value={participantDraft} onChange={(e) => setParticipantDraft(e.target.value)}>\n              <option value="">Adicionar jogador do grupo...</option>\n              {roster.filter((p) => groupMemberIds?.has(String(p.id)) && !game.confirmed.some((id) => String(id) === String(p.id))).map((p) => (\n                <option key={p.id} value={p.id}>{p.name}</option>\n              ))}\n            </select>\n            <button className="sf-btn-ghost" disabled={!participantDraft} onClick={async () => { await onAddParticipant(game.id, participantDraft); setParticipantDraft(''); }}>Adicionar</button>\n          </div>\n        )}\n      </section>\n\n      <section className="sf-card">\n        <div className="sf-card-title"><Shuffle size={16} /> Times</div>`,
  'participant selector UI'
);

r(
  `  const toggleMyRSVP = async (gameId) => {`,
  `  const addParticipant = async (gameId, userId) => {\n    const game = games.find((g) => g.id === gameId);\n    if (!game?.groupId) { alert('A partida precisa estar vinculada a um grupo.'); return; }\n    const member = groupMembers.some((m) => String(m.group_id) === String(game.groupId) && String(m.user_id) === String(userId));\n    if (!member) { alert('Só é possível adicionar jogadores que pertencem ao grupo da partida.'); return; }\n    const { error } = await supabase.from('game_confirmations').insert({ game_id: gameId, user_id: userId });\n    if (error) { alert('Não foi possível adicionar o jogador: ' + error.message); return; }\n    await loadAll();\n  };\n\n  const removeParticipant = async (gameId, userId) => {\n    const { error } = await supabase.from('game_confirmations').delete().eq('game_id', gameId).eq('user_id', userId);\n    if (error) { alert('Não foi possível remover o jogador: ' + error.message); return; }\n    await loadAll();\n  };\n\n  const toggleMyRSVP = async (gameId) => {`,
  'participant handlers'
);

r(
  `            roster={profiles}\n            groupMembers={groupMembers}\n            myId={myId}\n            isAdmin={!!me?.is_admin}`,
  `            roster={profiles}\n            groupMembers={groupMembers}\n            groupMemberIds={new Set(groupMembers.filter((m) => String(m.group_id) === String(selectedGame?.groupId)).map((m) => String(m.user_id)))}\n            myId={myId}\n            isAdmin={!!me?.is_admin}`,
  'GameDetail group member IDs'
);

r(
  `            onToggleMyRSVP={toggleMyRSVP}\n            onSetCost={setCost}`,
  `            onToggleMyRSVP={toggleMyRSVP}\n            onAddParticipant={addParticipant}\n            onRemoveParticipant={removeParticipant}\n            onSetCost={setCost}`,
  'GameDetail participant handlers'
);

// Reusable locations already exist in Supabase. Load them with the group data.
r(
  `  const [newGameGroupId, setNewGameGroupId] = useState(null);\n  const [newGameOrganizerId, setNewGameOrganizerId] = useState('');`,
  `  const [newGameGroupId, setNewGameGroupId] = useState(null);\n  const [newGameOrganizerId, setNewGameOrganizerId] = useState('');\n  const [groupLocations, setGroupLocations] = useState([]);\n  const [newGameLocationId, setNewGameLocationId] = useState('');`,
  'new-game location state'
);

r(
  `  const [profilesRes, gamesRes, confRes, teamsRes, paysRes, goalsRes, ratingsRes, groupsRes, groupMembersRes] = await Promise.all([`,
  `  const [profilesRes, gamesRes, confRes, teamsRes, paysRes, goalsRes, ratingsRes, groupsRes, groupMembersRes, groupLocationsRes] = await Promise.all([`,
  'loadAll result destructuring'
);

r(
  `      supabase.from('groups').select('*').order('name'),\n      supabase.from('group_members').select('*'),\n    ]);`,
  `      supabase.from('groups').select('*').order('name'),\n      supabase.from('group_members').select('*'),\n      supabase.from('group_locations').select('*').order('is_default', { ascending: false }).order('name'),\n    ]);`,
  'loadAll location query'
);

r(
  `    setGroupMembers(groupMembersRes.data || []);\n    setLoading(false);`,
  `    setGroupMembers(groupMembersRes.data || []);\n    setGroupLocations(groupLocationsRes.data || []);\n    setLoading(false);`,
  'store group locations'
);

r(
  `    setNewDate(''); setNewLocal(''); setNewLocationAddress(''); setNewLocationCity(''); setNewLocationState(''); setNewLocationLatitude(''); setNewLocationLongitude(''); setNewMaxPlayers(''); setNewGameGroupId(null); setNewGameOrganizerId('');`,
  `    setNewDate(''); setNewLocal(''); setNewLocationAddress(''); setNewLocationCity(''); setNewLocationState(''); setNewLocationLatitude(''); setNewLocationLongitude(''); setNewMaxPlayers(''); setNewGameGroupId(null); setNewGameOrganizerId(''); setNewGameLocationId('');`,
  'reset location selection'
);

// Selecting a group inherits its default reusable location.
r(
  `            setNewGameOrganizerId(g.defaultOrganizerId || '');\n            const defaultOrganizer = profiles.find((p) => p.id === g.defaultOrganizerId);`,
  `            const defaultLocation = groupLocations.find((l) => String(l.group_id) === String(g.id) && l.is_default) || groupLocations.find((l) => String(l.group_id) === String(g.id));\n            setNewGameLocationId(defaultLocation?.id || '');\n            if (defaultLocation) {\n              setNewLocal(defaultLocation.name || '');\n              setNewLocationAddress(defaultLocation.address || '');\n              setNewLocationCity(defaultLocation.city || '');\n              setNewLocationState(defaultLocation.state || '');\n              setNewLocationLatitude(defaultLocation.latitude != null ? String(defaultLocation.latitude) : '');\n              setNewLocationLongitude(defaultLocation.longitude != null ? String(defaultLocation.longitude) : '');\n            }\n            setNewGameOrganizerId(g.defaultOrganizerId || '');\n            const defaultOrganizer = profiles.find((p) => p.id === g.defaultOrganizerId);`,
  'group selection default location'
);

r(
  `            setNewGameOrganizerId('');\n            setNewGamePixKey('');`,
  `            setNewGameOrganizerId('');\n            setNewGameLocationId('');\n            setNewLocal('');\n            setNewLocationAddress('');\n            setNewLocationCity('');\n            setNewLocationState('');\n            setNewLocationLatitude('');\n            setNewLocationLongitude('');\n            setNewGamePixKey('');`,
  'clear location on no-group'
);

r(
  `            <label className="sf-field-label">Data</label>\n            <input type="date"`,
  `            {newGameGroupId && (\n              <>\n                <label className="sf-field-label">Local cadastrado no grupo</label>\n                <select className="sf-input" value={newGameLocationId} onChange={(e) => {\n                  const id = e.target.value;\n                  setNewGameLocationId(id);\n                  const location = groupLocations.find((l) => String(l.id) === String(id));\n                  if (location) {\n                    setNewLocal(location.name || '');\n                    setNewLocationAddress(location.address || '');\n                    setNewLocationCity(location.city || '');\n                    setNewLocationState(location.state || '');\n                    setNewLocationLatitude(location.latitude != null ? String(location.latitude) : '');\n                    setNewLocationLongitude(location.longitude != null ? String(location.longitude) : '');\n                  }\n                }}>\n                  <option value="">Selecionar local cadastrado...</option>\n                  {groupLocations.filter((l) => String(l.group_id) === String(newGameGroupId)).map((l) => (\n                    <option key={l.id} value={l.id}>{l.name}{l.is_default ? ' · padrão' : ''}</option>\n                  ))}\n                </select>\n              </>\n            )}\n            <label className="sf-field-label">Data</label>\n            <input type="date"`,
  'location selector UI'
);

fs.writeFileSync(file, s);
console.log('Organizer, participant and reusable-location fixes applied.');
