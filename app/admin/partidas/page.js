'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, RefreshCw, Shield, Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';

function errorMessage(message) {
  if (message?.includes('ADMIN_ONLY')) return 'Acesso restrito ao administrador.';
  if (message?.includes('GAME_NOT_FOUND')) return 'A partida não foi encontrada ou já foi excluída.';
  return 'Não foi possível excluir a partida. Verifique se existem dados vinculados que impeçam a exclusão.';
}

function formatDate(value) {
  if (!value) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value + 'T12:00:00'));
}

export default function AdminGamesPage() {
  const [games, setGames] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const { data: isAdmin, error: adminError } = await supabase.rpc('is_global_admin');
    if (adminError || !isAdmin) {
      setError('Acesso restrito ao administrador.');
      setGames([]);
      setLoading(false);
      return;
    }
    const { data, error: rpcError } = await supabase.rpc('get_admin_games');
    if (rpcError) {
      setError(errorMessage(rpcError.message));
      setGames([]);
    } else {
      setGames(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return games;
    return games.filter((g) => [g.local, g.group_name, g.creator_name, g.date]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q)));
  }, [games, search]);

  const remove = async (game) => {
    const label = [formatDate(game.date), game.local || 'Local a definir', game.group_name].filter(Boolean).join(' · ');
    if (!window.confirm(
      'Excluir a partida "' + label + '"?\n\nTodos os registros vinculados à partida, como presenças, times, pagamentos, gols e avaliações, serão removidos conforme as regras de integridade do banco. Esta operação não pode ser desfeita.'
    )) return;

    setBusyId(game.id);
    setError('');
    const { error: rpcError } = await supabase.rpc('admin_delete_game', { p_game_id: game.id });
    if (rpcError) {
      setError(errorMessage(rpcError.message));
    } else {
      setGames((current) => current.filter((item) => item.id !== game.id));
    }
    setBusyId(null);
  };

  return (
    <main style={S.page}>
      <div style={S.wrap}>
        <div style={S.header}>
          <div>
            <Link href="/admin" style={S.back}><ArrowLeft size={15} /> Administração</Link>
            <div style={S.titleRow}><Shield size={22} /><h1 style={S.title}>Partidas</h1></div>
            <div style={S.muted}>Todas as partidas disponíveis para administração global.</div>
          </div>
          <button onClick={load} disabled={loading} style={S.refresh}><RefreshCw size={15} /> Atualizar</button>
        </div>

        <div style={S.searchWrap}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por local, grupo, criador ou data" style={S.search} />
        </div>

        {error && <div style={S.error}>{error}</div>}
        {loading && <div style={S.loading}>Carregando partidas...</div>}

        {!loading && !error && (
          <div style={S.table}>
            <div style={S.count}>{filtered.length} partida(s)</div>
            {filtered.map((game) => (
              <div key={game.id} style={S.row}>
                <div style={S.icon}><CalendarDays size={19} /></div>
                <div style={S.main}>
                  <div style={S.name}>{formatDate(game.date)} · {game.local || 'Local a definir'}</div>
                  <div style={S.sub}>{game.group_name || 'Sem grupo'} · Criada por {game.creator_name || 'usuário não identificado'}</div>
                  {(game.score_a != null && game.score_b != null) && <div style={S.score}>Placar: {game.score_a} × {game.score_b}</div>}
                </div>
                <button onClick={() => remove(game)} disabled={busyId === game.id} title="Excluir partida" style={S.delete}>
                  <Trash2 size={15} /> {busyId === game.id ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            ))}
            {!filtered.length && <div style={S.loading}>Nenhuma partida encontrada.</div>}
          </div>
        )}
      </div>
    </main>
  );
}

const S = {
  page: { minHeight: '100vh', padding: '24px 16px', background: '#f5f7f5', color: '#132018' },
  wrap: { maxWidth: 1000, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20 },
  back: { display: 'inline-flex', alignItems: 'center', gap: 6, color: '#315c3d', textDecoration: 'none', fontSize: 13, fontWeight: 700, marginBottom: 10 },
  titleRow: { display: 'flex', alignItems: 'center', gap: 8 },
  title: { margin: 0, fontSize: 28, fontWeight: 800 },
  muted: { marginTop: 5, color: '#607064' },
  refresh: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 12px', border: '1px solid #cbd5ce', borderRadius: 10, background: '#fff', cursor: 'pointer' },
  searchWrap: { marginBottom: 14 },
  search: { width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: '1px solid #cbd5ce', borderRadius: 10, background: '#fff', outline: 'none' },
  error: { padding: 14, borderRadius: 10, background: '#fff0f0', color: '#9b2525', marginBottom: 14 },
  loading: { padding: 24, textAlign: 'center', color: '#607064' },
  table: { background: '#fff', border: '1px solid #dbe2dc', borderRadius: 14, overflow: 'hidden' },
  count: { padding: '12px 16px', borderBottom: '1px solid #e5eae6', color: '#607064', fontSize: 13 },
  row: { display: 'grid', gridTemplateColumns: '36px minmax(0, 1fr) auto', gap: 12, alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #eef1ee' },
  icon: { width: 36, height: 36, borderRadius: 9, display: 'grid', placeItems: 'center', background: '#eef3ef', color: '#315c3d' },
  main: { minWidth: 0 },
  name: { fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sub: { marginTop: 4, color: '#607064', fontSize: 12 },
  score: { marginTop: 4, fontSize: 12, color: '#315c3d', fontWeight: 700 },
  delete: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 10px', border: '1px solid #e1b8b8', borderRadius: 9, background: '#fff6f6', color: '#9b2525', cursor: 'pointer', fontSize: 13 },
};
