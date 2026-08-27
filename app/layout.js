export const metadata = {
  title: 'Society - seu futebol, organizado',
  description: 'Organize as peladas do seu grupo: presenca, times, rateio e ranking.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
