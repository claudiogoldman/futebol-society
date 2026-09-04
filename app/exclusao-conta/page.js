export const metadata = {
  title: 'Exclusão de Conta — Futebol Society',
  description: 'Solicitação de exclusão de conta e dados do Futebol Society.',
};

export default function AccountDeletionPage() {
  const email = 'claudio.goldman@gmail.com';
  const subject = encodeURIComponent('Solicitação de exclusão de conta — Futebol Society');
  const body = encodeURIComponent('Solicito a exclusão da minha conta e dos dados pessoais associados ao Futebol Society.\n\nE-mail da conta: ');

  return (
    <main style={{ minHeight: '100vh', background: '#F5F8F5', color: '#26352C', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: '32px 18px' }}>
      <article style={{ maxWidth: 720, margin: '0 auto', background: '#fff', borderRadius: 16, padding: '32px 28px', boxShadow: '0 4px 24px rgba(11,36,23,0.08)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: '#6B7F70', textTransform: 'uppercase', marginBottom: 8 }}>Futebol Society</div>
        <h1 style={{ fontSize: 32, lineHeight: 1.15, margin: '0 0 14px', color: '#0B2417' }}>Exclusão de conta</h1>
        <p style={{ lineHeight: 1.65, margin: '0 0 14px' }}>
          Você pode solicitar a exclusão da sua conta e dos dados pessoais associados ao Futebol Society.
        </p>
        <p style={{ lineHeight: 1.65, margin: '0 0 20px' }}>
          Envie a solicitação a partir do endereço de e-mail associado à conta. Para facilitar a identificação, informe o e-mail usado no aplicativo.
        </p>
        <a
          href={`mailto:${email}?subject=${subject}&body=${body}`}
          style={{ display: 'inline-block', background: '#0B2417', color: '#fff', textDecoration: 'none', padding: '12px 18px', borderRadius: 10, fontWeight: 700 }}
        >
          Solicitar exclusão por e-mail
        </a>
        <p style={{ lineHeight: 1.65, margin: '22px 0 0', color: '#5C6D62', fontSize: 14 }}>
          A solicitação será validada para evitar exclusão indevida. Após a confirmação, os dados pessoais associados serão excluídos ou tratados conforme as obrigações legais aplicáveis.
        </p>
        <p style={{ marginTop: 20 }}>
          <a href="/privacidade" style={{ color: '#0B2417', fontWeight: 700 }}>Voltar à Política de Privacidade</a>
        </p>
      </article>
    </main>
  );
}
