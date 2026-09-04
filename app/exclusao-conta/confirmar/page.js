'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function ConfirmAccountDeletionPage() {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleDelete() {
    if (confirmation.trim().toUpperCase() !== 'EXCLUIR') {
      setError('Digite EXCLUIR para confirmar.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('Excluindo sua conta...');

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      setBusy(false);
      setMessage('');
      setError('Não foi possível identificar uma sessão autenticada. Entre novamente no aplicativo e tente de novo.');
      return;
    }

    const { error: deletionError } = await supabase.rpc('delete_my_account');
    if (deletionError) {
      setBusy(false);
      setMessage('');
      setError(`Não foi possível excluir a conta: ${deletionError.message}`);
      return;
    }

    await supabase.auth.signOut();
    setMessage('Conta excluída com sucesso.');
    setConfirmation('');
    setTimeout(() => router.replace('/'), 900);
  }

  return (
    <main style={{ minHeight: '100vh', background: '#F5F8F5', color: '#26352C', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: '32px 18px' }}>
      <article style={{ maxWidth: 720, margin: '0 auto', background: '#fff', borderRadius: 16, padding: '32px 28px', boxShadow: '0 4px 24px rgba(11,36,23,0.08)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: '#6B7F70', textTransform: 'uppercase', marginBottom: 8 }}>Futebol Society</div>
        <h1 style={{ fontSize: 32, lineHeight: 1.15, margin: '0 0 14px', color: '#0B2417' }}>Excluir minha conta</h1>
        <p style={{ lineHeight: 1.65, margin: '0 0 12px' }}>
          Esta ação é permanente. Os dados pessoais associados à sua conta serão excluídos. Registros de grupos e partidas criados por você serão preservados sem a referência pessoal do proprietário quando necessário para manter a integridade das atividades dos demais usuários.
        </p>
        <p style={{ lineHeight: 1.65, margin: '0 0 20px', color: '#5C6D62' }}>
          Seus registros de participação, avaliações, gols, pagamentos e lista de espera associados ao seu perfil serão removidos.
        </p>

        <label htmlFor="delete-confirmation" style={{ display: 'block', fontWeight: 700, marginBottom: 8 }}>
          Digite <strong>EXCLUIR</strong> para confirmar
        </label>
        <input
          id="delete-confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          disabled={busy}
          autoComplete="off"
          spellCheck="false"
          style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1px solid #B8CDBD', borderRadius: 10, fontSize: 16, marginBottom: 12 }}
        />

        <button
          type="button"
          onClick={handleDelete}
          disabled={busy || confirmation.trim().toUpperCase() !== 'EXCLUIR'}
          style={{ width: '100%', padding: '12px 16px', border: 0, borderRadius: 10, background: busy ? '#8A9B90' : '#B42318', color: '#fff', fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}
        >
          {busy ? 'Excluindo...' : 'Excluir minha conta definitivamente'}
        </button>

        {message && <p role="status" style={{ color: '#0B6B3A', lineHeight: 1.5, marginTop: 16 }}>{message}</p>}
        {error && <p role="alert" style={{ color: '#B42318', lineHeight: 1.5, marginTop: 16 }}>{error}</p>}

        <p style={{ marginTop: 22 }}>
          <a href="/exclusao-conta" style={{ color: '#0B2417', fontWeight: 700 }}>Voltar para as opções de exclusão</a>
        </p>
      </article>
    </main>
  );
}
