const { test, expect } = require('@playwright/test');

async function expectAuthenticatedApp(page) {
  const navigation = page.getByRole('button', { name: /partidas/i });

  if (await navigation.isVisible().catch(() => false)) return;

  const visibleText = await page.locator('body').innerText().catch(() => '');
  if (/entrar|login|google/i.test(visibleText)) {
    throw new Error(
      'Autenticação E2E não foi aceita pela produção: a aplicação retornou a tela de login. O PLAYWRIGHT_AUTH_STATE_B64 precisa ser renovado; não há evidência, neste teste, de falha no código funcional.'
    );
  }

  throw new Error(
    `Aplicação autenticada não identificada na produção. Conteúdo visível: ${visibleText.slice(0, 500)}`
  );
}

test.describe('Produção — auditoria funcional autenticada (somente leitura)', () => {
  test.skip(!process.env.PLAYWRIGHT_AUTH_STATE, 'Sessão Playwright autenticada não configurada');

  test('navega pelos módulos principais sem erro de página', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/', { waitUntil: 'networkidle' });
    await expectAuthenticatedApp(page);

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
    await expectAuthenticatedApp(page);

    await page.getByRole('button', { name: /partidas/i }).click();
    const newGameButton = page.getByRole('button', { name: /^\s*Nova partida\s*$/i }).last();
    await expect(newGameButton).toBeVisible();
    await newGameButton.click();

    const newGameModalTitle = page.locator('.sf-modal-title').filter({ hasText: /^Nova partida$/ });
    await expect(newGameModalTitle).toBeVisible();
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

    expect(organizerOptions.length).toBeGreaterThan(1);
    expect(organizerOptions.slice(1).every((option) => option.value)).toBeTruthy();

    await page.getByRole('button', { name: /cancelar/i }).click();
    expect(pageErrors).toEqual([]);
  });
});
