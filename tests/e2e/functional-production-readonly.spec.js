const { test, expect } = require('@playwright/test');

test.describe('Produção — auditoria funcional autenticada (somente leitura)', () => {
  test.skip(!process.env.PLAYWRIGHT_AUTH_STATE, 'Sessão Playwright autenticada não configurada');

  test('navega pelos módulos principais sem erro de página', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: /sair|logout/i })).toBeVisible({ timeout: 15_000 });

    for (const tabName of ['Partidas', 'Grupos', 'Elenco']) {
      await page.getByRole('button', { name: new RegExp(tabName, 'i') }).click();
      await expect(page.locator('body')).not.toBeEmpty();
    }

    expect(pageErrors).toEqual([]);
  });

  test('grupo selecionado carrega organizadores da partida no escopo do grupo', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: /sair|logout/i })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /partidas/i }).click();
    const newGameButton = page.getByRole('button', { name: /^\s*Nova partida\s*$/i }).last();
    await expect(newGameButton).toBeVisible();
    await newGameButton.click();

    await expect(page.getByText('Nova partida', { exact: true })).toBeVisible();
    const selects = page.locator('select.sf-input');
    await expect(selects.first()).toBeVisible();

    const groupSelect = selects.first();
    const groupOptions = await groupSelect.locator('option').evaluateAll((options) =>
      options.map((option) => ({ value: option.value, text: option.textContent?.trim() || '' }))
    );
    const selectableGroup = groupOptions.find((option) => option.value);

    test.skip(!selectableGroup, 'Usuário E2E não possui grupo disponível para auditoria');
    await groupSelect.selectOption(selectableGroup.value);

    const organizerLabel = page.getByText('Organizador da partida', { exact: true });
    await expect(organizerLabel).toBeVisible();

    const organizerSelect = selects.nth(1);
    await expect(organizerSelect).toBeVisible();

    const organizerOptions = await organizerSelect.locator('option').evaluateAll((options) =>
      options.map((option) => ({ value: option.value, text: option.textContent?.trim() || '' }))
    );

    // The first option is the explicit "Não definido" fallback. When the
    // selected group has members, the UI must expose them as organizer choices.
    expect(organizerOptions.length).toBeGreaterThan(1);
    expect(organizerOptions.slice(1).every((option) => option.value)).toBeTruthy();

    await page.getByRole('button', { name: /cancelar/i }).click();
    expect(pageErrors).toEqual([]);
  });
});
