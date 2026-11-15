'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { setSocialEventGuestStatus } from '../../../../lib/services/social-event-service';

export default function ConfirmSocialEventPage() {
  const params = useParams();
  const token = params?.token;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const update = async (status) => {
    setBusy(true);
    setMessage('');
    try {
      const { error } = await setSocialEventGuestStatus(token, status);
      if (error) throw error;
      setMessage(status === 'CONFIRMED' ? 'Presença confirmada.' : 'Presença cancelada.');
    } catch (error) {
      setMessage(error.message || 'Não foi possível atualizar sua presença.');
    } finally { setBusy(false); }
  };

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1 style={styles.title}>Confirmação de presença</h1>
        <p style={styles.text}>Este link individual permite confirmar, cancelar ou reconfirmar sua presença enquanto o evento estiver aberto.</p>
        <button disabled={busy} style={styles.primary} onClick={() => update('CONFIRMED')}>Confirmar presença</button>
        <button disabled={busy} style={styles.secondary} onClick={() => update('CANCELLED')}>Cancelar presença</button>
        {message && <p role="status" style={styles.message}>{message}</p>}
        <a href="/" style={styles.link}>Voltar ao Futebol Society</a>
      </section>
    </main>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#0B2417', color: '#F3F7F3', padding: '28px 14px', fontFamily: 'Arial, sans-serif' },
  card: { maxWidth: 480, margin: '0 auto', padding: 22, border: '1px solid #315442', borderRadius: 16, background: '#123322' },
  title: { fontSize: 25 },
  text: { color: '#D3E2D7', lineHeight: 1.5 },
  primary: { width: '100%', border: 0, borderRadius: 8, padding: 13, marginTop: 12, background: '#C7F36A', color: '#102519', fontWeight: 700 },
  secondary: { width: '100%', border: '1px solid #A8C8B2', borderRadius: 8, padding: 12, marginTop: 9, background: 'transparent', color: '#fff' },
  message: { padding: 10, background: '#263F2E', borderRadius: 8 },
  link: { display: 'block', marginTop: 18, color: '#C7F36A' },
};
