from pathlib import Path

p = Path('app/society-page.js')
s = p.read_text(encoding='utf-8')

repls = [
("const [inlineLocationOpen, setInlineLocationOpen] = useState(false);\n  const [inlineLocationDraft, setInlineLocationDraft] = useState({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', isDefault: false });",
 "const [inlineLocationOpen, setInlineLocationOpen] = useState(false);\n  const [inlineLocationDraft, setInlineLocationDraft] = useState({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', cost: '', isDefault: false });"),
("latitude: '', longitude: '', isDefault: false });\n  const [rankingGroupFilter", "latitude: '', longitude: '', cost: '', isDefault: false });\n  const [rankingGroupFilter"),
("const createInlineGameLocation = async () => {", "const createInlineGameLocation = async () => {"),
("longitude: inlineLocationDraft.longitude === '' ? null : Number(inlineLocationDraft.longitude), is_default: !!inlineLocationDraft.isDefault, created_by: myId", "longitude: inlineLocationDraft.longitude === '' ? null : Number(inlineLocationDraft.longitude), cost: inlineLocationDraft.cost === '' ? null : Number(inlineLocationDraft.cost), is_default: !!inlineLocationDraft.isDefault, created_by: myId"),
("longitude: draft.longitude === '' ? null : Number(draft.longitude), is_default: !!draft.isDefault, created_by: myId", "longitude: draft.longitude === '' ? null : Number(draft.longitude), cost: draft.cost === '' ? null : Number(draft.cost), is_default: !!draft.isDefault, created_by: myId"),
("latitude: '', longitude: '', isDefault: false });\n    setInlineLocationOpen(false);", "latitude: '', longitude: '', cost: '', isDefault: false });\n    setInlineLocationOpen(false);"),
("latitude: loc.latitude != null ? String(loc.latitude) : '', longitude: loc.longitude != null ? String(loc.longitude) : '', isDefault: !!loc.is_default", "latitude: loc.latitude != null ? String(loc.latitude) : '', longitude: loc.longitude != null ? String(loc.longitude) : '', cost: loc.cost != null ? String(loc.cost) : '', isDefault: !!loc.is_default"),
("<div className=\"sf-muted-sm\" style={{ marginTop: 4 }}>{[loc.address, loc.city && loc.state ? loc.city + '/' + loc.state : (loc.city || loc.state)].filter(Boolean).join(' · ') || 'Endereço não informado'}</div>", "<div className=\"sf-muted-sm\" style={{ marginTop: 4 }}>{[loc.address, loc.city && loc.state ? loc.city + '/' + loc.state : (loc.city || loc.state), loc.cost != null ? money(Number(loc.cost)) : null].filter(Boolean).join(' · ') || 'Endereço não informado'}</div>"),
("<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}><input type=\"number\" step=\"any\" className=\"sf-input\" placeholder=\"Latitude (opcional)\" value={locationDraft.latitude} onChange={(e) => setLocationDraft({ ...locationDraft, latitude: e.target.value })} /><input type=\"number\" step=\"any\" className=\"sf-input\" placeholder=\"Longitude (opcional)\" value={locationDraft.longitude} onChange={(e) => setLocationDraft({ ...locationDraft, longitude: e.target.value })} /></div>", "<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}><input type=\"number\" step=\"any\" className=\"sf-input\" placeholder=\"Latitude (opcional)\" value={locationDraft.latitude} onChange={(e) => setLocationDraft({ ...locationDraft, latitude: e.target.value })} /><input type=\"number\" step=\"any\" className=\"sf-input\" placeholder=\"Longitude (opcional)\" value={locationDraft.longitude} onChange={(e) => setLocationDraft({ ...locationDraft, longitude: e.target.value })} /></div>\n                  <label className=\"sf-field-label\">Custo da quadra neste local</label>\n                  <input type=\"number\" min=\"0\" step=\"0.01\" className=\"sf-input\" placeholder=\"Ex.: 170\" value={locationDraft.cost} onChange={(e) => setLocationDraft({ ...locationDraft, cost: e.target.value })} />"),
("longitude: draft.longitude === '' ? null : Number(draft.longitude) }).eq('id', locationId).eq('group_id', groupId);\n    if (error)", "longitude: draft.longitude === '' ? null : Number(draft.longitude), cost: draft.cost === '' ? null : Number(draft.cost) }).eq('id', locationId).eq('group_id', groupId);\n    if (error)"),
("if (draft.isDefault) { const ok = await setGroupDefaultLocation(groupId, locationId); if (!ok) return false; }\n    await loadAll();", "if (draft.isDefault) { const ok = await setGroupDefaultLocation(groupId, locationId); if (!ok) return false; } else { const ok = await setGroupDefaultLocation(groupId, null); if (!ok) return false; }\n    await loadAll();"),
]

for old, new in repls:
    if old not in s:
        raise SystemExit(f'pattern not found: {old[:120]}')
    s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')
print('patched location cost/default editing')
