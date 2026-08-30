const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'app', 'page.js');
let s = fs.readFileSync(file, 'utf8');

function replaceOnce(from, to, label) {
  if (!s.includes(from)) throw new Error(`organizer patch: anchor not found: ${label}`);
  s = s.replace(from, to);
}

// Group default organizer state and persistence.
replaceOnce(
  "  const [avatarUploading, setAvatarUploading] = useState(false);\n",
  "  const [avatarUploading, setAvatarUploading] = useState(false);\n  const [organizerDraft, setOrganizerDraft] = useState(group.defaultOrganizerId || '');\n",
  'group state'
);
replaceOnce(
  "      default_pix_city: pixCityDraft.trim() || null,\n      avatar: avatarDraft,",
  "      default_pix_city: pixCityDraft.trim() || null,\n      default_organizer_id: organizerDraft || null,\n      avatar: avatarDraft,",
  'group save'
);
replaceOnce(
  "            <label className=\"sf-field-label\">Chave PIX padrão</label><input className=\"sf-input\" value={pixKeyDraft} onChange={(e) => setPixKeyDraft(e.target.value)} />",
  "            <label className=\"sf-field-label\">Organizador padrão das partidas</label>\n            <select className=\"sf-input\" value={organizerDraft} onChange={(e) => {\n              const id = e.target.value;\n              setOrganizerDraft(id);\n              const p = members.find((m) => m.id === id);\n              if (p?.pix_key) { setPixKeyDraft(p.pix_key); setPixReceiverDraft(p.name || ''); }\n            }}>\n              <option value=\"\">Nenhum organizador padrão</option>\n              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}\n            </select>\n            <div className=\"sf-muted-sm\">O PIX do organizador é usado como padrão na nova partida quando ele tiver uma chave cadastrada. O PIX da partida continua editável.</div>\n            <label className=\"sf-field-label\">Chave PIX padrão</label><input className=\"sf-input\" value={pixKeyDraft} onChange={(e) => setPixKeyDraft(e.target.value)} />",
  'group organizer UI'
);
replaceOnce(
  "            <div className=\"sf-cost-row\"><span className=\"sf-muted\">PIX</span><span className=\"sf-mono-value\" style={{ cursor: 'default' }}>{group.defaultPixKey || '—'}</span></div>",
  "            <div className=\"sf-cost-row\"><span className=\"sf-muted\">Organizador padrão</span><span className=\"sf-mono-value\" style={{ cursor: 'default' }}>{members.find((m) => m.id === group.defaultOrganizerId)?.name || '—'}</span></div>\n            <div className=\"sf-cost-row\"><span className=\"sf-muted\">PIX</span><span className=\"sf-mono-value\" style={{ cursor: 'default' }}>{group.defaultPixKey || '—'}</span></div>",
  'group summary'
);

// Game detail: expose the per-game organizer independently from PIX.
replaceOnce(
  "  const organizer = roster.find((p) => p.id === game.createdBy);\n",
  "  const organizer = roster.find((p) => p.id === (game.organizerId || game.createdBy));\n",
  'game organizer lookup'
);
replaceOnce(
  "  const mapUrls = gameMapUrls(game);\n",
  "  const mapUrls = gameMapUrls(game);\n",
  'game map anchor'
);
replaceOnce(
  "      <section className=\"sf-card\">\n        <div className=\"sf-card-title\"><Wallet size={16} /> Rateio</div>",
  "      <section className=\"sf-card\">\n        <div className=\"sf-card-title\"><Wallet size={16} /> Rateio</div>\n        <div className=\"sf-cost-row\">\n          <span className=\"sf-muted\">Organizador</span>\n          {canManage ? (\n            <select className=\"sf-input-inline\" value={game.organizerId || ''} onChange={(e) => onSetGameOrganizer(game.id, e.target.value || null)}>\n              <option value=\"\">Não definido</option>\n              {roster.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}\n            </select>\n          ) : (\n            <span className=\"sf-mono-value\" style={{ cursor: 'default' }}>{organizer?.name || '—'}</span>\n          )}\n        </div>",
  'game organizer UI'
);

// Main state for creation and assembled game mapping.
replaceOnce(
  "  const [newGameGroupId, setNewGameGroupId] = useState(null);\n",
  "  const [newGameGroupId, setNewGameGroupId] = useState(null);\n  const [newGameOrganizerId, setNewGameOrganizerId] = useState('');\n",
  'new game organizer state'
);
replaceOnce(
  "        groupId: g.group_id || null,\n        confirmed, teamA, teamB, payments, scorers, assists, ratings,",
  "        groupId: g.group_id || null,\n        organizerId: g.organizer_id || null,\n        confirmed, teamA, teamB, payments, scorers, assists, ratings,",
  'assembled organizer'
);
replaceOnce(
  "    await supabase.from('games').update({\n      pix_key: pixKey || null,",
  "    await supabase.from('games').update({\n      pix_key: pixKey || null,",
  'pix handler anchor'
);
replaceOnce(
  "  const setGameLocation = async (gameId, { local, locationAddress, locationCity, locationState, locationLatitude, locationLongitude }) => {",
  "  const setGameOrganizer = async (gameId, organizerId) => {\n    const { error } = await supabase.from('games').update({ organizer_id: organizerId || null }).eq('id', gameId);\n    if (error) { alert('Não foi possível alterar o organizador: ' + error.message); return; }\n    loadAll();\n  };\n\n  const setGameLocation = async (gameId, { local, locationAddress, locationCity, locationState, locationLatitude, locationLongitude }) => {",
  'organizer handler'
);

// Create-game snapshot: explicit organizer is stored; database trigger fills PIX fallback.
replaceOnce(
  "      cost: newGameCost === '' ? 0 : Number(newGameCost),\n      goalkeeper_pays: newGameGoalkeeperPays,",
  "      cost: newGameCost === '' ? 0 : Number(newGameCost),\n      organizer_id: newGameOrganizerId || null,\n      goalkeeper_pays: newGameGoalkeeperPays,",
  'create organizer'
);
replaceOnce(
  "    setNewDate(''); setNewLocal(''); setNewLocationAddress(''); setNewLocationCity(''); setNewLocationState(''); setNewLocationLatitude(''); setNewLocationLongitude(''); setNewMaxPlayers(''); setNewGameGroupId(null);\n",
  "    setNewDate(''); setNewLocal(''); setNewLocationAddress(''); setNewLocationCity(''); setNewLocationState(''); setNewLocationLatitude(''); setNewLocationLongitude(''); setNewMaxPlayers(''); setNewGameGroupId(null); setNewGameOrganizerId('');\n",
  'create reset'
);
replaceOnce(
  "    setNewGameGoalkeeperPays(group.defaultGoalkeeperPays !== false);\n    setNewGamePixKey(group.defaultPixKey || '');",
  "    setNewGameGoalkeeperPays(group.defaultGoalkeeperPays !== false);\n    setNewGameOrganizerId(group.defaultOrganizerId || '');\n    const defaultOrganizer = profiles.find((p) => p.id === group.defaultOrganizerId);\n    setNewGamePixKey(defaultOrganizer?.pix_key || group.defaultPixKey || '');\n    setNewGamePixReceiverName(defaultOrganizer?.pix_key ? (defaultOrganizer.name || '') : (group.defaultPixReceiverName || ''));",
  'open group defaults'
);
replaceOnce(
  "            setNewGameGoalkeeperPays(g.defaultGoalkeeperPays !== false);\n            setNewGamePixKey(g.defaultPixKey || '');",
  "            setNewGameGoalkeeperPays(g.defaultGoalkeeperPays !== false);\n            setNewGameOrganizerId(g.defaultOrganizerId || '');\n            const defaultOrganizer = profiles.find((p) => p.id === g.defaultOrganizerId);\n            setNewGamePixKey(defaultOrganizer?.pix_key || g.defaultPixKey || '');\n            setNewGamePixReceiverName(defaultOrganizer?.pix_key ? (defaultOrganizer.name || '') : (g.defaultPixReceiverName || ''));",
  'group select defaults'
);
replaceOnce(
  "            setNewGameGoalkeeperPays(true);\n            setNewGamePixKey('');",
  "            setNewGameGoalkeeperPays(true);\n            setNewGameOrganizerId('');\n            setNewGamePixKey('');",
  'group clear defaults'
);
replaceOnce(
  "      defaultPixCity: g.default_pix_city || '',\n      avatar: g.avatar || null,",
  "      defaultPixCity: g.default_pix_city || '',\n      defaultOrganizerId: g.default_organizer_id || null,\n      avatar: g.avatar || null,",
  'group mapping'
);

// Creation modal organizer selector.
replaceOnce(
  "            <label className=\"sf-field-label\">Data</label>\n            <input type=\"date\"",
  "            <label className=\"sf-field-label\">Organizador da partida</label>\n            <select className=\"sf-input\" value={newGameOrganizerId} onChange={(e) => {\n              const id = e.target.value;\n              setNewGameOrganizerId(id);\n              const p = profiles.find((x) => x.id === id);\n              if (p?.pix_key) { setNewGamePixKey(p.pix_key); setNewGamePixReceiverName(p.name || ''); }\n            }}>\n              <option value=\"\">Não definido</option>\n              {profiles.filter((p) => !newGameGroupId || groupMembers.some((m) => m.group_id === newGameGroupId && m.user_id === p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}\n            </select>\n            <label className=\"sf-field-label\">Data</label>\n            <input type=\"date\"",
  'creation organizer UI'
);

// Pass the new handler to GameDetail.
replaceOnce(
  "            onSetGamePixDetails={setGamePixDetails}\n            onSetGameLocation={setGameLocation}",
  "            onSetGamePixDetails={setGamePixDetails}\n            onSetGameOrganizer={setGameOrganizer}\n            onSetGameLocation={setGameLocation}",
  'handler prop'
);

fs.writeFileSync(file, s);
console.log('Organizer feature patch applied.');
