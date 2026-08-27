const { test, expect } = require('@playwright/test');

test.describe('Produção — smoke tests sem alteração de dados', () => {
  test('aplicação responde e renderiza a página inicial', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'networkidle' });

    expect(response).not.toBeNull();
    expect(response.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/Society - seu futebol, organizado/i);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('não há erros não tratados durante o carregamento inicial', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    const response = await page.goto('/', { waitUntil: 'networkidle' });

    expect(response).not.toBeNull();
    expect(response.status()).toBeLessThan(400);
    expect(pageErrors).toEqual([]);
  });
});
