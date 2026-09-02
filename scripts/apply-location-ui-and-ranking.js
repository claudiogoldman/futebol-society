const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'app', 'page.js');
let s = fs.readFileSync(file, 'utf8');
function r(a,b,n){if(!s.includes(a)) throw new Error('location UI/ranking anchor not found: '+n); s=s.replace(a,b);}

r("function GroupDetail({ group, games, members, myId, onBack, onSetDefaults, onShare, onNewGame, onOpenGame, onLeave, onDelete, onRemoveMember }) {", "function GroupDetail({ group, games, members, locations, myId, onBack, onSetDefaults, onShare, onNewGame, onOpenGame, onLeave, onDelete, onRemoveMember, onCreateLocation, onDeleteLocation }) {", 'GroupDetail signature');
r("  const [costDraft, setCostDraft] = useState(group.defaultCost || '');", "  const [costDraft, setCostDraft] = useState(group.defaultCost || '');\n  const [locationDraft, setLocationDraft] = useState({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', isDefault: false });", 'group location state');
r("      <section className=\"sf-card\">\n        <div className=\"sf-card-title\"><Users size={16} /> Membros ({members.length})</div>", `      <section className="sf-card">
        <div className="sf-card-title"><Target size={16} /> Locais cadastrados ({locations.length})</div>
        {locations.length === 0 && <div className="sf-muted-sm">Nenhum local cadastrado. Cadastre aqui uma vez e reutilize em todas as partidas do grupo.</div>}
        {locations.map((loc) => (
          <div key={loc.id} className="sf-rsvp-row sf-rsvp-on" style={{ display: 'block', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="sf-rsvp-name">{loc.name}</span>
              {loc.is_default && <span className="sf-admin-tag">PADRÃO</span>}
              {canManage && <button type="button" className="sf-admin-toggle" style={{ marginLeft: 'auto' }} onClick={() => onDeleteLocation(loc.id)}>Excluir</button>}
            </div>
            <div className="sf-muted-sm" style={{ marginTop: 4 }}>{[loc.address, loc.city && loc.state ? loc.city + '/' + loc.state : (loc.city || loc.state)].filter(Boolean).join(' · ') || 'Endereço não informado'}</div>
          </div>
        ))}
        {canManage && <div style={{ marginTop: 10 }}>
          <label className="sf-field-label">Cadastrar novo local</label>
          <input className="sf-input" placeholder="Nome da quadra / arena" value={locationDraft.name} onChange={(e) => setLocationDraft({ ...locationDraft, name: e.target.value })} />
          <input className="sf-input" style={{ marginTop: 6 }} placeholder="Rua, número, complemento" value={locationDraft.address} onChange={(e) => setLocationDraft({ ...locationDraft, address: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px', gap: 6, marginTop: 6 }}><input className="sf-input" placeholder="Cidade" value={locationDraft.city} onChange={(e) => setLocationDraft({ ...locationDraft, city: e.target.value })} /><input className="sf-input" maxLength="2" placeholder="UF" value={locationDraft.state} onChange={(e) => setLocationDraft({ ...locationDraft, state: e.target.value.toUpperCase() })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}><input type="number" step="any" className="sf-input" placeholder="Latitude" value={locationDraft.latitude} onChange={(e) => setLocationDraft({ ...locationDraft, latitude: e.target.value })} /><input type="number" step="any" className="sf-input" placeholder="Longitude" value={locationDraft.longitude} onChange={(e) => setLocationDraft({ ...locationDraft, longitude: e.target.value })} /></div>
          <label className="sf-check-row" style={{ marginTop: 8 }}><input type="checkbox" checked={locationDraft.isDefault} onChange={(e) => setLocationDraft({ ...locationDraft, isDefault: e.target.checked })} /> Usar como local padrão do grupo</label>
          <button className="sf-btn-primary" style={{ marginTop: 8 }} onClick={async () => { if (!locationDraft.name.trim()) return alert('Informe o nome do local.'); const ok = await onCreateLocation(group.id, locationDraft); if (ok) setLocationDraft({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', isDefault: false }); }}>Cadastrar local</button>
        </div>}
      </section>

      <section className="sf-card">
        <div className="sf-card-title"><Users size={16} /> Membros ({members.length})</div>`, 'group locations UI');
r("  const [newGameLocationId, setNewGameLocationId] = useState('');", "  const [newGameLocationId, setNewGameLocationId] = useState('');\n  const [inlineLocationOpen, setInlineLocationOpen] = useState(false);\n  const [inlineLocationDraft, setInlineLocationDraft] = useState({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', isDefault: false });\n  const [rankingGroupFilter, setRankingGroupFilter] = useState('');", 'inline location state');
r("  const createGame = async () => {", `  const createInlineGameLocation = async () => {
    if (!newGameGroupId) { alert('Selecione um grupo antes de cadastrar o local.'); return; }
    if (!inlineLocationDraft.name.trim()) { alert('Informe o nome do local.'); return; }
    const { data, error } = await supabase.from('group_locations').insert({ group_id: newGameGroupId, name: inlineLocationDraft.name.trim(), address: inlineLocationDraft.address.trim() || null, city: inlineLocationDraft.city.trim() || null, state: inlineLocationDraft.state.trim().toUpperCase() || null, latitude: inlineLocationDraft.latitude === '' ? null : Number(inlineLocationDraft.latitude), longitude: inlineLocationDraft.longitude === '' ? null : Number(inlineLocationDraft.longitude), is_default: !!inlineLocationDraft.isDefault, created_by: myId }).select().single();
    if (error) { alert('Não foi possível cadastrar o local: ' + error.message); return; }
    setGroupLocations((prev) => [...prev, data]);
    setNewGameLocationId(data.id);
    setNewLocal(data.name || '');
    setNewLocationAddress(data.address || '');
    setNewLocationCity(data.city || '');
    setNewLocationState(data.state || '');
    setNewLocationLatitude(data.latitude != null ? String(data.latitude) : '');
    setNewLocationLongitude(data.longitude != null ? String(data.longitude) : '');
    setInlineLocationDraft({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', isDefault: false });
    setInlineLocationOpen(false);
  };

  const createGame = async () => {`, 'inline location handler');
r("    setNewDate(''); setNewLocal(''); setNewLocationAddress(''); setNewLocationCity(''); setNewLocationState(''); setNewLocationLatitude(''); setNewLocationLongitude(''); setNewMaxPlayers(''); setNewGameGroupId(null); setNewGameOrganizerId(''); setNewGameLocationId('');", "    setNewDate(''); setNewLocal(''); setNewLocationAddress(''); setNewLocationCity(''); setNewLocationState(''); setNewLocationLatitude(''); setNewLocationLongitude(''); setNewMaxPlayers(''); setNewGameGroupId(null); setNewGameOrganizerId(''); setNewGameLocationId(''); setInlineLocationOpen(false); setInlineLocationDraft({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', isDefault: false });", 'reset inline location');
r("                </select>\n              </>\n            )}\n            <label className=\"sf-field-label\">Data</label>", `                </select>
                <button type="button" className="sf-btn-ghost" style={{ marginTop: 6 }} onClick={() => setInlineLocationOpen((v) => !v)}>{inlineLocationOpen ? 'Fechar cadastro de local' : 'Cadastrar novo local sem sair da partida'}</button>
                {inlineLocationOpen && <div className="sf-card" style={{ marginTop: 8 }}>
                  <label className="sf-field-label">Nome do local</label><input className="sf-input" placeholder="Quadra / arena" value={inlineLocationDraft.name} onChange={(e) => setInlineLocationDraft({ ...inlineLocationDraft, name: e.target.value })} />
                  <label className="sf-field-label">Endereço</label><input className="sf-input" placeholder="Rua, número, complemento" value={inlineLocationDraft.address} onChange={(e) => setInlineLocationDraft({ ...inlineLocationDraft, address: e.target.value })} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px', gap: 6 }}><input className="sf-input" placeholder="Cidade" value={inlineLocationDraft.city} onChange={(e) => setInlineLocationDraft({ ...inlineLocationDraft, city: e.target.value })} /><input className="sf-input" maxLength="2" placeholder="UF" value={inlineLocationDraft.state} onChange={(e) => setInlineLocationDraft({ ...inlineLocationDraft, state: e.target.value.toUpperCase() })} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}><input type="number" step="any" className="sf-input" placeholder="Latitude" value={inlineLocationDraft.latitude} onChange={(e) => setInlineLocationDraft({ ...inlineLocationDraft, latitude: e.target.value })} /><input type="number" step="any" className="sf-input" placeholder="Longitude" value={inlineLocationDraft.longitude} onChange={(e) => setInlineLocationDraft({ ...inlineLocationDraft, longitude: e.target.value })} /></div>
                  <label className="sf-check-row" style={{ marginTop: 8 }}><input type="checkbox" checked={inlineLocationDraft.isDefault} onChange={(e) => setInlineLocationDraft({ ...inlineLocationDraft, isDefault: e.target.checked })} /> Tornar padrão do grupo</label>
                  <button type="button" className="sf-btn-primary" style={{ marginTop: 8 }} onClick={createInlineGameLocation}>Cadastrar e usar nesta partida</button>
                </div>}
              </>}
            )}
            <label className="sf-field-label">Data</label>`, 'inline location UI');
r("            onRemoveMember={removeGroupMember}\n          />", "            onRemoveMember={removeGroupMember}\n            locations={groupLocations.filter((l) => String(l.group_id) === String(selectedGroupId))}\n            onCreateLocation={createGroupLocation}\n            onDeleteLocation={deleteGroupLocation}\n          />", 'GroupDetail location props');
r("  const createGame = async () => {", `  const createGroupLocation = async (groupId, draft) => {
    const { data, error } = await supabase.from('group_locations').insert({ group_id: groupId, name: draft.name.trim(), address: draft.address.trim() || null, city: draft.city.trim() || null, state: draft.state.trim().toUpperCase() || null, latitude: draft.latitude === '' ? null : Number(draft.latitude), longitude: draft.longitude === '' ? null : Number(draft.longitude), is_default: !!draft.isDefault, created_by: myId }).select().single();
    if (error) { alert('Não foi possível cadastrar o local: ' + error.message); return false; }
    await loadAll();
    return true;
  };

  const deleteGroupLocation = async (locationId) => {
    if (!confirm('Excluir este local cadastrado?')) return;
    const { error } = await supabase.from('group_locations').delete().eq('id', locationId);
    if (error) { alert('Não foi possível excluir o local: ' + error.message); return; }
    await loadAll();
  };

  const createGame = async () => {`, 'group location handlers');
r("  const ranking = useMemo(() => computeRanking(profiles, games), [profiles, games]);", "  useEffect(() => { if (!rankingGroupFilter && groups.length) setRankingGroupFilter(groups[0].id); }, [groups, rankingGroupFilter]);\n  const ranking = useMemo(() => { if (!rankingGroupFilter) return []; const memberIds = new Set(groupMembers.filter((m) => String(m.group_id) === String(rankingGroupFilter)).map((m) => String(m.user_id))); const groupGames = games.filter((g) => String(g.groupId) === String(rankingGroupFilter)); return computeRanking(profiles.filter((p) => memberIds.has(String(p.id))), groupGames); }, [profiles, games, groupMembers, rankingGroupFilter]);", 'group ranking');
r("            {subTab === 'ranking' && (\n              <div className=\"sf-ranking-table\">", "            {subTab === 'ranking' && (\n              <>\n              <div className=\"sf-roster-filter\">\n                <label className=\"sf-field-label\">Grupo do ranking</label>\n                <select className=\"sf-input\" value={rankingGroupFilter} onChange={(e) => setRankingGroupFilter(e.target.value)}>\n                  <option value=\"\">Selecione um grupo</option>\n                  {elencoGroupOptions.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}\n                </select>\n              </div>\n              <div className=\"sf-ranking-table\">") ;
r("              </div>\n            )}\n          </div>\n        )}\n      </main>", "              </div>\n              </>\n            )}\n          </div>\n        )}\n      </main>", 'ranking fragment close');

fs.writeFileSync(file,s);
console.log('Location UI and group-scoped ranking applied.');
