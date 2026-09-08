const { test, expect } = require('@playwright/test');

test.describe('Produção — auditoria autenticada básica', () => {
  test.skip(!process.env.PLAYWRIGHT_AUTH_STATE, 'Sessão Playwright autenticada não configurada');

  test('sessão autenticada e acesso aos fluxos principais', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).not.toBeEmpty();

    // A aplicação usa Google OAuth via Supabase. O storageState fornece a
    // sessão; a presença da navegação autenticada é o indicador real de que
    // a sessão foi aceita pela aplicação. Não dependemos de um botão de
    // logout específico, que pode variar com a UI.
    await expect(page.getByRole('button', { name: /partidas/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /grupos/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /elenco/i })).toBeVisible({ timeout: 15_000 });

    const visibleText = await page.locator('body').innerText();
    expect(visibleText).toMatch(/(grupo|partida|jogador|elenco|ranking)/i);
    expect(pageErrors).toEqual([]);
  });
});
