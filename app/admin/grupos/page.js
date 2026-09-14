'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Layers3, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';

export default function AdminGroupsPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    const { data, error: rpcError } = await supabase.rpc('get_admin_groups');
    if (rpcError) setError(rpcError.message?.includes('ADMIN_ONLY') ? 'Acesso restrito ao administrador.' : 'Não foi possível carregar os grupos.');
    else setGroups(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remove = async (group) => {
    const ok = window.confirm(`Excluir o grupo "${group.name}"?\n\nTodas as partidas, escalações, pagamentos, avaliações e demais dados vinculados ao grupo serão excluídos. Esta operação não pode ser desfeita.`);
    if (!ok) return;
    setBusyId(group.id); setError('');
    const { error: rpcError } = await supabase.rpc('admin_delete_group', { p_group_id: group.id });
    if (rpcError) setError(rpcError.message?.includes('ADMIN_ONLY') ? 'Acesso restrito ao administrador.' : 'Não foi possível excluir o grupo.');
    else setGroups((current) => current.filter((item) => item.id !== group.id));
    setBusyId(null);
  };

  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.header}>
          <div>
            <Link href="/admin" style={styles.back}><ArrowLeft size={16} /> Administração</Link>
            <div style={styles.titleRow}><Layers3 size={23} /><h1 style={styles.title}>Grupos</h1></div>
            <p style={styles.muted}>Todos os grupos cadastrados na aplicação.</p>
          </div>
          <button onClick={load} disabled={loading} style={styles.refresh}><RefreshCw size={15} /> Atualizar</button>
        </div>

        {error ? <div style={styles.error}>{error}</div> : null}
        {loading ? <div style={styles.empty}>Carregando grupos...</div> : null}
        {!loading ? (
          <div style={styles.list}>
            <div style={styles.count}>{groups.length} grupo(s)</div>
            {groups.map((group) => (
              <div key={group.id} style={styles.row}>
                <div style={{ minWidth: 0 }}>
                  <div style={styles.name}>{group.name || 'Sem nome'}</div>
                  <div style={styles.meta}>Criado por {group.created_by_name || 'usuário não disponível'} · {group.member_count} membro(s) · {group.game_count} partida(s)</div>
                </div>
                <button onClick={() => remove(group)} disabled={busyId === group.id} style={styles.delete}><Trash2 size={16} /> {busyId === group.id ? 'Excluindo...' : 'Excluir'}</button>
              </div>
            ))}
            {!groups.length ? <div style={styles.empty}>Nenhum grupo encontrado.</div> : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}

const styles = {
  page: { minHeight: '100vh', padding: '24px 16px', background: '#f5f7f5', color: '#132018' },
  wrap: { maxWidth: 1000, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 20 },
  back: { display: 'inline-flex', alignItems: 'center', gap: 6, color: '#315c3d', textDecoration: 'none', fontSize: 14, fontWeight: 700 },
  titleRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 },
  title: { margin: 0, fontSize: 28, fontWeight: 800 },
  muted: { margin: '5px 0 0', color: '#607064' },
  refresh: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 12px', border: '1px solid #cbd5ce', borderRadius: 10, background: '#fff', cursor: 'pointer' },
  error: { padding: 14, borderRadius: 10, background: '#fff0f0', color: '#9b2525', marginBottom: 14 },
  list: { background: '#fff', border: '1px solid #dbe2dc', borderRadius: 14, overflow: 'hidden' },
  count: { padding: '12px 16px', borderBottom: '1px solid #e5eae6', color: '#607064', fontSize: 13 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '15px 16px', borderBottom: '1px solid #eef1ee' },
  name: { fontWeight: 750 },
  meta: { marginTop: 4, color: '#718078', fontSize: 13 },
  delete: { display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, padding: '8px 11px', border: '1px solid #e1b8b8', borderRadius: 9, background: '#fff6f6', color: '#9b2525', cursor: 'pointer' },
  empty: { padding: 30, textAlign: 'center', color: '#607064' },
};
