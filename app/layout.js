import './group-edit-fix.css';
import './ui-audit-fix.css';
import WaitlistStatus from './waitlist-status';

export const metadata = {
  title: 'Futebol Society — seu futebol, organizado',
  description: 'Organize as peladas do seu grupo: presença, times, rateio e ranking.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/society.svg',
    shortcut: '/icons/society.svg',
    apple: '/icons/society.svg',
  },
  appleWebApp: {
    capable: true,
    title: 'Society',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0B2417',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0 }}>
        {children}
        <WaitlistStatus />
        <footer style={{ padding: '12px 16px 18px', textAlign: 'center', fontSize: 11, background: '#0B2417' }}>
          <a href="/privacidade" style={{ color: '#B8CDBD', textDecoration: 'none' }}>Política de Privacidade</a>
          {' · '}
          <a href="/exclusao-conta" style={{ color: '#B8CDBD', textDecoration: 'none' }}>Exclusão de conta</a>
        </footer>
      </body>
    </html>
  );
}
