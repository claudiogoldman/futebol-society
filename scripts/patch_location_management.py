from pathlib import Path
import re
p = Path('app/society-page.js')
s = p.read_text()
changed = 0

def sub(pattern, repl, flags=0):
    global s, changed
    ns, n = re.subn(pattern, repl, s, count=1, flags=flags)
    if n:
        s = ns
        changed += n

if 'editingLocationId' not in s:
    sub(r"(const \[locationDraft, setLocationDraft\] = useState\([^\n]+\);)", r"\1\n  const [editingLocationId, setEditingLocationId] = useState(null);")

if 'Editar</button>' not in s[s.find('Locais cadastrados'):s.find('Locais cadastrados')+6000]:
    sub(r"\{canManage && <button type=\"button\" className=\"sf-admin-toggle\" style=\{\{ marginLeft: 'auto' \}\} onClick=\{\(\) => onDeleteLocation\(loc\.id\)\}>Excluir</button>\}", r'''{canManage && <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}><button type="button" className="sf-admin-toggle" onClick={() => { setEditingLocationId(loc.id); setLocationDraft({ name: loc.name || '', address: loc.address || '', city: loc.city || '', state: loc.state || '', latitude: loc.latitude != null ? String(loc.latitude) : '', longitude: loc.longitude != null ? String(loc.longitude) : '', isDefault: !!loc.is_default }); setLocationModalOpen(true); }}>Editar</button><button type="button" className="sf-admin-toggle" onClick={() => onDeleteLocation(loc.id)}>Excluir</button></div>}''')

if "editingLocationId ? 'Editar local'" not in s:
    sub(r'<div className="sf-modal-title">Cadastrar novo local</div>', r"<div className=\"sf-modal-title\">{editingLocationId ? 'Editar local' : 'Cadastrar novo local'}</div>")

if 'onUpdateLocation(group.id, editingLocationId' not in s:
    sub(r'<button type="button" className="sf-btn-ghost" onClick=\{\(\) => setLocationModalOpen\(false\)\}>Cancelar</button>\s*<button type="button" className="sf-btn-primary" onClick=\{async \(\) => \{ if \(!locationDraft\.name\.trim\(\)\) return alert\(\'Informe o nome do local\.\'\); const ok = await onCreateLocation\(group\.id, locationDraft\); if \(ok\) \{ setLocationDraft\(\{ name: \'\', address: \'\', city: \'\', state: \'\', latitude: \'\', longitude: \'\', isDefault: false \}\); setLocationModalOpen\(false\); \} \}\}>Cadastrar local</button>', r'''<button type="button" className="sf-btn-ghost" onClick={() => { setLocationModalOpen(false); setEditingLocationId(null); }}>Cancelar</button><button type="button" className="sf-btn-primary" onClick={async () => { if (!locationDraft.name.trim()) return alert('Informe o nome do local.'); const ok = editingLocationId ? await onUpdateLocation(group.id, editingLocationId, locationDraft) : await onCreateLocation(group.id, locationDraft); if (ok) { setLocationDraft({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', isDefault: false }); setLocationModalOpen(false); setEditingLocationId(null); } }}>{editingLocationId ? 'Salvar alterações' : 'Cadastrar local'}</button>''')

if 'onUpdateLocation,' not in s:
    sub(r'function GroupDetail\(\{ group, games, members, locations, myId, ([^\n]+onCreateLocation), onDeleteLocation \}\)', r'function GroupDetail({ group, games, members, locations, myId, \1, onUpdateLocation, onDeleteLocation })')

if '>Gestão</button>' not in s:
    sub(r'(\s*)\{isOwner && \(\n\s*<button className="sf-icon-btn sf-danger"', r'''\1{canManage && <button type="button" className="sf-admin-toggle" style={{ marginLeft: 'auto' }} onClick={() => setEditing(true)}>Gestão</button>}\n\1{isOwner && (\n\1<button className="sf-icon-btn sf-danger"''')

if "supabase.rpc('set_group_default_location'" not in s:
    sub(r'  const setGroupDefaultLocation = async \(groupId, locationId\) => \{.*?\n  \};', '''  const setGroupDefaultLocation = async (groupId, locationId) => {
    const { error } = await supabase.rpc('set_group_default_location', { p_group_id: groupId, p_location_id: locationId || null });
    if (error) { alert('Não foi possível definir o local padrão: ' + error.message); return false; }
    await loadAll();
    return true;
  };''', re.S)

if 'const updateGroupLocation = async' not in s:
    marker = "\n  const createGame = async () => {"
    fn = '''\n  const updateGroupLocation = async (groupId, locationId, draft) => {
    const { error } = await supabase.from('group_locations').update({ name: draft.name.trim(), address: draft.address.trim() || null, city: draft.city.trim() || null, state: draft.state.trim().toUpperCase() || null, latitude: draft.latitude === '' ? null : Number(draft.latitude), longitude: draft.longitude === '' ? null : Number(draft.longitude) }).eq('id', locationId).eq('group_id', groupId);
    if (error) { alert('Não foi possível editar o local: ' + error.message); return false; }
    if (draft.isDefault) { const ok = await setGroupDefaultLocation(groupId, locationId); if (!ok) return false; }
    await loadAll();
    return true;
  };\n'''
    if marker in s:
        s = s.replace(marker, fn + marker, 1)
        changed += 1

if 'onUpdateLocation={updateGroupLocation}' not in s:
    sub(r'(onCreateLocation=\{createGroupLocation\}\n\s*)(onDeleteLocation=\{deleteGroupLocation\})', r'\1onUpdateLocation={updateGroupLocation}\n            \2')

print(f'changes={changed}')
if changed == 0:
    raise SystemExit('NO SOURCE CHANGES')
p.write_text(s)
