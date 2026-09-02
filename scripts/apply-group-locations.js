const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'app', 'page.js');
let s = fs.readFileSync(file, 'utf8');
function r(a, b, n) {
  if (!s.includes(a)) throw new Error('group locations patch anchor not found: ' + n);
  s = s.replace(a, b);
}

r("function GroupDetail({ group, games, members, myId, onBack, onSetDefaults, onShare, onNewGame, onOpenGame, onLeave, onDelete, onRemoveMember }) {", "function GroupDetail({ group, games, members, locations, myId, onBack, onSetDefaults, onShare, onNewGame, onOpenGame, onLeave, onDelete, onRemoveMember, onCreateLocation, onDeleteLocation }) {", 'GroupDetail signature');
r("  const [costDraft, setCostDraft] = useState(group.defaultCost || '');", "  const [costDraft, setCostDraft] = useState(group.defaultCost || '');\n  const [locationDraft, setLocationDraft] = useState({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', isDefault: false });", 'group location state');
r("      <section className=\"sf-card\">\n        <div className=\"sf-card-title\"><Users size={16} /> Membros ({members.length})</div>", `      <section className="sf-card">
        <div className="sf-card-title"><Target size={16} /> Locais cadastrados ({locations.length})</div>
        {locations.length === 0 && <div className="sf-muted-sm">Nenhum local cadastrado. Cadastre uma vez aqui para reutilizar nas partidas.</div>}
        {locations.map((loc) => (
          <div key={loc.id} className="sf-rsvp-row sf-rsvp-on" style={{ display: 'block', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="sf-rsvp-name">{loc.name}</span>
              {loc.isDefault && <span className="sf-admin-tag">PADRÃO</span>}
              {isOwner && <button type="button" className="sf-admin-toggle" style={{ marginLeft: 'auto' }} onClick={() => onDeleteLocation(loc.id)}>Excluir</button>}
            </div>
            <div className="sf-muted-sm" style={{ marginTop: 4 }}>{[loc.address, loc.city && loc.state ? loc.city + '/' + loc.state : (loc.city || loc.state)].filter(Boolean).join(' · ') || 'Endereço não informado'}</div>
          </div>
        ))}
        {isOwner && <div style={{ marginTop: 10 }}>
          <label className="sf-field-label">Novo local</label>
          <input className="sf-input" placeholder="Nome da quadra / arena" value={locationDraft.name} onChange={(e) => setLocationDraft({ ...locationDraft, name: e.target.value })} />
          <input className="sf-input" style={{ marginTop: 6 }} placeholder="Rua, número, complemento" value={locationDraft.address} onChange={(e) => setLocationDraft({ ...locationDraft, address: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px', gap: 6, marginTop: 6 }}>
            <input className="sf-input" placeholder="Cidade" value={locationDraft.city} onChange={(e) => setLocationDraft({ ...locationDraft, city: e.target.value })} />
            <input className="sf-input" maxLength="2" placeholder="UF" value={locationDraft.state} onChange={(e) => setLocationDraft({ ...locationDraft, state: e.target.value.toUpperCase() })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
            <input type="number" step="any" className="sf-input" placeholder="Latitude" value={locationDraft.latitude} onChange={(e) => setLocationDraft({ ...locationDraft, latitude: e.target.value })} />
            <input type="number" step="any" className="sf-input" placeholder="Longitude" value={locationDraft.longitude} onChange={(e) => setLocationDraft({ ...locationDraft, longitude: e.target.value })} />
          </div>
          <label className="sf-check-row" style={{ marginTop: 8 }}><input type="checkbox" checked={locationDraft.isDefault} onChange={(e) => setLocationDraft({ ...locationDraft, isDefault: e.target.checked })} /> Usar como local padrão</label>
          <button className="sf-btn-primary" style={{ marginTop: 8 }} onClick={async () => { if (!locationDraft.name.trim()) return alert('Informe o nome do local.'); await onCreateLocation(group.id, locationDraft); setLocationDraft({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', isDefault: false }); }}>Cadastrar local</button>
        </div>}
      </section>

      <section className="sf-card">
        <div className="sf-card-title"><Users size={16} /> Membros ({members.length})</div>`, 'group locations UI');
r("  const [groupMembers, setGroupMembers] = useState([]);", "  const [groupMembers, setGroupMembers] = useState([]);\n  const [groupLocations, setGroupLocations] = useState([]);", 'group locations state');
r("  const [newGameGroupId, setNewGameGroupId] = useState(null);", "  const [newGameGroupId, setNewGameGroupId] = useState(null);\n  const [newGameLocationId, setNewGameLocationId] = useState('');\n  const [inlineLocationOpen, setInlineLocationOpen] = useState(false);\n  const [inlineLocationDraft, setInlineLocationDraft] = useState({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', isDefault: false });\n  const [rankingGroupFilter, setRankingGroupFilter] = useState('');", 'new game location state');
r("const [profilesRes, gamesRes, confRes, teamsRes, paysRes, goalsRes, ratingsRes, groupsRes, groupMembersRes]", "const [profilesRes, gamesRes, confRes, teamsRes, paysRes, goalsRes, ratingsRes, groupsRes, groupMembersRes, groupLocationsRes]", 'load promise destructure');
r("supabase.from('group_members').select('*'),", "supabase.from('group_members').select('*'),\n      supabase.from('group_locations').select('*').order('name'),", 'load locations query');
r("    setGroupMembers(groupMembersRes.data || []);\n    setLoading(false);", "    setGroupMembers(groupMembersRes.data || []);\n    setGroupLocations((groupLocationsRes.data || []).map((l) => ({ id: l.id, groupId: l.group_id, name: l.name, address: l.address || '', city: l.city || '', state: l.state || '', latitude: l.latitude != null ? Number(l.latitude) : null, longitude: l.longitude != null ? Number(l.longitude) : null, isDefault: l.is_default === true })));\n    setLoading(false);", 'map locations');
r("  const createGame = async () => {", `  const createGroupLocation = async (groupId, draft) => {
    const { data, error } = await supabase.from('group_locations').insert({ group_id: groupId, name: draft.name.trim(), address: draft.address.trim() || null, city: draft.city.trim() || null, state: draft.state.trim().toUpperCase() || null, latitude: draft.latitude === '' ? null : Number(draft.latitude), longitude: draft.longitude === '' ? null : Number(draft.longitude), is_default: !!draft.isDefault, created_by: myId }).select().single();
    if (error) { alert('Não foi possível cadastrar o local: ' + error.message); return null; }
    await loadAll();
    return data;
  };

  const deleteGroupLocation = async (locationId) => {
    if (!confirm('Excluir este local cadastrado?')) return;
    const { error } = await supabase.from('group_locations').delete().eq('id', locationId);
    if (error) { alert('Não foi possível excluir o local: ' + error.message); return; }
    await loadAll();
  };

  const applyGameLocation = (location) => {
    if (!location) return;
    setNewGameLocationId(location.id);
    setNewLocal(location.name || '');
    setNewLocationAddress(location.address || '');
    setNewLocationCity(location.city || '');
    setNewLocationState(location.state || '');
    setNewLocationLatitude(location.latitude != null ? String(location.latitude) : '');
    setNewLocationLongitude(location.longitude != null ? String(location.longitude) : '');
  };

  const createInlineGameLocation = async () => {
    if (!newGameGroupId) return alert('Selecione um grupo antes de cadastrar o local.');
    const data = await createGroupLocation(newGameGroupId, inlineLocationDraft);
    if (!data) return;
    applyGameLocation({ id: data.id, groupId: data.group_id, name: data.name, address: data.address || '', city: data.city || '', state: data.state || '', latitude: data.latitude != null ? Number(data.latitude) : null, longitude: data.longitude != null ? Number(data.longitude) : null, isDefault: data.is_default === true });
    setInlineLocationDraft({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', isDefault: false });
    setInlineLocationOpen(false);
  };

  const createGame = async () => {`, 'location handlers');
r("    setNewDate(''); setNewLocal(''); setNewLocationAddress(''); setNewLocationCity(''); setNewLocationState(''); setNewLocationLatitude(''); setNewLocationLongitude(''); setNewMaxPlayers(''); setNewGameGroupId(null);", "    setNewDate(''); setNewLocal(''); setNewLocationAddress(''); setNewLocationCity(''); setNewLocationState(''); setNewLocationLatitude(''); setNewLocationLongitude(''); setNewMaxPlayers(''); setNewGameGroupId(null); setNewGameLocationId(''); setInlineLocationOpen(false); setInlineLocationDraft({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', isDefault: false });", 'create reset locations');
r("    setNewGamePixCity(group.defaultPixCity || '');\n    setShowNewGame(true);", "    setNewGamePixCity(group.defaultPixCity || '');\n    const defaultLocation = groupLocations.find((l) => l.groupId === group.id && l.isDefault) || groupLocations.find((l) => l.groupId === group.id);\n    if (defaultLocation) applyGameLocation(defaultLocation); else { setNewGameLocationId(''); setNewLocal(group.defaultLocal || ''); }\n    setShowNewGame(true);", 'open group location default');
r("            setNewDate(nextDateForWeekday(g.defaultDayOfWeek));\n            setNewLocal(g.defaultLocal || '');", "            setNewDate(nextDateForWeekday(g.defaultDayOfWeek));\n            const defaultLocation = groupLocations.find((l) => l.groupId === g.id && l.isDefault) || groupLocations.find((l) => l.groupId === g.id);\n            if (defaultLocation) applyGameLocation(defaultLocation); else { setNewGameLocationId(''); setNewLocal(g.defaultLocal || ''); setNewLocationAddress(''); setNewLocationCity(''); setNewLocationState(''); setNewLocationLatitude(''); setNewLocationLongitude(''); }", 'select group location');
r("            setNewDate('');\n            setNewLocal('');", "            setNewDate('');\n            setNewGameLocationId('');\n            setNewLocal('');", 'clear group location');
r("  const ranking = useMemo(() => computeRanking(profiles, games), [profiles, games]);", "  useEffect(() => { if (!rankingGroupFilter && groups.length) setRankingGroupFilter(groups[0].id); }, [groups, rankingGroupFilter]);\n  const ranking = useMemo(() => { if (!rankingGroupFilter) return []; const memberIds = new Set(groupMembers.filter((m) => m.group_id === rankingGroupFilter).map((m) => m.user_id)); const groupGames = games.filter((g) => g.groupId === rankingGroupFilter); return computeRanking(profiles.filter((p) => memberIds.has(p.id)), groupGames); }, [profiles, games, groupMembers, rankingGroupFilter]);", 'group ranking');
r("            <label className=\"sf-field-label\">Nome do local</label>\n            <input className=\"sf-input\" placeholder=\"Quadra / arena\" value={newLocal} onChange={(e) => setNewLocal(e.target.value)} />", `            {newGameGroupId && <>
              <label className="sf-field-label">Local cadastrado</label>
              <select className="sf-input" value={newGameLocationId} onChange={(e) => { const loc = groupLocations.find((l) => l.id === e.target.value); if (loc) applyGameLocation(loc); else setNewGameLocationId(''); }}>
                <option value="">Selecionar local...</option>
                {groupLocations.filter((l) => l.groupId === newGameGroupId).map((loc) => <option key={loc.id} value={loc.id}>{loc.name}{loc.isDefault ? ' · padrão' : ''}</option>)}
              </select>
              <button type="button" className="sf-btn-ghost" style={{ marginTop: 6 }} onClick={() => setInlineLocationOpen((v) => !v)}>{inlineLocationOpen ? 'Fechar cadastro de local' : 'Cadastrar novo local sem sair da partida'}</button>
              {inlineLocationOpen && <div className="sf-card" style={{ marginTop: 8 }}>
                <label className="sf-field-label">Nome do local</label><input className="sf-input" placeholder="Quadra / arena" value={inlineLocationDraft.name} onChange={(e) => setInlineLocationDraft({ ...inlineLocationDraft, name: e.target.value })} />
                <label className="sf-field-label">Endereço</label><input className="sf-input" value={inlineLocationDraft.address} onChange={(e) => setInlineLocationDraft({ ...inlineLocationDraft, address: e.target.value })} placeholder="Rua, número, complemento" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px', gap: 6 }}><input className="sf-input" placeholder="Cidade" value={inlineLocationDraft.city} onChange={(e) => setInlineLocationDraft({ ...inlineLocationDraft, city: e.target.value })} /><input className="sf-input" maxLength="2" placeholder="UF" value={inlineLocationDraft.state} onChange={(e) => setInlineLocationDraft({ ...inlineLocationDraft, state: e.target.value.toUpperCase() })} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}><input type="number" step="any" className="sf-input" placeholder="Latitude" value={inlineLocationDraft.latitude} onChange={(e) => setInlineLocationDraft({ ...inlineLocationDraft, latitude: e.target.value })} /><input type="number" step="any" className="sf-input" placeholder="Longitude" value={inlineLocationDraft.longitude} onChange={(e) => setInlineLocationDraft({ ...inlineLocationDraft, longitude: e.target.value })} /></div>
                <label className="sf-check-row" style={{ marginTop: 8 }}><input type="checkbox" checked={inlineLocationDraft.isDefault} onChange={(e) => setInlineLocationDraft({ ...inlineLocationDraft, isDefault: e.target.checked })} /> Tornar padrão do grupo</label>
                <button type="button" className="sf-btn-primary" style={{ marginTop: 8 }} onClick={createInlineGameLocation}>Cadastrar e usar nesta partida</button>
              </div>}
            </>}
            {!newGameGroupId && <>
              <label className="sf-field-label">Nome do local</label>
              <input className="sf-input" placeholder="Quadra / arena" value={newLocal} onChange={(e) => setNewLocal(e.target.value)} />
            </>}`, 'new game location UI');
r("            {subTab === 'ranking' && (\n              <div className=\"sf-ranking-table\">", "            {subTab === 'ranking' && (\n              <>\n              <div className=\"sf-roster-filter\">\n                <label className=\"sf-field-label\">Grupo do ranking</label>\n                <select className=\"sf-input\" value={rankingGroupFilter} onChange={(e) => setRankingGroupFilter(e.target.value)}>\n                  <option value=\"\">Selecione um grupo</option>\n                  {elencoGroupOptions.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}\n                </select>\n              </div>\n              <div className=\"sf-ranking-table\">") ;

r("            onRemoveMember={removeGroupMember}\n          />", "            onRemoveMember={removeGroupMember}\n            locations={groupLocations.filter((l) => l.groupId === selectedGroupId)}\n            onCreateLocation={createGroupLocation}\n            onDeleteLocation={deleteGroupLocation}\n          />", 'GroupDetail props');

fs.writeFileSync(file, s);
console.log('Group locations and group ranking patch applied.');
