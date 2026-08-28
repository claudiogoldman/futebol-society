const fs = require('fs');
const path = 'app/page.js';
let s = fs.readFileSync(path, 'utf8');
function replace(from, to, label) {
  if (!s.includes(from)) throw new Error(`Anchor not found: ${label}`);
  s = s.replace(from, to);
}

replace(
`      avatar: g.avatar || '⚽',`,
`      avatar: g.avatar || null,
      avatarUrl: g.avatar_url || '',`,
'group avatar mapping');

replace(
`  const [avatarDraft, setAvatarDraft] = useState(group.avatar || '⚽');`,
`  const [avatarDraft, setAvatarDraft] = useState(group.avatar || null);
  const [avatarUrlDraft, setAvatarUrlDraft] = useState(group.avatarUrl || '');
  const [avatarUploading, setAvatarUploading] = useState(false);`,
'group avatar state');

replace(
`  const isOwner = myId === group.createdBy;`,
`  const isOwner = myId === group.createdBy;
  const myMembership = members.find((m) => m.user_id === myId || m.userId === myId);
  const canManage = isOwner || myMembership?.role === 'admin';

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Selecione uma imagem.'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('A imagem deve ter no máximo 5 MB.'); return; }
    setAvatarUploading(true);
    try {
      const safeName = (file.name || 'grupo').replace(/[^a-zA-Z0-9._-]/g, '-');
      const filePath = `${group.id}/${myId}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from('group-images').upload(filePath, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('group-images').getPublicUrl(filePath);
      setAvatarUrlDraft(data.publicUrl);
      setAvatarDraft(null);
    } catch (error) {
      alert('Não foi possível enviar a imagem: ' + error.message);
    } finally {
      setAvatarUploading(false);
      event.target.value = '';
    }
  };`,
'group management and upload');

replace(
`      avatar: avatarDraft,`,
`      avatar: avatarDraft,
      avatar_url: avatarUrlDraft || null,`,
'group avatar save');

replace(
`            <div className="sf-cost-row"><span className="sf-muted">Avatar</span><span className="sf-mono-value" style={{ cursor: 'default' }}>{group.avatar || '⚽'}</span></div>`,
`            <div className="sf-cost-row"><span className="sf-muted">Imagem do grupo</span><img src={group.avatarUrl || '/group-avatars/futebol.svg'} alt="Imagem do grupo" style={{ width: 42, height: 42, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--sf-border)' }} /></div>`,
'group avatar display');

replace(
`            {isOwner && <button className="sf-btn-ghost" style={{ width: '100%', marginTop: 6 }} onClick={() => setEditing(true)}>Editar padrões</button>}`,
`            {canManage && <button className="sf-btn-ghost" style={{ width: '100%', marginTop: 6 }} onClick={() => setEditing(true)}>Editar padrões</button>}`,
'group management button');

replace(
`            <label className="sf-field-label">Avatar do grupo</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {['⚽','🏆','🔥','⭐','🦁','🦅','🐺','💚','💙','❤️'].map((avatar) => <button type="button" key={avatar} className={avatarDraft === avatar ? 'sf-btn-primary' : 'sf-btn-ghost'} onClick={() => setAvatarDraft(avatar)} style={{ width: 42, padding: 8 }}>{avatar}</button>)}
            </div>`,
`            <label className="sf-field-label">Imagem do grupo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <img src={avatarUrlDraft || '/group-avatars/futebol.svg'} alt="Prévia da imagem do grupo" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 16, border: '1px solid var(--sf-border)' }} />
              <div style={{ display: 'grid', gap: 8 }}>
                <label className="sf-btn-ghost" style={{ cursor: avatarUploading ? 'wait' : 'pointer', textAlign: 'center' }}>
                  {avatarUploading ? 'Enviando imagem...' : 'Enviar imagem'}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} disabled={avatarUploading} onChange={handleAvatarUpload} />
                </label>
                <button type="button" className="sf-btn-ghost" disabled={!avatarUrlDraft || avatarUploading} onClick={() => setAvatarUrlDraft('')}>Remover imagem</button>
              </div>
            </div>
            <div className="sf-field-label" style={{ marginBottom: 8 }}>Ou escolha uma imagem esportiva</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 16 }}>
              {[['/group-avatars/futebol.svg','Futebol'],['/group-avatars/futsal.svg','Futsal'],['/group-avatars/society.svg','Society'],['/group-avatars/trophy.svg','Competição']].map(([url, label]) => <button type="button" key={url} onClick={() => { setAvatarUrlDraft(url); setAvatarDraft(null); }} className={avatarUrlDraft === url ? 'sf-btn-primary' : 'sf-btn-ghost'} style={{ padding: 5, minHeight: 74 }} title={label}><img src={url} alt={label} style={{ width: 58, height: 58, objectFit: 'cover', borderRadius: 10 }} /></button>)}
            </div>`,
'group image picker');

fs.writeFileSync(path, s);
console.log('Group image avatar codemod applied');
