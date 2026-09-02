const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'app', 'page.js');
let s = fs.readFileSync(file, 'utf8');

function replaceOnce(oldText, newText, label) {
  if (s.includes(newText)) return;
  if (!s.includes(oldText)) throw new Error(`location normalization anchor not found: ${label}`);
  s = s.replace(oldText, newText);
}

// Group settings: the default location is a reusable group location, not a free-text field.
replaceOnce(
  "function GroupDetail({ group, games, members, locations, myId, onBack, onSetDefaults, onShare, onNewGame, onOpenGame, onLeave, onDelete, onRemoveMember, onCreateLocation, onDeleteLocation }) {",
  "function GroupDetail({ group, games, members, locations, myId, onBack, onSetDefaults, onSetDefaultLocation, onShare, onNewGame, onOpenGame, onLeave, onDelete, onRemoveMember, onCreateLocation, onDeleteLocation }) {",
  'GroupDetail props'
);

// Remove the legacy free-text draft from the group editor.
s = s.replace("  const [localDraft, setLocalDraft] = useState(group.defaultLocal);\n", '');

replaceOnce(
  '    onSetDefaults(group.id, {\n      name: nameDraft.trim() || group.name,\n      default_local: localDraft.trim() || null,',
  '    onSetDefaults(group.id, {\n      name: nameDraft.trim() || group.name,',
  'remove legacy default_local from group save'
);

replaceOnce(
  '<label className="sf-field-label">Local padrão</label>\n            <input className="sf-input" value={localDraft} onChange={(e) => setLocalDraft(e.target.value)} />',
  '<label className="sf-field-label">Local padrão das partidas</label>\n            <select className="sf-input" value={locations.find((l) => l.is_default)?.id || ""} onChange={(e) => onSetDefaultLocation(group.id, e.target.value || null)}>\n              <option value="">Nenhum local padrão</option>\n              {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}\n            </select>\n            <div className="sf-muted-sm" style={{ marginTop: 4 }}>O local padrão é escolhido entre os locais cadastrados abaixo e será sugerido automaticamente nas novas partidas.</div>',
  'group default location selector'
);

replaceOnce(
  '<div className="sf-cost-row"><span className="sf-muted">Local</span><span className="sf-mono-value" style={{ cursor: \'default\' }}>{group.defaultLocal || \'—\'}</span></div>',
  '<div className="sf-cost-row"><span className="sf-muted">Local padrão</span><span className="sf-mono-value" style={{ cursor: \'default\' }}>{locations.find((l) => l.is_default)?.name || locations.find((l) => l.isDefault)?.name || \'—\'}</span></div>',
  'group default location summary'
);

replaceOnce(
  '<label className="sf-field-label">Local padrão</label>\n            <input className="sf-input" placeholder="Quadra / arena" value={newGroupLocal} onChange={(e) => setNewGroupLocal(e.target.value)} />',
  '<label className="sf-field-label">Local inicial (opcional)</label>\n            <input className="sf-input" placeholder="Nome da quadra / arena" value={newGroupLocal} onChange={(e) => setNewGroupLocal(e.target.value)} />\n            <div className="sf-muted-sm" style={{ marginTop: 4 }}>Depois de criar o grupo, você poderá cadastrar o endereço completo e definir o local padrão em Locais cadastrados.</div>',
  'create group location wording'
);

// Parent handler: changing the default always operates on the reusable location table.
const handlerOld = '  const createGame = async () => {';
const handlerNew = `  const setGroupDefaultLocation = async (groupId, locationId) => {\n    if (locationId) {\n      const { error } = await supabase.from('group_locations').update({ is_default: true }).eq('id', locationId).eq('group_id', groupId);\n      if (error) { alert('Não foi possível definir o local padrão: ' + error.message); return; }\n    } else {\n      const { error } = await supabase.from('group_locations').update({ is_default: false }).eq('group_id', groupId);\n      if (error) { alert('Não foi possível remover o local padrão: ' + error.message); return; }\n    }\n    await loadAll();\n  };\n\n  const createGame = async () => {`;
if (!s.includes('const setGroupDefaultLocation = async')) {
  if (!s.includes(handlerOld)) throw new Error('location normalization anchor not found: default location handler');
  s = s.replace(handlerOld, handlerNew);
}

replaceOnce(
  '<label className="sf-field-label">Local cadastrado no grupo</label>',
  '<label className="sf-field-label">Local da partida</label>',
  'new game location label'
);

// Never use the legacy group.default_local as an implicit location anymore.
s = s.replaceAll("setNewLocal(group.defaultLocal || '');", "setNewLocal('');");
s = s.replaceAll("setNewLocal(g.defaultLocal || '');", "setNewLocal('');");

fs.writeFileSync(file, s);
console.log('Reusable group location terminology normalized.');
