const { chromium } = require('@playwright/test');
const fs = require('fs');

const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'https://futebol-society-app.vercel.app';
const statePath = '.auth/state.json';

(async () => {
  fs.mkdirSync('.auth', { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(baseURL, { waitUntil: 'networkidle' });
  console.log('Faça login normalmente no navegador aberto.');
  console.log('Depois que a tela autenticada aparecer, este script salvará a sessão.');

  await page.getByRole('button', { name: 'Grupos' }).waitFor({ state: 'visible', timeout: 5 * 60 * 1000 });
  await context.storageState({ path: statePath });
  console.log(`Sessão salva em ${statePath}`);

  await browser.close();
})();
