export const metadata = {
    title: 'Society - seu futebol, organizado',
    description: 'Organize as peladas do seu grupo: presenca, times, rateio e ranking.',
};

export default function RootLayout({ children }) {
    return (
          <html lang="pt-BR">
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
              <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap"
          />
              </head>
        <body style={{ margin: 0 }}>{children}</body>
  </html>
  );
}
