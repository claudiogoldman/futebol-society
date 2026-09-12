'use client';

import { useEffect, useMemo, useState } from 'react';
import { Mail, Phone, Search, Shield, UserRound, RefreshCw } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';

function displayName(player) {
  const nickname = typeof player?.nickname === 'string' ? player.nickname.trim() : '';
  return nickname || player?.name || 'Sem nome';
}

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('get_admin_players_with_email');
    if (rpcError) {
      setError(rpcError.message?.includes('ADMIN_ONLY') ? 'Acesso restrito ao administrador.' : 'Não foi possível carregar os jogadores.');
      setPlayers([]);
    } else {
      setPlayers(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => [p.name, p.nickname, p.email, p.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
  }, [players, search]);

  return (
    <main style={{ minHeight: '100vh', padding: '24px 16px', background: '#f5f7f5', color: '#132018' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 24, fontWeight: 800 }}><Shield size={22} /> Jogadores</div>
            <div style={{ marginTop: 5, color: '#607064' }}>Lista administrativa com o e-mail usado na conta.</div>
          </div>
          <button onClick={load} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 12px', border: '1px solid #cbd5ce', borderRadius: 10, background: '#fff', cursor: 'pointer' }}><RefreshCw size={15} /> Atualizar</button>
        </div>

        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={17} style={{ position: 'absolute', left: 12, top: 12, color: '#718078' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, apelido ou e-mail" style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px 11px 38px', border: '1px solid #cbd5ce', borderRadius: 10, background: '#fff', outline: 'none' }} />
        </div>

        {error ? <div style={{ padding: 14, borderRadius: 10, background: '#fff0f0', color: '#9b2525', marginBottom: 14 }}>{error}</div> : null}
        {loading ? <div style={{ padding: 24, textAlign: 'center', color: '#607064' }}>Carregando jogadores...</div> : null}

        {!loading && !error ? (
          <div style={{ background: '#fff', border: '1px solid #dbe2dc', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5eae6', color: '#607064', fontSize: 13 }}>{filtered.length} jogador(es)</div>
            {filtered.map((player) => (
              <div key={player.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.4fr) minmax(240px, 1.6fr) minmax(150px, 1fr)', gap: 16, alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #eef1ee' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  {player.avatar_url ? <img src={player.avatar_url} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#eef3ef' }}><UserRound size={19} /></div>}
                  <div style={{ minWidth: 0 }}><div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(player)}</div>{player.nickname && player.nickname.trim() && player.name !== displayName(player) ? <div style={{ color: '#718078', fontSize: 12 }}>{player.name}</div> : null}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, color: '#26362b' }}><Mail size={16} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.email || 'E-mail não disponível'}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#607064', fontSize: 14 }}><Phone size={15} />{player.phone || 'Não informado'}{player.is_admin ? <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#315c3d' }}>ADMIN</span> : null}</div>
              </div>
            ))}
            {!filtered.length ? <div style={{ padding: 30, textAlign: 'center', color: '#607064' }}>Nenhum jogador encontrado.</div> : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
