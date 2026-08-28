import './group-edit-fix.css';

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
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
