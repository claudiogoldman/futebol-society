const { test, expect } = require('@playwright/test');

test.describe('Produção — auditoria autenticada básica', () => {
  test.skip(!process.env.PLAYWRIGHT_AUTH_STATE, 'Sessão Playwright autenticada não configurada');

  test('sessão autenticada e acesso aos fluxos principais', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).not.toBeEmpty();

    // A aplicação usa Google OAuth via Supabase; a autenticação já é fornecida
    // pelo storageState configurado no Playwright.
    await expect(page.getByRole('button', { name: /sair|logout/i })).toBeVisible({ timeout: 15_000 });

    const visibleText = await page.locator('body').innerText();
    expect(visibleText).toMatch(/(grupo|partida|jogador|elenco|ranking)/i);
    expect(pageErrors).toEqual([]);
  });
});
