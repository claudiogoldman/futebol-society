from pathlib import Path
p=Path('app/page.js')
s=p.read_text()

def once(old,new):
    global s
    if old in s:
        s=s.replace(old,new,1); return True
    return False

# Android/mobile logout: force local session cleanup and navigation.
once("  const toggleAdmin = async (userId, isAdmin) => {\n", "  const handleLogout = async () => {\n    try {\n      const { error } = await supabase.auth.signOut({ scope: 'local' });\n      if (error) throw error;\n    } catch (error) { console.error('logout failed', error); }\n    finally {\n      if (typeof window !== 'undefined') {\n        try { sessionStorage.clear(); } catch {}\n        window.location.replace('/');\n      }\n    }\n  };\n\n  const toggleAdmin = async (userId, isAdmin) => {\n")
once("<button className=\"sf-icon-btn\" title=\"Sair\" onClick={() => supabase.auth.signOut()}><LogOut size={18} /></button>", "<button className=\"sf-icon-btn\" title=\"Sair\" aria-label=\"Sair\" onClick={handleLogout}><LogOut size={18} /></button>")

# Game participant/guest separation.
once("function GameDetail({ game, roster, myId, isAdmin, onBack, onToggleMyRSVP, onSetCost,", "function GameDetail({ game, roster, groupMemberIds, myId, isAdmin, onBack, onToggleMyRSVP, onAddParticipant, onRemoveParticipant, onAddGuest, onSaveOwnStats, onSetCost,")
once("  const [pixOwnerDraft, setPixOwnerDraft] = useState('');\n", "  const [pixOwnerDraft, setPixOwnerDraft] = useState('');\n  const [participantDraft, setParticipantDraft] = useState('');\n  const [guestNameDraft, setGuestNameDraft] = useState('');\n  const [guestEmailDraft, setGuestEmailDraft] = useState('');\n")

anchor="""        <div className=\"sf-rsvp-list\" style={{ marginTop: 10 }}>\n          {roster.map((p) => {\n            const on = game.confirmed.includes(p.id);\n            const onWaitlist = waitlistPlayers.some((w) => w.id === p.id);\n            return (\n              <div key={p.id} className={`sf-rsvp-row ${on ? 'sf-rsvp-on' : ''} ${p.id === myId ? 'sf-rsvp-me' : ''} ${onWaitlist ? 'sf-rsvp-waitlist' : ''}`}>\n                <span className=\"sf-rsvp-check\">{on && !onWaitlist ? <Check size={14} /> : null}</span>\n                <span className=\"sf-rsvp-name\">\n                  {isGoleiro(p) && <span className=\"sf-gk-tag\" title=\"Goleiro\"><Hand size={10} /> GOL</span>}\n                  {p.name}{p.id === myId ? ' (você)' : ''}\n                </span>\n                {onWaitlist && <span className=\"sf-waitlist-tag\">espera #{waitlistPlayers.findIndex((w) => w.id === p.id) + 1}</span>}\n                <StarRating value={p.rating} readOnly size={12} onChange={() => {}} />\n              </div>\n            );\n          })}\n        </div>\n"""
replacement=anchor+"""        {canManage && game.groupId && (\n          <>\n            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginTop: 10 }}>\n              <select className=\"sf-input\" value={participantDraft} onChange={(e) => setParticipantDraft(e.target.value)}>\n                <option value=\"\">Adicionar jogador do grupo...</option>\n                {roster.filter((p) => groupMemberIds?.has(String(p.id)) && !game.confirmed.some((id) => String(id) === String(p.id))).map((p) => (\n                  <option key={p.id} value={p.id}>{p.name}</option>\n                ))}\n              </select>\n              <button className=\"sf-btn-ghost\" disabled={!participantDraft} onClick={async () => { await onAddParticipant(game.id, participantDraft); setParticipantDraft(''); }}>Adicionar</button>\n            </div>\n            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginTop: 8 }}>\n              <input className=\"sf-input\" placeholder=\"Nome do convidado\" value={guestNameDraft} onChange={(e) => setGuestNameDraft(e.target.value)} />\n              <input className=\"sf-input\" type=\"email\" placeholder=\"E-mail (opcional)\" value={guestEmailDraft} onChange={(e) => setGuestEmailDraft(e.target.value)} />\n              <button className=\"sf-btn-ghost\" disabled={!guestNameDraft.trim()} onClick={async () => { await onAddGuest(game.id, guestNameDraft, guestEmailDraft); setGuestNameDraft(''); setGuestEmailDraft(''); }}>Adicionar convidado</button>\n            </div>\n          </>\n        )}\n"""
once(anchor,replacement)
nonce("                <StarRating value={p.rating} readOnly size={12} onChange={() => {}} />\n              </div>", "                <StarRating value={p.rating} readOnly size={12} onChange={() => {}} />\n                {canManage && on && p.id !== myId && <button type=\"button\" className=\"sf-admin-toggle\" title={`Remover ${p.name} da partida`} onClick={() => { if (confirm(`Remover ${p.name} desta partida?`)) onRemoveParticipant(game.id, p.id); }}>Remover</button>}\n              </div>")

# Main handlers: enforce group membership and separate guest RPC.
marker="  const toggleMyRSVP = async (gameId) => {\n"
handlers="""  const addParticipant = async (gameId, userId) => {\n    const game = games.find((g) => g.id === gameId);\n    if (!game?.groupId) { alert('A partida precisa estar vinculada a um grupo.'); return; }\n    const member = groupMembers.some((m) => String(m.group_id) === String(game.groupId) && String(m.user_id) === String(userId));\n    if (!member) { alert('Só é possível adicionar jogadores que pertencem ao grupo da partida. Use Adicionar convidado para pessoas externas.'); return; }\n    const { error } = await supabase.from('game_confirmations').insert({ game_id: gameId, user_id: userId });\n    if (error) { alert('Não foi possível adicionar o jogador: ' + error.message); return; }\n    await loadAll();\n  };\n\n  const removeParticipant = async (gameId, userId) => {\n    const { error } = await supabase.from('game_confirmations').delete().eq('game_id', gameId).eq('user_id', userId);\n    if (error) { alert('Não foi possível remover o jogador: ' + error.message); return; }\n    await loadAll();\n  };\n\n  const addGuest = async (gameId, name, email) => {\n    const { error } = await supabase.rpc('add_game_guest', { p_game_id: gameId, p_name: name.trim(), p_email: email.trim() || null, p_nationality_code: 'BR' });\n    if (error) { alert('Não foi possível adicionar o convidado: ' + error.message); return; }\n    await loadAll();\n  };\n\n  const saveOwnStats = async (gameId, goals, assists) => {\n    const { error } = await supabase.from('goals').upsert({ game_id: gameId, user_id: myId, goals: Math.max(0, Number(goals) || 0), assists: Math.max(0, Number(assists) || 0) });\n    if (error) { alert('Não foi possível salvar seus gols/assistências: ' + error.message); return; }\n    await loadAll();\n  };\n\n"""+marker
once(marker,handlers)

# Wire GameDetail props.
once("            roster={profiles}\n            myId={myId}", "            roster={profiles}\n            groupMemberIds={new Set(groupMembers.filter((m) => String(m.group_id) === String(selectedGame?.groupId)).map((m) => String(m.user_id)))}\n            myId={myId}")
once("            onToggleMyRSVP={toggleMyRSVP}\n            onSetCost", "            onToggleMyRSVP={toggleMyRSVP}\n            onAddParticipant={addParticipant}\n            onRemoveParticipant={removeParticipant}\n            onAddGuest={addGuest}\n            onSaveOwnStats={saveOwnStats}\n            onSetCost")

# Own goals/assists: player edits only their own row; admin retains correction path.
once("  const [assists, setAssists] = useState(game.result?.scorers ? (game.assists || {}) : {});", "  const [assists, setAssists] = useState(game.result?.scorers ? (game.assists || {}) : {});\n  const myStatsGoals = scorers[myId] || 0;\n  const myStatsAssists = assists[myId] || 0;")
manager_anchor="""      {hasTeams && canManage && (\n        <section className=\"sf-card\">\n"""
self_card="""      {hasTeams && allPlayers.some((p) => String(p.id) === String(myId)) && (\n        <section className=\"sf-card\">\n          <div className=\"sf-card-title\"><Trophy size={16} /> Meus gols e assistências</div>\n          <div className=\"sf-muted-sm\">Informe somente os seus. O administrador pode corrigir depois.</div>\n          <div className=\"sf-scorer-controls-group\" style={{ marginTop: 10 }}>\n            <div className=\"sf-scorer-controls\"><span>⚽ Gols</span><button className=\"sf-mini-btn\" onClick={() => bumpGoal(myId, -1)}>-</button><span className=\"sf-mono-value\">{myStatsGoals}</span><button className=\"sf-mini-btn\" onClick={() => bumpGoal(myId, 1)}>+</button></div>\n            <div className=\"sf-scorer-controls\"><span>🎯 Assist.</span><button className=\"sf-mini-btn\" onClick={() => bumpAssist(myId, -1)}>-</button><span className=\"sf-mono-value\">{myStatsAssists}</span><button className=\"sf-mini-btn\" onClick={() => bumpAssist(myId, 1)}>+</button></div>\n          </div>\n          <button className=\"sf-btn-primary\" onClick={() => onSaveOwnStats(game.id, myStatsGoals, myStatsAssists)}><Check size={16} /> Salvar meus números</button>\n        </section>\n      )}\n\n"""+manager_anchor
once(manager_anchor,self_card)

# WhatsApp emoji source hardening.
for old,new in [
("`⚽ *Futebol Society* — ${formatDatePtBr(game.date)}\\n`","`\\u26BD *Futebol Society* — ${formatDatePtBr(game.date)}\\n`"),
("`📍 ${game.local}\\n`","`\\u{1F4CD} ${game.local}\\n`"),
("`\\n✅ Confirmados","`\\n\\u2705 Confirmados"),
("`\\n\\n⏳ Lista de espera","`\\n\\n\\u23F3 Lista de espera"),
("`\\n\\n🔴 Time A:","`\\n\\n\\uD83D\\uDD34 Time A:"),
("`\\n🔵 Time B:","`\\n\\uD83D\\uDD35 Time B:"),
("`\\n\\n💰 Rateio:","`\\n\\n\\uD83D\\uDCB0 Rateio:"),
("`\\n\\n📊 Placar:","`\\n\\n\\uD83D\\uDCCA Placar:"),
("`\\n🏆 MVP:","`\\n\\uD83C\\uDFC6 MVP:"),
("`\\n🎯 Artilheiro:","`\\n\\uD83C\\uDFAF Artilheiro:"),
("`\\n🤝 Passador:","`\\n\\uD83E\\uDD1D Passador:"),
("`\\n🧤 Muro:","`\\n\\uD83E\\uDDE4 Muro:"),
("`\\n\\nBora! 🙌`","`\\n\\nBora! \\u{1F64C}`"),
("`⚽ *${group.name}*\\n\\nEntra no grupo pra ver e confirmar presença nos jogos:","`\\u26BD *${group.name}*\\n\\nEntra no grupo pra ver e confirmar presença nos jogos:"),
("`Fala ${p.name}! ⚽ Só lembrando:","`Fala ${p.name}! \\u26BD Só lembrando:"),
(". Valeu! 🙏`;",". Valeu! \\u{1F64F}`;"),
]: once(old,new)

p.write_text(s)
print('final current audit patch applied')
