const { test, expect } = require('@playwright/test');

test.describe('Produção — auditoria autenticada básica', () => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, 'Credenciais E2E não configuradas');

  test('login autenticado e acesso aos fluxos principais', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).not.toBeEmpty();

    const email = page.locator('input[type="email"]').first();
    const password = page.locator('input[type="password"]').first();
    await expect(email).toBeVisible();
    await email.fill(process.env.E2E_EMAIL);
    await password.fill(process.env.E2E_PASSWORD);

    const loginButton = page.getByRole('button', { name: /entrar|login|acessar/i }).first();
    await expect(loginButton).toBeVisible();
    await loginButton.click();

    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toBeEmpty();
    expect(pageErrors).toEqual([]);

    const visibleText = await page.locator('body').innerText();
    expect(visibleText).toMatch(/(grupo|partida|jogador|sair|logout)/i);
  });
});
