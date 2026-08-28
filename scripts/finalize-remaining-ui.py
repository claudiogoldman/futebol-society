from pathlib import Path

p = Path('app/page.js')
s = p.read_text()

def rep(old, new):
    global s
    if old not in s:
        raise SystemExit(f'Missing anchor: {old[:120]}')
    s = s.replace(old, new, 1)

rep("const POSITION_ORDER = ['goleiro', 'fixo', 'libero', 'meio', 'ala_esquerdo', 'ala_direito', 'pivo'];", "const POSITION_ORDER = ['goleiro', 'fixo', 'libero', 'meio', 'ala_esquerdo', 'ala_direito', 'pivo'];\nconst NATIONALITIES = [{ code: 'BR', name: 'Brasil', flag: '🇧🇷' }, { code: 'AR', name: 'Argentina', flag: '🇦🇷' }, { code: 'UY', name: 'Uruguai', flag: '🇺🇾' }, { code: 'PT', name: 'Portugal', flag: '🇵🇹' }, { code: 'ES', name: 'Espanha', flag: '🇪🇸' }, { code: 'IT', name: 'Itália', flag: '🇮🇹' }, { code: 'DE', name: 'Alemanha', flag: '🇩🇪' }, { code: 'FR', name: 'França', flag: '🇫🇷' }, { code: 'GB', name: 'Reino Unido', flag: '🇬🇧' }, { code: 'US', name: 'Estados Unidos', flag: '🇺🇸' }, { code: 'MX', name: 'México', flag: '🇲🇽' }, { code: 'CL', name: 'Chile', flag: '🇨🇱' }, { code: 'CO', name: 'Colômbia', flag: '🇨🇴' }, { code: 'PY', name: 'Paraguai', flag: '🇵🇾' }, { code: 'OTHER', name: 'Outra', flag: '🌐' }];\nconst nationalityFlag = (code) => NATIONALITIES.find((n) => n.code === code)?.flag || '🌐';")
rep("const firstName = (player.name || '?').trim().split(' ')[0];", "const firstName = (player.name || '?').trim().split(' ')[0];\n  const flag = nationalityFlag(player.nationality_code);")
rep('<div className="sf-pcard-name">{firstName}</div>', '<div className="sf-pcard-name">{flag} {firstName}</div>')
rep("  const [pixDraft, setPixDraft] = useState(me.pix_key || '');", "  const [pixDraft, setPixDraft] = useState(me.pix_key || '');\n  const [nationalityDraft, setNationalityDraft] = useState(me.nationality_code || 'BR');")
rep("      <div className=\"sf-muted-sm\" style={{ margin: '8px 0 4px' }}>seu nível (autoavaliação)</div>", "      <div className=\"sf-muted-sm\" style={{ margin: '8px 0 4px' }}>Nacionalidade</div>\n      <select className=\"sf-input\" value={nationalityDraft} onChange={(e) => { setNationalityDraft(e.target.value); onUpdate({ nationality_code: e.target.value }); }}>\n        {NATIONALITIES.map((n) => <option key={n.code} value={n.code}>{n.flag} {n.name}</option>)}\n      </select>\n      <div className=\"sf-muted-sm\" style={{ margin: '8px 0 4px' }}>seu nível (autoavaliação)</div>")
rep("function GameDetail({ game, roster, myId, isAdmin, onBack, onToggleMyRSVP, onSetCost, onSetGkPays, onSetMaxPlayers, onSetGamePixDetails, onDraw, onTogglePaid, onSaveResult, onSaveRatings, onDelete, onShare })", "function GameDetail({ game, roster, myId, isAdmin, onBack, onToggleMyRSVP, onAddParticipant, onSetCost, onSetGkPays, onSetMaxPlayers, onSetGamePixDetails, onDraw, onTogglePaid, onSaveResult, onSaveRatings, onDelete, onShare })")
rep("  const [pixOwnerDraft, setPixOwnerDraft] = useState('');", "  const [pixOwnerDraft, setPixOwnerDraft] = useState('');\n  const [participantDraft, setParticipantDraft] = useState('');")
rep("  const canManage = myId === game.createdBy;", "  const canManage = isAdmin || myId === game.createdBy;")
anchor = "        <button className={`sf-btn-primary ${iAmConfirmed ? 'sf-btn-toggle-on' : ''}`} onClick={() => onToggleMyRSVP(game.id)}>"
insert = "        {canManage && (\n          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>\n            <select className=\"sf-input\" value={participantDraft} onChange={(e) => setParticipantDraft(e.target.value)}>\n              <option value=\"\">Adicionar jogador cadastrado...</option>\n              {roster.filter((p) => !game.confirmed.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{nationalityFlag(p.nationality_code)} {p.name}</option>)}\n            </select>\n            <button className=\"sf-btn-ghost\" disabled={!participantDraft} onClick={async () => { await onAddParticipant(game.id, participantDraft); setParticipantDraft(''); }}>Adicionar</button>\n          </div>\n        )}\n" + anchor
rep(anchor, insert)
rep("function GroupDetail({ group, games, members, myId, onBack, onSetDefaults, onShare, onNewGame, onOpenGame, onLeave, onDelete })", "function GroupDetail({ group, games, members, memberRoles, myId, onBack, onSetDefaults, onSetMemberRole, onShare, onNewGame, onOpenGame, onLeave, onDelete })")
rep("  const isOwner = myId === group.createdBy;", "  const isOwner = myId === group.createdBy;\n  const myRole = isOwner ? 'owner' : (memberRoles[myId] || 'member');\n  const canManage = isOwner || myRole === 'admin';")
rep("{isOwner && <button className=\"sf-btn-ghost\" style={{ width: '100%', marginTop: 6 }} onClick={() => setEditing(true)}>Editar padrões</button>}", "{canManage && <button className=\"sf-btn-ghost\" style={{ width: '100%', marginTop: 6 }} onClick={() => setEditing(true)}>Editar padrões</button>}")
rep("              <span className=\"sf-rsvp-name\">{m.name}{m.id === myId ? ' (você)' : ''}{m.id === group.createdBy ? ' · dono' : ''}</span>", "              <span className=\"sf-rsvp-name\">{nationalityFlag(m.nationality_code)} {m.name}{m.id === myId ? ' (você)' : ''} · <strong>{m.id === group.createdBy ? 'Owner' : (memberRoles[m.id] === 'admin' ? 'Admin' : 'Membro')}</strong></span>\n              {isOwner && m.id !== group.createdBy && <button className=\"sf-btn-ghost\" onClick={() => onSetMemberRole(group.id, m.id, memberRoles[m.id] === 'admin' ? 'member' : 'admin')}>{memberRoles[m.id] === 'admin' ? 'Rebaixar' : 'Promover a admin'}</button>}")
rep("  const [newGroupCost, setNewGroupCost] = useState('');", "  const [newGroupCost, setNewGroupCost] = useState('');")
rep("  const setGamePixDetails = async", "  const addParticipant = async (gameId, userId) => {\n    const { error } = await supabase.from('game_confirmations').insert({ game_id: gameId, user_id: userId });\n    if (error) alert('Não foi possível adicionar o participante: ' + error.message);\n    await loadAll();\n  };\n\n  const setGamePixDetails = async")
rep("  const leaveGroup = async", "  const setGroupMemberRole = async (groupId, userId, role) => {\n    const { error } = await supabase.from('group_members').update({ role }).eq('group_id', groupId).eq('user_id', userId);\n    if (error) alert('Não foi possível alterar o papel: ' + error.message);\n    await loadAll();\n  };\n\n  const leaveGroup = async")
# Add role map and selected member enrichment
rep("  const selectedGroup = groups.find((g) => g.id === selectedGroupId);", "  const selectedGroup = groups.find((g) => g.id === selectedGroupId);\n  const selectedGroupMemberRows = selectedGroup ? groupMembers.filter((m) => m.group_id === selectedGroup.id) : [];\n  const selectedGroupMembers = selectedGroupMemberRows.map((m) => profiles.find((p) => p.id === m.user_id)).filter(Boolean);\n  const selectedGroupMemberRoles = Object.fromEntries(selectedGroupMemberRows.map((m) => [m.user_id, m.role || 'member']));")
# render GameDetail props and GroupDetail props via anchors
rep("            onToggleMyRSVP={toggleMyRSVP}", "            onToggleMyRSVP={toggleMyRSVP}\n            onAddParticipant={addParticipant}")
# inject GroupDetail props where likely current members inline
rep("            group={selectedGroup}\n            games={games.filter((g) => g.groupId === selectedGroup.id)}", "            group={selectedGroup}\n            games={games.filter((g) => g.groupId === selectedGroup.id)}\n            members={selectedGroupMembers}\n            memberRoles={selectedGroupMemberRoles}")
# remove duplicate members prop if present after insertion
s = s.replace("            members={profiles.filter((p) => groupMembers.some((m) => m.group_id === selectedGroup.id && m.user_id === p.id))}\n", "")
rep("            onSetDefaults={setGroupDefaults}", "            onSetDefaults={setGroupDefaults}\n            onSetMemberRole={setGroupMemberRole}")
# ensure group admin calculation is passed to GameDetail rather than global profile admin when selected game render
s = s.replace("isAdmin={!!me?.is_admin}", "isAdmin={!!(selectedGame.groupId && selectedGroupMemberRows.length && selectedGroupMemberRoles[myId] === 'admin')}")

p.write_text(s)
print('patched app/page.js')
