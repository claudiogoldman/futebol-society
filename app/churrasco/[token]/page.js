'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { addPublicSocialEventGuest, getPublicSocialEvent } from '../../../lib/services/social-event-service';

export default function PublicSocialEventPage() {
  const params = useParams();
  const token = params?.token;
  const [event, setEvent] = useState(null);
  const [name, setName] = useState('');
  const [confirmationToken, setConfirmationToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error: requestError } = await getPublicSocialEvent(token);
    if (requestError) setError(requestError.message || 'Não foi possível carregar o evento.');
    else if (!data) setError('Evento não encontrado ou link inválido.');
    else { setEvent(data); setError(''); }
    setLoading(false);
  };

  useEffect(() => { if (token) load(); }, [token]);

  const addGuest = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { data, error: requestError } = await addPublicSocialEventGuest(token, name);
      if (requestError) throw requestError;
      setConfirmationToken(data?.confirmation_token || '');
      setName('');
      await load();
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível incluir o nome.');
    } finally { setSaving(false); }
  };

  if (loading) return <main style={styles.page}><div style={styles.card}>Carregando evento...</div></main>;
  if (!event) return <main style={styles.page}><div style={styles.card}><h1>Churrasco</h1><p>{error || 'Evento não encontrado.'}</p></div></main>;

  const date = new Date(event.event_date + 'T12:00:00').toLocaleDateString('pt-BR');
  const isOpen = event.status === 'OPEN';

  return (
    <main style={styles.page}>
      <article style={styles.card}>
        <div style={styles.eyebrow}>Futebol Society · Confraternização</div>
        <h1 style={styles.title}>{event.name}</h1>
        {event.status === 'CANCELLED' && <div style={styles.alert}>Este evento foi cancelado.</div>}
        {event.status === 'CLOSED' && <div style={styles.alert}>Evento encerrado. A consulta permanece disponível, mas não são aceitas novas confirmações.</div>}
        {event.description && <p style={styles.text}>{event.description}</p>}
        <div style={styles.meta}><strong>Data:</strong> {date} · {String(event.event_time).slice(0,5)}</div>
        {event.location && <div style={styles.meta}><strong>Local:</strong> {event.location}</div>}
        <section style={styles.section}>
          <h2 style={styles.heading}>Confirmados ({event.confirmed_count || 0})</h2>
          {(event.confirmed_names || []).length === 0
            ? <p style={styles.muted}>Ainda não há confirmações.</p>
            : <ol style={styles.list}>{event.confirmed_names.map((guest, index) => <li key={index}>{guest}</li>)}</ol>}
        </section>
        {isOpen && (
          <form onSubmit={addGuest} style={styles.section}>
            <h2 style={styles.heading}>Incluir meu nome</h2>
            <p style={styles.muted}>Informe seu nome para entrar na lista. Depois, use o link individual para confirmar ou cancelar sua presença.</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" maxLength={120} style={styles.input} required />
            <button type="submit" disabled={saving} style={styles.button}>{saving ? 'Incluindo...' : 'Adicionar nome'}</button>
          </form>
        )}
        {confirmationToken && (
          <section style={styles.alert}>
            <strong>Seu registro foi criado.</strong>
            <p>Para confirmar ou cancelar sua presença, acesse seu link individual:</p>
            <a style={styles.link} href={'/churrasco/confirmar/' + confirmationToken}>Abrir confirmação individual</a>
            <button type="button" style={styles.secondary} onClick={() => navigator.clipboard.writeText(window.location.origin + '/churrasco/confirmar/' + confirmationToken)}>Copiar link individual</button>
          </section>
        )}
        {error && <p role="alert" style={styles.error}>{error}</p>}
        <footer style={styles.footer}>Futebol Society</footer>
      </article>
    </main>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#0B2417', color: '#F3F7F3', padding: '28px 14px', fontFamily: 'Arial, sans-serif' },
  card: { maxWidth: 560, margin: '0 auto', padding: 22, border: '1px solid #315442', borderRadius: 16, background: '#123322' },
  eyebrow: { color: '#A8C8B2', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 28, margin: '10px 0 18px' },
  text: { color: '#D3E2D7', lineHeight: 1.5 },
  meta: { margin: '7px 0', color: '#D3E2D7' },
  section: { borderTop: '1px solid #315442', marginTop: 20, paddingTop: 16 },
  heading: { fontSize: 18, margin: '0 0 10px' },
  muted: { color: '#B8CDBD', fontSize: 14, lineHeight: 1.5 },
  list: { lineHeight: 1.9, paddingLeft: 22 },
  input: { width: '100%', boxSizing: 'border-box', border: '1px solid #52735D', borderRadius: 8, padding: 12, fontSize: 16, background: '#0B2417', color: '#fff', marginBottom: 10 },
  button: { width: '100%', border: 0, borderRadius: 8, padding: 12, background: '#C7F36A', color: '#102519', fontWeight: 700, fontSize: 15 },
  secondary: { display: 'block', marginTop: 10, border: '1px solid #A8C8B2', borderRadius: 8, padding: 9, background: 'transparent', color: '#fff' },
  alert: { marginTop: 14, padding: 12, borderRadius: 9, background: '#263F2E', border: '1px solid #6B8A70', lineHeight: 1.5 },
  link: { display: 'block', color: '#C7F36A', overflowWrap: 'anywhere' },
  error: { color: '#FFB5A9' },
  footer: { marginTop: 24, textAlign: 'center', color: '#91AA99', fontSize: 12 },
};
