const fs = require('fs');
const path = 'app/page.js';
let s = fs.readFileSync(path, 'utf8');
function replace(from, to, label) {
  if (!s.includes(from)) throw new Error(`Anchor not found: ${label}`);
  s = s.replace(from, to);
}

replace(
`  const [newGameGroupId, setNewGameGroupId] = useState(null);`,
`  const [newGameGroupId, setNewGameGroupId] = useState(null);
  const [newGameCost, setNewGameCost] = useState('');
  const [newGameGoalkeeperPays, setNewGameGoalkeeperPays] = useState(true);
  const [newGamePixKey, setNewGamePixKey] = useState('');
  const [newGamePixReceiverName, setNewGamePixReceiverName] = useState('');
  const [newGamePixCity, setNewGamePixCity] = useState('');`, 'new game state');

replace(
`      date, local: newLocal.trim(), created_by: myId, max_players: maxPlayers, group_id: newGameGroupId || null,`,
`      date, local: newLocal.trim(), created_by: myId, max_players: maxPlayers, group_id: newGameGroupId || null,
      cost: newGameCost === '' ? 0 : Number(newGameCost),
      goalkeeper_pays: newGameGoalkeeperPays,
      pix_key: newGamePixKey.trim() || null,
      pix_receiver_name: newGamePixReceiverName.trim() || null,
      pix_city: newGamePixCity.trim() || null,`, 'create game payload');

replace(
`    setNewDate(''); setNewLocal(''); setNewMaxPlayers(''); setNewGameGroupId(null); setShowNewGame(false);`,
`    setNewDate(''); setNewLocal(''); setNewMaxPlayers(''); setNewGameGroupId(null);
    setNewGameCost(''); setNewGameGoalkeeperPays(true); setNewGamePixKey(''); setNewGamePixReceiverName(''); setNewGamePixCity('');
    setShowNewGame(false);`, 'create game reset');

replace(
`    setNewMaxPlayers(group.defaultMaxPlayers ? String(group.defaultMaxPlayers) : '');
    setShowNewGame(true);`,
`    setNewMaxPlayers(group.defaultMaxPlayers ? String(group.defaultMaxPlayers) : '');
    setNewGameCost(group.defaultCost != null ? String(group.defaultCost) : '');
    setNewGameGoalkeeperPays(group.defaultGoalkeeperPays !== false);
    setNewGamePixKey(group.defaultPixKey || '');
    setNewGamePixReceiverName(group.defaultPixReceiverName || '');
    setNewGamePixCity(group.defaultPixCity || '');
    setShowNewGame(true);`, 'open group defaults');

replace(
`      defaultCost: g.default_cost != null ? Number(g.default_cost) : null,
    })));`,
`      defaultCost: g.default_cost != null ? Number(g.default_cost) : null,
      defaultGoalkeeperPays: g.default_goalkeeper_pays !== false,
      defaultPixKey: g.default_pix_key || '',
      defaultPixReceiverName: g.default_pix_receiver_name || '',
      defaultPixCity: g.default_pix_city || '',
      avatar: g.avatar || '⚽',
    })));`, 'group mapping');

replace(
`  const [costDraft, setCostDraft] = useState(group.defaultCost || '');`,
`  const [costDraft, setCostDraft] = useState(group.defaultCost || '');
  const [goalkeeperPaysDraft, setGoalkeeperPaysDraft] = useState(group.defaultGoalkeeperPays !== false);
  const [pixKeyDraft, setPixKeyDraft] = useState(group.defaultPixKey || '');
  const [pixReceiverDraft, setPixReceiverDraft] = useState(group.defaultPixReceiverName || '');
  const [pixCityDraft, setPixCityDraft] = useState(group.defaultPixCity || '');
  const [avatarDraft, setAvatarDraft] = useState(group.avatar || '⚽');`, 'group defaults state');

replace(
`      default_cost: costDraft ? parseFloat(costDraft) : null,
    });`,
`      default_cost: costDraft ? parseFloat(costDraft) : null,
      default_goalkeeper_pays: goalkeeperPaysDraft,
      default_pix_key: pixKeyDraft.trim() || null,
      default_pix_receiver_name: pixReceiverDraft.trim() || null,
      default_pix_city: pixCityDraft.trim() || null,
      avatar: avatarDraft,
    });`, 'group save fields');

replace(
`            <div className="sf-cost-row"><span className="sf-muted">Custo da quadra</span><span className="sf-mono-value" style={{ cursor: 'default' }}>{group.defaultCost ? money(group.defaultCost) : '—'}</span></div>`,
`            <div className="sf-cost-row"><span className="sf-muted">Avatar</span><span className="sf-mono-value" style={{ cursor: 'default' }}>{group.avatar || '⚽'}</span></div>
            <div className="sf-cost-row"><span className="sf-muted">Custo da quadra</span><span className="sf-mono-value" style={{ cursor: 'default' }}>{group.defaultCost ? money(group.defaultCost) : '—'}</span></div>
            <div className="sf-cost-row"><span className="sf-muted">Goleiro paga?</span><span className="sf-mono-value" style={{ cursor: 'default' }}>{group.defaultGoalkeeperPays !== false ? 'Sim' : 'Não'}</span></div>
            <div className="sf-cost-row"><span className="sf-muted">PIX</span><span className="sf-mono-value" style={{ cursor: 'default' }}>{group.defaultPixKey || '—'}</span></div>`, 'group defaults display');

replace(
`            <label className="sf-field-label">Nome do grupo</label>`,
`            <label className="sf-field-label">Avatar do grupo</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {['⚽','🏆','🔥','⭐','🦁','🦅','🐺','💚','💙','❤️'].map((avatar) => <button type="button" key={avatar} className={avatarDraft === avatar ? 'sf-btn-primary' : 'sf-btn-ghost'} onClick={() => setAvatarDraft(avatar)} style={{ width: 42, padding: 8 }}>{avatar}</button>)}
            </div>
            <label className="sf-field-label">Nome do grupo</label>`, 'avatar picker');

replace(
`            <label className="sf-field-label">Custo padrão da quadra</label>`,
`            <label className="sf-field-label">Goleiro paga a quadra?</label>
            <div className="sf-gk-toggle" style={{ marginBottom: 12 }}><button type="button" className={goalkeeperPaysDraft ? 'sf-gk-toggle-on' : ''} onClick={() => setGoalkeeperPaysDraft(true)}>Sim</button><button type="button" className={!goalkeeperPaysDraft ? 'sf-gk-toggle-on' : ''} onClick={() => setGoalkeeperPaysDraft(false)}>Não</button></div>
            <label className="sf-field-label">Chave PIX padrão</label><input className="sf-input" value={pixKeyDraft} onChange={(e) => setPixKeyDraft(e.target.value)} />
            <label className="sf-field-label">Recebedor padrão</label><input className="sf-input" value={pixReceiverDraft} onChange={(e) => setPixReceiverDraft(e.target.value)} />
            <label className="sf-field-label">Cidade do PIX</label><input className="sf-input" value={pixCityDraft} onChange={(e) => setPixCityDraft(e.target.value)} />
            <label className="sf-field-label">Custo padrão da quadra</label>`, 'group pix fields');

replace(
`            <label className="sf-field-label">Limite de vagas (opcional)</label>
            <input type="number" min="1" className="sf-input" placeholder="Sem limite" value={newMaxPlayers} onChange={(e) => setNewMaxPlayers(e.target.value)} />`,
`            <label className="sf-field-label">Limite de vagas (opcional)</label>
            <input type="number" min="1" className="sf-input" placeholder="Sem limite" value={newMaxPlayers} onChange={(e) => setNewMaxPlayers(e.target.value)} />
            <label className="sf-field-label">Custo da quadra</label><input type="number" min="0" step="0.01" className="sf-input" value={newGameCost} onChange={(e) => setNewGameCost(e.target.value)} />
            <label className="sf-field-label">Goleiro paga a quadra?</label><div className="sf-gk-toggle" style={{ marginBottom: 12 }}><button type="button" className={newGameGoalkeeperPays ? 'sf-gk-toggle-on' : ''} onClick={() => setNewGameGoalkeeperPays(true)}>Sim</button><button type="button" className={!newGameGoalkeeperPays ? 'sf-gk-toggle-on' : ''} onClick={() => setNewGameGoalkeeperPays(false)}>Não</button></div>
            <label className="sf-field-label">Chave PIX</label><input className="sf-input" value={newGamePixKey} onChange={(e) => setNewGamePixKey(e.target.value)} />
            <label className="sf-field-label">Recebedor do PIX</label><input className="sf-input" value={newGamePixReceiverName} onChange={(e) => setNewGamePixReceiverName(e.target.value)} />
            <label className="sf-field-label">Cidade do PIX</label><input className="sf-input" value={newGamePixCity} onChange={(e) => setNewGamePixCity(e.target.value)} />`, 'new game finance fields');

// Ensure OVR is numeric even while inputs are strings.
replace(
`  const vals = [p.attr_ata, p.attr_def, p.attr_for, p.attr_hab].map((v) => (v == null ? 50 : v));`,
`  const vals = [p.attr_ata, p.attr_def, p.attr_for, p.attr_hab].map((v) => (v == null || v === '' ? 50 : Number(v)));`, 'numeric OVR');

fs.writeFileSync(path, s);
console.log('UI finalization codemod applied');