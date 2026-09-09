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

test.describe('Produção — auditoria autenticada básica', () => {
  test.skip(!process.env.PLAYWRIGHT_AUTH_STATE, 'Sessão Playwright autenticada não configurada');

  test('sessão autenticada e acesso aos fluxos principais', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).not.toBeEmpty();
    await expectAuthenticatedApp(page);

    await expect(page.getByRole('button', { name: /partidas/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /grupos/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /elenco/i })).toBeVisible();

    const visibleText = await page.locator('body').innerText();
    expect(visibleText).toMatch(/(grupo|partida|jogador|elenco|ranking)/i);

    const chat = page.getByRole('region', { name: /chat da partida/i });
    if (await chat.isVisible().catch(() => false)) {
      await expect(chat.getByRole('textbox', { name: 'Mensagem' })).toBeVisible();
      await expect(chat.getByRole('button', { name: 'Enviar' })).toBeVisible();

      const ownEditButtons = chat.getByRole('button', { name: /editar mensagem/i });
      const ownDeleteButtons = chat.getByRole('button', { name: /excluir mensagem/i });
      const editCount = await ownEditButtons.count();
      const deleteCount = await ownDeleteButtons.count();

      expect(editCount).toBe(deleteCount);
      if (editCount > 0) {
        await expect(ownEditButtons.first()).toBeVisible();
        await expect(ownDeleteButtons.first()).toBeVisible();
      }
    }

    expect(pageErrors).toEqual([]);
  });
});
