'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, Users, Layers3, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export default function AdminPage() {
  const [allowed, setAllowed] = useState(null);
  const [stats, setStats] = useState({ players: 0, groups: 0 });

  useEffect(() => {
    const load = async () => {
      const { data: isAdmin, error } = await supabase.rpc('is_global_admin');
      if (error || !isAdmin) {
        setAllowed(false);
        return;
      }
      const [{ data: players }, { data: groups }] = await Promise.all([
        supabase.rpc('get_admin_players_with_email'),
        supabase.rpc('get_admin_groups'),
      ]);
      setStats({ players: players?.length || 0, groups: groups?.length || 0 });
      setAllowed(true);
    };
    load();
  }, []);

  if (allowed === null) return <main style={styles.page}><div style={styles.card}>Carregando administração...</div></main>;
  if (!allowed) return <main style={styles.page}><div style={styles.card}><Shield size={28} /><h1 style={styles.title}>Acesso restrito</h1><p>Esta área está disponível somente para administradores globais.</p></div></main>;

  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.header}>
          <div>
            <div style={styles.kicker}><Shield size={18} /> ADMINISTRAÇÃO</div>
            <h1 style={styles.title}>Painel administrativo</h1>
            <p style={styles.muted}>Gestão global de usuários e grupos da aplicação.</p>
          </div>
        </div>

        <div style={styles.grid}>
          <Link href="/admin/jogadores" style={styles.cardLink}>
            <Users size={28} />
            <strong>Usuários</strong>
            <span>{stats.players} cadastrados</span>
            <span style={styles.action}>Gerenciar <ArrowRight size={15} /></span>
          </Link>
          <Link href="/admin/grupos" style={styles.cardLink}>
            <Layers3 size={28} />
            <strong>Grupos</strong>
            <span>{stats.groups} grupos</span>
            <span style={styles.action}>Gerenciar <ArrowRight size={15} /></span>
          </Link>
        </div>

        <div style={styles.warning}>
          <strong>Operações destrutivas</strong>
          <span>A exclusão de usuário ou grupo é permanente e deve ser confirmada pelo administrador.</span>
        </div>
      </div>
    </main>
  );
}

const styles = {
  page: { minHeight: '100vh', padding: '28px 16px', background: '#f5f7f5', color: '#132018' },
  wrap: { maxWidth: 1000, margin: '0 auto' },
  header: { marginBottom: 24 },
  kicker: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, letterSpacing: '.08em', color: '#315c3d' },
  title: { margin: '6px 0', fontSize: 30, fontWeight: 850 },
  muted: { margin: 0, color: '#607064' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 },
  card: { maxWidth: 520, margin: '80px auto', padding: 30, borderRadius: 16, background: '#fff', textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,.06)' },
  cardLink: { display: 'flex', flexDirection: 'column', gap: 8, padding: 24, borderRadius: 16, background: '#fff', border: '1px solid #dbe2dc', color: '#132018', textDecoration: 'none', boxShadow: '0 5px 18px rgba(0,0,0,.04)' },
  action: { display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, color: '#315c3d', fontWeight: 700 },
  warning: { display: 'flex', flexDirection: 'column', gap: 4, marginTop: 20, padding: 16, borderRadius: 12, background: '#fff8e7', border: '1px solid #ead9a8', color: '#624d12' },
};
