from pathlib import Path
p = Path('app/page.js')
s = p.read_text()

def rep(old, new):
    global s
    if old in s:
        s = s.replace(old, new, 1)
        return True
    return False

# State for overall/group roster and ranking scope.
rep("  const [subTab, setSubTab] = useState('elenco');", "  const [subTab, setSubTab] = useState('elenco');\n  const [elencoScope, setElencoScope] = useState('all');")

# Normalize confirmed IDs so UUID/string representation cannot silently drop a player.
rep("  const confirmedPlayers = game.confirmed.map((id) => roster.find((p) => p.id === id)).filter(Boolean);", "  const confirmedPlayers = game.confirmed.map((id) => roster.find((p) => String(p.id) === String(id))).filter(Boolean);")

# WhatsApp: explicit Unicode escapes prevent source/encoding corruption.
rep("    const msg = `Fala ${p.name}! ⚽ Só lembrando: falta ${money(rateio)} da quadra de ${formatDatePtBr(game.date)}${game.local ? ` (${game.local})` : ''}. Valeu! 🙏`;", "    const msg = `Fala ${p.name}! \\u26BD Só lembrando: falta ${money(rateio)} da quadra de ${formatDatePtBr(game.date)}${game.local ? ` (${game.local})` : ''}. Valeu! \\u{1F64F}`;")

# Administrative removal and guest-by-email flow.
rep("function GameDetail({ game, roster, myId, isAdmin, onBack, onToggleMyRSVP, onAddParticipant, onSetCost, onSetGkPays, onSetMaxPlayers, onSetGamePixDetails, onDraw, onTogglePaid, onSaveResult, onSaveRatings, onDelete, onShare })", "function GameDetail({ game, roster, myId, isAdmin, onBack, onToggleMyRSVP, onAddParticipant, onRemoveParticipant, onAddGuest, onSetCost, onSetGkPays, onSetMaxPlayers, onSetGamePixDetails, onDraw, onTogglePaid, onSaveResult, onSaveRatings, onDelete, onShare })")
rep("  const [participantDraft, setParticipantDraft] = useState('');", "  const [participantDraft, setParticipantDraft] = useState('');\n  const [guestNameDraft, setGuestNameDraft] = useState('');\n  const [guestEmailDraft, setGuestEmailDraft] = useState('');")

registered_block = '''        {canManage && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <select className="sf-input" value={participantDraft} onChange={(e) => setParticipantDraft(e.target.value)}>
              <option value="">Adicionar jogador cadastrado...</option>
              {roster.filter((p) => !game.confirmed.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{nationalityFlag(p.nationality_code)} {p.name}</option>)}
            </select>
            <button className="sf-btn-ghost" disabled={!participantDraft} onClick={async () => { await onAddParticipant(game.id, participantDraft); setParticipantDraft(''); }}>Adicionar</button>
          </div>
        )}
'''
replacement = registered_block + '''        {canManage && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 12 }}>
            <input className="sf-input" placeholder="Nome do convidado" value={guestNameDraft} onChange={(e) => setGuestNameDraft(e.target.value)} />
            <input className="sf-input" type="email" placeholder="Gmail (opcional)" value={guestEmailDraft} onChange={(e) => setGuestEmailDraft(e.target.value)} />
            <button className="sf-btn-ghost" disabled={!guestNameDraft.trim()} onClick={async () => { await onAddGuest(game.id, guestNameDraft, guestEmailDraft); setGuestNameDraft(''); setGuestEmailDraft(''); }}>Adicionar convidado</button>
          </div>
        )}
'''
rep(registered_block, replacement)

paid_tail = '''                    {!exempt && !paid && p.phone && (
                      <button className="sf-charge-btn" title={`Cobrar ${p.name} no WhatsApp`} onClick={() => chargeWhatsApp(p)}>
                        <MessageCircle size={13} />
                      </button>
                    )}
'''
rep(paid_tail, paid_tail + '''                    {canManage && p.id !== myId && (
                      <button className="sf-charge-btn" title={`Remover ${p.name} da partida`} onClick={() => { if (confirm(`Remover ${p.name} desta partida?`)) onRemoveParticipant(game.id, p.id); }}>
                        <Trash2 size={13} />
                      </button>
                    )}
''')

# Main handlers.
rep("  const addParticipant = async (gameId, userId) => {\n    const { error } = await supabase.from('game_confirmations').insert({ game_id: gameId, user_id: userId });\n    if (error) alert('Não foi possível adicionar o participante: ' + error.message);\n    await loadAll();\n  };", "  const addParticipant = async (gameId, userId) => {\n    const { error } = await supabase.from('game_confirmations').insert({ game_id: gameId, user_id: userId });\n    if (error) alert('Não foi possível adicionar o participante: ' + error.message);\n    await loadAll();\n  };\n\n  const removeParticipant = async (gameId, userId) => {\n    const { error } = await supabase.from('game_confirmations').delete().eq('game_id', gameId).eq('user_id', userId);\n    if (error) alert('Não foi possível remover o participante: ' + error.message);\n    await loadAll();\n  };\n\n  const addGuest = async (gameId, name, email) => {\n    const { error } = await supabase.rpc('add_game_guest', { p_game_id: gameId, p_name: name.trim(), p_email: email.trim() || null, p_nationality_code: 'BR' });\n    if (error) { alert('Não foi possível adicionar o convidado: ' + error.message); return; }\n    await loadAll();\n  };")

rep("            onAddParticipant={addParticipant}", "            onAddParticipant={addParticipant}\n            onRemoveParticipant={removeParticipant}\n            onAddGuest={addGuest}")

# Scope calculations: all players/games or selected group only.
rep("  const ranking = useMemo(() => computeRanking(profiles, games), [profiles, games]);", "  const scopedGroupId = elencoScope === 'all' ? null : elencoScope;\n  const scopedProfileIds = scopedGroupId ? new Set(groupMembers.filter((m) => m.group_id === scopedGroupId).map((m) => m.user_id)) : null;\n  const scopedProfiles = scopedProfileIds ? profiles.filter((p) => scopedProfileIds.has(p.id)) : profiles;\n  const scopedGames = scopedGroupId ? games.filter((g) => g.groupId === scopedGroupId) : games;\n  const ranking = useMemo(() => computeRanking(scopedProfiles, scopedGames), [scopedProfiles, scopedGames]);")

scope_ui = '''            <div className="sf-subtabs">
              <button className={`sf-subtab ${subTab === 'elenco' ? 'sf-subtab-on' : ''}`} onClick={() => setSubTab('elenco')}>Elenco</button>
              <button className={`sf-subtab ${subTab === 'ranking' ? 'sf-subtab-on' : ''}`} onClick={() => setSubTab('ranking')}>Ranking</button>
            </div>
'''
rep(scope_ui, scope_ui + '''            <select className="sf-input" value={elencoScope} onChange={(e) => setElencoScope(e.target.value)} style={{ marginBottom: 12 }}>
              <option value="all">Geral — todos os grupos</option>
              {groups.map((g) => <option key={g.id} value={g.id}>Grupo — {g.name}</option>)}
            </select>
''')
rep("{profiles.filter((p) => p.id !== myId).map((p) => (", "{scopedProfiles.filter((p) => p.id !== myId).map((p) => (")

p.write_text(s)
print('patched game management flows')
