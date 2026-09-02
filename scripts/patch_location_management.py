from pathlib import Path
import re
p = Path('app/society-page.js')
s = p.read_text()
changed = False

def replace_once(old, new):
    global s, changed
    if old in s:
        s = s.replace(old, new, 1)
        changed = True

replace_once("  const [locationDraft, setLocationDraft] = useState({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', isDefault: false });\n", "  const [locationDraft, setLocationDraft] = useState({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', isDefault: false });\n  const [editingLocationId, setEditingLocationId] = useState(null);\n")
replace_once("    setCostDraft(group.defaultCost != null ? String(group.defaultCost) : '');\n", "    setCostDraft(group.defaultCost != null ? String(group.defaultCost) : '');\n    setEditingLocationId(null);\n")
replace_once('''        {canManage && <button type="button" className="sf-admin-toggle" style={{ marginLeft: 'auto' }} onClick={() => onDeleteLocation(loc.id)}>Excluir</button>}''','''        {canManage && <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}><button type="button" className="sf-admin-toggle" onClick={() => { setEditingLocationId(loc.id); setLocationDraft({ name: loc.name || '', address: loc.address || '', city: loc.city || '', state: loc.state || '', latitude: loc.latitude != null ? String(loc.latitude) : '', longitude: loc.longitude != null ? String(loc.longitude) : '', isDefault: !!loc.is_default }); setLocationModalOpen(true); }}>Editar</button><button type="button" className="sf-admin-toggle" onClick={() => onDeleteLocation(loc.id)}>Excluir</button></div>}''')
replace_once('<div className="sf-modal-title">Cadastrar novo local</div>', '<div className="sf-modal-title">{editingLocationId ? \'Editar local\' : \'Cadastrar novo local\'}</div>')
replace_once('''<button type="button" className="sf-btn-ghost" onClick={() => setLocationModalOpen(false)}>Cancelar</button>\n                    <button type="button" className="sf-btn-primary" onClick={async () => { if (!locationDraft.name.trim()) return alert('Informe o nome do local.'); const ok = await onCreateLocation(group.id, locationDraft); if (ok) { setLocationDraft({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', isDefault: false }); setLocationModalOpen(false); } }}>Cadastrar local</button>''','''<button type="button" className="sf-btn-ghost" onClick={() => { setLocationModalOpen(false); setEditingLocationId(null); }}>Cancelar</button><button type="button" className="sf-btn-primary" onClick={async () => { if (!locationDraft.name.trim()) return alert('Informe o nome do local.'); const ok = editingLocationId ? await onUpdateLocation(group.id, editingLocationId, locationDraft) : await onCreateLocation(group.id, locationDraft); if (ok) { setLocationDraft({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', isDefault: false }); setLocationModalOpen(false); setEditingLocationId(null); } }}>{editingLocationId ? 'Salvar alterações' : 'Cadastrar local'}</button>''')

if 'onUpdateLocation' not in s:
    s = re.sub(r'function GroupDetail\(\{\s*group, games, members, locations, myId,([^}]*)onCreateLocation, onDeleteLocation\s*\}\)', r'function GroupDetail({ group, games, members, locations, myId,\1onCreateLocation, onUpdateLocation, onDeleteLocation })', s, count=1)
    changed = True

replace_once('''        {isOwner && (
          <button className="sf-icon-btn sf-danger"''','''        {canManage && <button type="button" className="sf-admin-toggle" style={{ marginLeft: 'auto' }} onClick={() => setEditing(true)}>Gestão</button>}
        {isOwner && (
          <button className="sf-icon-btn sf-danger"''')

old_default = '''  const setGroupDefaultLocation = async (groupId, locationId) => {
    if (locationId) {
      const { error } = await supabase.from('group_locations').update({ is_default: true }).eq('id', locationId).eq('group_id', groupId);
      if (error) { alert('Não foi possível definir o local padrão: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('group_locations').update({ is_default: false }).eq('group_id', groupId);
      if (error) { alert('Não foi possível remover o local padrão: ' + error.message); return; }
    }
    await loadAll();
  };'''
new_default = '''  const setGroupDefaultLocation = async (groupId, locationId) => {
    const { error } = await supabase.rpc('set_group_default_location', { p_group_id: groupId, p_location_id: locationId || null });
    if (error) { alert('Não foi possível definir o local padrão: ' + error.message); return false; }
    await loadAll();
    return true;
  };

  const updateGroupLocation = async (groupId, locationId, draft) => {
    const { error } = await supabase.from('group_locations').update({ name: draft.name.trim(), address: draft.address.trim() || null, city: draft.city.trim() || null, state: draft.state.trim().toUpperCase() || null, latitude: draft.latitude === '' ? null : Number(draft.latitude), longitude: draft.longitude === '' ? null : Number(draft.longitude) }).eq('id', locationId).eq('group_id', groupId);
    if (error) { alert('Não foi possível editar o local: ' + error.message); return false; }
    if (draft.isDefault) { const ok = await setGroupDefaultLocation(groupId, locationId); if (!ok) return false; }
    await loadAll();
    return true;
  };'''
replace_once(old_default, new_default)
replace_once('''            onCreateLocation={createGroupLocation}
            onDeleteLocation={deleteGroupLocation}''','''            onCreateLocation={createGroupLocation}
            onUpdateLocation={updateGroupLocation}
            onDeleteLocation={deleteGroupLocation}''')

if not changed:
    raise SystemExit('NO CHANGES REQUIRED')
p.write_text(s)
