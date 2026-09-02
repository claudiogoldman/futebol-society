const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'app', 'page.js');
let s = fs.readFileSync(file, 'utf8');

function replaceRequired(oldText, newText, label) {
  if (!s.includes(oldText)) throw new Error(`location default cleanup anchor not found: ${label}`);
  s = s.replace(oldText, newText);
}

// The group used to expose default_local as a free-text field. Reusable
// locations are now the source of truth; keep the legacy DB column only for
// backwards compatibility and migration, but do not expose/edit it in the UI.
replaceRequired(
  "  const [localDraft, setLocalDraft] = useState(group.defaultLocal);\n",
  "",
  'group local draft state'
);

replaceRequired(
  "            <div className=\"sf-cost-row\"><span className=\"sf-muted\">Local</span><span className=\"sf-mono-value\" style={{ cursor: 'default' }}>{group.defaultLocal || '—'}</span></div>",
  "            <div className=\"sf-cost-row\"><span className=\"sf-muted\">Local padrão</span><span className=\"sf-mono-value\" style={{ cursor: 'default' }}>{locations.find((l) => l.is_default)?.name || locations.find((l) => l.isDefault)?.name || '—'}</span></div>",
  'group default location summary'
);

replaceRequired(
  "      default_local: localDraft.trim() || null,\n",
  "",
  'group default location save'
);

replaceRequired(
  "            <label className=\"sf-field-label\">Local padrão</label>\n            <input className=\"sf-input\" value={localDraft} onChange={(e) => setLocalDraft(e.target.value)} />\n",
  "            <div className=\"sf-muted-sm\" style={{ marginBottom: 8 }}>O local padrão é definido em <strong>Locais cadastrados</strong>, abaixo. Cadastre os locais do grupo e marque um deles como padrão.</div>\n",
  'group default location editor'
);

// Do not fall back to the legacy free-text group field when a reusable
// location is unavailable. A new grouped game must explicitly have no local
// until the user chooses/cadastres one.
s = s.replaceAll(
  "setNewLocal(group.defaultLocal || '');",
  "setNewLocal('');"
);
s = s.replaceAll(
  "setNewLocal(g.defaultLocal || '');",
  "setNewLocal('');"
);

// The old group summary may still be referenced by legacy data mapping. Keep
// the field mapped for compatibility, but the rendered UI above is driven by
// group_locations.

fs.writeFileSync(file, s);
console.log('Legacy free-text group location removed from UI and grouped games.');
