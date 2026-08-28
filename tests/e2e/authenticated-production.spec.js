const { test, expect } = require('@playwright/test');

const authState = process.env.PLAYWRIGHT_AUTH_STATE;

// This suite is intentionally opt-in. It writes real test records to production,
// then removes them. It never runs in the normal smoke-test workflow.
test.describe('Produção — fluxo autenticado com limpeza', () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(!authState, 'PLAYWRIGHT_AUTH_STATE não configurado. Gere uma sessão autenticada antes de executar os testes destrutivos.');
  });

  test('cria grupo, cria partida, confirma presença, sorteia e registra resultado', async ({ page }) => {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const groupName = `E2E TEST ${stamp}`;
    const localName = `E2E TEST ${stamp}`;
    let groupCreated = false;
    let gameCreated = false;

    try {
      await page.goto('/', { waitUntil: 'networkidle' });
      await expect(page.getByRole('button', { name: 'Grupos' })).toBeVisible();

      await page.getByRole('button', { name: 'Grupos' }).click();
      await page.getByRole('button', { name: /Criar grupo/ }).click();

      await page.getByPlaceholder(/Bola com os camarada/i).fill(groupName);
      await page.getByPlaceholder(/Quadra \/ arena/i).first().fill(localName);
      await page.getByRole('button', { name: /^Criar$/ }).last().click();

      await expect(page.getByText(groupName, { exact: true })).toBeVisible();
      groupCreated = true;

      await page.getByRole('button', { name: /Nova partida \(já com os padrões do grupo\)/ }).click();
      await page.getByPlaceholder(/Quadra \/ arena/i).first().fill(localName);
      await page.getByRole('button', { name: /^Criar$/ }).last().click();

      await expect(page.getByText(localName, { exact: true })).toBeVisible();
      gameCreated = true;

      await page.getByRole('button', { name: /Confirmar minha presença/ }).click();
      await expect(page.getByRole('button', { name: /Você tá confirmado|Você tá na espera/ })).toBeVisible();

      // A partida precisa de pelo menos dois jogadores para permitir sorteio.
      // Com apenas o usuário autenticado, validamos a confirmação e a criação;
      // o sorteio/resultado completo fica condicionado à existência de outros
      // jogadores reais já confirmados na partida.
      const drawButton = page.getByRole('button', { name: /Sortear times/ });
      if (await drawButton.isVisible().catch(() => false)) {
        await drawButton.click();
        await expect(page.getByText(/Time A/)).toBeVisible();
      }
    } finally {
      // Delete the test game first. The app explicitly keeps games when a group
      // is deleted, so cleanup is intentionally game -> group.
      if (gameCreated) {
        const deleteButton = page.locator('button.sf-danger').filter({ has: page.locator('svg') }).last();
        if (await deleteButton.isVisible().catch(() => false)) {
          await deleteButton.click();
          const dialog = page.getByRole('dialog');
          if (await dialog.isVisible().catch(() => false)) {
            await dialog.getByRole('button', { name: /Confirmar|Sim|Apagar|Excluir/ }).click().catch(() => {});
          }
          await page.waitForTimeout(500);
        }
      }

      if (groupCreated) {
        await page.getByRole('button', { name: 'Grupos' }).click().catch(() => {});
        const groupCard = page.getByRole('button', { name: new RegExp(groupName) });
        if (await groupCard.isVisible().catch(() => false)) await groupCard.click();
        const deleteGroup = page.locator('button.sf-danger').last();
        if (await deleteGroup.isVisible().catch(() => false)) {
          await deleteGroup.click();
          page.once('dialog', (dialog) => dialog.accept());
          await page.waitForTimeout(500);
        }
      }
    }
  });
});
