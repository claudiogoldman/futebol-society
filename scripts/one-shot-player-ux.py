from pathlib import Path

path = Path('app/society-page.js')
text = path.read_text()

def replace(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f'Missing target: {label}')
    text = text.replace(old, new, 1)

replace(
    "function MyProfileCard({ me, onUpdate }) {\n",
    '''function AdminProfileEditor({ player, onClose, onSave }) {\n  const [weight, setWeight] = useState(player.weight_kg ?? '');\n  const [age, setAge] = useState(player.age ?? '');\n  const [preferredFoot, setPreferredFoot] = useState(player.preferred_foot || '');\n  const [positions, setPositions] = useState(Array.isArray(player.positions) ? player.positions : []);\n  const [saving, setSaving] = useState(false);\n\n  const togglePosition = (pos) => {\n    setPositions((current) => current.includes(pos) ? current.filter((p) => p !== pos) : [...current, pos]);\n  };\n\n  const save = async () => {\n    setSaving(true);\n    try {\n      await onSave({\n        weight_kg: weight === '' ? null : Number(weight),\n        age: age === '' ? null : Number.parseInt(age, 10),\n        preferred_foot: preferredFoot || null,\n        positions,\n      });\n    } finally {\n      setSaving(false);\n    }\n  };\n\n  return (\n    <div className=\"sf-modal-backdrop\" onClick={onClose}>\n      <div className=\"sf-modal\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"sf-admin-profile-title\" onClick={(e) => e.stopPropagation()}>\n        <div className=\"sf-modal-title\" id=\"sf-admin-profile-title\">Completar perfil</div>\n        <div className=\"sf-muted-sm\">Administrador do app preenchendo informações conhecidas para melhorar o sorteio.</div>\n        <div className=\"sf-h3\" style={{ marginTop: 6 }}>{player.name}</div>\n        <label className=\"sf-field-label\">Peso (kg)</label>\n        <input type=\"number\" min=\"30\" max=\"200\" className=\"sf-input\" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder=\"ex: 78\" />\n        <label className=\"sf-field-label\">Idade</label>\n        <input type=\"number\" min=\"10\" max=\"100\" className=\"sf-input\" value={age} onChange={(e) => setAge(e.target.value)} placeholder=\"ex: 34\" />\n        <label className=\"sf-field-label\">Pé preferencial</label>\n        <select className=\"sf-input\" value={preferredFoot} onChange={(e) => setPreferredFoot(e.target.value)}>\n          <option value=\"\">Não informado</option>\n          <option value=\"direito\">Direito</option>\n          <option value=\"esquerdo\">Esquerdo</option>\n          <option value=\"ambidestro\">Ambidestro</option>\n        </select>\n        <label className=\"sf-field-label\">Posições que joga</label>\n        <div className=\"sf-position-pills\">\n          {POSITION_ORDER.map((pos) => (\n            <button type=\"button\" key={pos} className={`sf-pos-pill ${positions.includes(pos) ? 'sf-pos-pill-on' : ''} ${pos === 'goleiro' ? 'sf-pos-pill-gk' : ''}`} onClick={() => togglePosition(pos)}>\n              {pos === 'goleiro' && <Hand size={12} />} {POSITION_LABELS[pos]}\n            </button>\n          ))}\n        </div>\n        <div className=\"sf-modal-actions\">\n          <button type=\"button\" className=\"sf-btn-ghost\" onClick={onClose} disabled={saving}>Cancelar</button>\n          <button type=\"button\" className=\"sf-btn-primary\" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar informações'}</button>\n        </div>\n      </div>\n    </div>\n  );\n}\n\nfunction MyProfileCard({ me, onUpdate }) {\n''',
    'admin profile editor component'
)

replace(
    "  const [viewingCardPlayer, setViewingCardPlayer] = useState(null);\n",
    "  const [viewingCardPlayer, setViewingCardPlayer] = useState(null);\n  const [editingProfilePlayer, setEditingProfilePlayer] = useState(null);\n",
    'admin profile state'
)

replace(
    "  const me = profiles.find((p) => p.id === myId);\n",
    "  const me = profiles.find((p) => p.id === myId);\n\n  const updateProfileForAdmin = async (userId, fields) => {\n    if (!me?.is_admin || !userId) return false;\n    const allowed = ['preferred_foot', 'weight_kg', 'age', 'positions', 'nationality_code', 'rating'];\n    const payload = Object.fromEntries(Object.entries(fields).filter(([key]) => allowed.includes(key)));\n    const { error } = await supabase.from('profiles').update(payload).eq('id', userId);\n    if (error) { alert('Não foi possível completar o perfil: ' + error.message); return false; }\n    await loadAll();\n    return true;\n  };\n",
    'admin profile mutation'
)

replace(
    "      <div className=\"sf-detail-topbar\">\n        <button className=\"sf-icon-btn\" onClick={onBack}><ChevronLeft size={20} /></button>\n        <div>\n          <div className=\"sf-eyebrow\">{formatDatePtBr(game.date)}</div>\n          <div className=\"sf-h2\">{game.local || 'Local a definir'}</div>\n        </div>",
    "      <div className=\"sf-detail-topbar\">\n        <button className=\"sf-icon-btn\" onClick={onBack}><ChevronLeft size={20} /></button>\n        <div>\n          <div className=\"sf-eyebrow\">{formatDatePtBr(game.date)}</div>\n          <div className=\"sf-h2\">{game.local || 'Local a definir'}</div>\n          <div className=\"sf-muted-sm\">Criada por {roster.find((p) => String(p.id) === String(game.createdBy))?.name || '—'}</div>\n        </div>",
    'game creator display'
)

replace(
    "          {roster.filter((p) => game.confirmed.includes(p.id)).map((p) => {\n",
    "          {activePlayers.map((p) => {\n",
    'game participant order'
)

replace(
    "                <span className=\"sf-rsvp-name\">\n                  <PositionTags player={p} />\n                  {p.name}{p.id === myId ? ' (você)' : ''}\n                </span>",
    "                <span className=\"sf-rsvp-name\">\n                  <PositionTags player={p} />\n                  <button type=\"button\" className=\"sf-player-link\" onClick={() => window.dispatchEvent(new CustomEvent('sf-open-player', { detail: p }))}>{p.name}</button>{p.id === myId ? ' (você)' : ''}\n                </span>",
    'game participant profile link'
)

replace(
    "{m.id === group.createdBy ? ' · dono' : ''}",
    "{m.id === group.createdBy ? ' · criador do grupo' : ''}",
    'group creator label'
)

replace(
    "              <span className=\"sf-rsvp-name\">{m.name}{m.id === myId ? ' (você)' : ''}{m.id === group.createdBy ? ' · criador do grupo' : ''}{m.role === 'admin' && m.id !== group.createdBy ? ' · admin' : ''}</span>",
    "              <span className=\"sf-rsvp-name\"><button type=\"button\" className=\"sf-player-link\" onClick={() => window.dispatchEvent(new CustomEvent('sf-open-player', { detail: m }))}>{m.name}</button>{m.id === myId ? ' (você)' : ''}{m.id === group.createdBy ? ' · criador do grupo' : ''}{m.role === 'admin' && m.id !== group.createdBy ? ' · admin' : ''}</span>",
    'group member profile link'
)

replace(
    "                      {playerMeta(p) && <div className=\"sf-muted-sm\" style={{ marginTop: 3 }}>{playerMeta(p)}</div>}\n                      {canManageSelectedGroupAdmins && p.id !== selectedElencoGroup.createdBy && (",
    "                      {playerMeta(p) && <div className=\"sf-muted-sm\" style={{ marginTop: 3 }}>{playerMeta(p)}</div>}\n                      {me?.is_admin && (!p.age || !p.weight_kg || !Array.isArray(p.positions) || p.positions.length === 0) && (\n                        <button type=\"button\" className=\"sf-admin-toggle\" onClick={() => setEditingProfilePlayer(p)}>Completar perfil</button>\n                      )}\n                      {canManageSelectedGroupAdmins && p.id !== selectedElencoGroup.createdBy && (",
    'roster admin completion action'
)

replace(
    "      {viewingCardPlayer && (\n        <div className=\"sf-modal-backdrop\" onClick={() => setViewingCardPlayer(null)}>\n          <div className=\"sf-modal sf-card-modal\" onClick={(e) => e.stopPropagation()}>\n            <PlayerCard player={viewingCardPlayer} />\n            <div className=\"sf-h3\" style={{ marginTop: 14 }}>{viewingCardPlayer.name}</div>\n            {playerMeta(viewingCardPlayer) && <div className=\"sf-muted-sm\" style={{ marginTop: 3 }}>{playerMeta(viewingCardPlayer)}</div>}\n            <StarRating value={viewingCardPlayer.rating} readOnly size={18} onChange={() => {}} />\n            <button className=\"sf-btn-ghost\" style={{ marginTop: 14 }} onClick={() => setViewingCardPlayer(null)}>Fechar</button>\n          </div>\n        </div>\n      )}",
    "      {viewingCardPlayer && (\n        <div className=\"sf-modal-backdrop\" onClick={() => setViewingCardPlayer(null)}>\n          <div className=\"sf-modal sf-card-modal\" onClick={(e) => e.stopPropagation()}>\n            <PlayerCard player={viewingCardPlayer} />\n            <div className=\"sf-h3\" style={{ marginTop: 14 }}>{viewingCardPlayer.name}</div>\n            {playerMeta(viewingCardPlayer) && <div className=\"sf-muted-sm\" style={{ marginTop: 3 }}>{playerMeta(viewingCardPlayer)}</div>}\n            <StarRating value={viewingCardPlayer.rating} readOnly size={18} onChange={() => {}} />\n            {me?.is_admin && (!viewingCardPlayer.age || !viewingCardPlayer.weight_kg || !Array.isArray(viewingCardPlayer.positions) || viewingCardPlayer.positions.length === 0) && (\n              <button type=\"button\" className=\"sf-btn-primary\" onClick={() => { setEditingProfilePlayer(viewingCardPlayer); setViewingCardPlayer(null); }}>Completar perfil</button>\n            )}\n            <button className=\"sf-btn-ghost\" style={{ marginTop: 14 }} onClick={() => setViewingCardPlayer(null)}>Fechar</button>\n          </div>\n        </div>\n      )}\n\n      {editingProfilePlayer && (\n        <AdminProfileEditor\n          player={editingProfilePlayer}\n          onClose={() => setEditingProfilePlayer(null)}\n          onSave={async (fields) => {\n            const ok = await updateProfileForAdmin(editingProfilePlayer.id, fields);\n            if (ok) setEditingProfilePlayer(null);\n            return ok;\n          }}\n        />\n      )}",
    'admin profile modal'
)

replace(
    "  useEffect(() => { loadAll(); }, [loadAll]);\n",
    "  useEffect(() => { loadAll(); }, [loadAll]);\n\n  useEffect(() => {\n    const handler = (event) => { if (event.detail) setViewingCardPlayer(event.detail); };\n    window.addEventListener('sf-open-player', handler);\n    return () => window.removeEventListener('sf-open-player', handler);\n  }, []);\n",
    'profile event listener'
)

replace(
    "  .sf-rsvp-list { display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow-y: auto; }",
    "  .sf-rsvp-list { display: flex; flex-direction: column; gap: 6px; }",
    'participant list UX'
)

replace(
    "  .sf-rsvp-name { flex: 1; font-size: 13px; }",
    "  .sf-rsvp-name { flex: 1; font-size: 13px; }\n  .sf-player-link { background: none; border: 0; padding: 0; margin: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; text-decoration: none; }\n  .sf-player-link:hover, .sf-player-link:focus-visible { color: var(--floodlight); text-decoration: underline; outline: none; }",
    'player link style'
)

path.write_text(text)
print('Player UX patch applied')
