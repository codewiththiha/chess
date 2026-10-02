// Exercise continuous clocks, exact expiry, engine-asset recovery, and setting persistence.
import { test, expect } from '@playwright/test';
import { open, start, move, exchange, go, savedGames } from './helpers';

test('restored clocks keep running and expire by elapsed time', async ({
  page,
}) => {
  await open(page);
  await start(page, { preset: '3 min' });
  await move(page, 'e2', 'e4');
  await exchange(page, 2);
  const before = await page.locator('.chess-clock').nth(1).innerText();
  await page.reload();
  await expect(page.locator('.rail')).toBeVisible();
  await expect(page.locator('.chess-clock.running')).toHaveCount(1);
  await expect
    .poll(async () => page.locator('.chess-clock').nth(1).innerText(), {
      timeout: 8000,
    })
    .not.toBe(before);
  // A very short clock reaches zero while the tab stays open: no pause involved.
  await page.locator('.clock-summary').click();
  await page.getByLabel('Clock minutes', { exact: true }).fill('0.05');
  await page.getByLabel('Clock increment', { exact: true }).fill('0');
  await page
    .locator('.clock-editor')
    .getByRole('button', { name: 'Apply', exact: true })
    .click();
  await expect(page.locator('.play-status strong')).toHaveText('Time expired', {
    timeout: 15000,
  });
  await expect(page.locator('.play-status span')).toContainText('Black wins');
  await go(page, 'Home');
  await expect(page.locator('.saved-game')).toHaveCount(1);
});

test('engine settings survive a reload as one local record each time', async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole('button', { name: 'Engine settings', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Advanced', exact: true }).click();
  await page.getByLabel('Null-move pruning', { exact: true }).uncheck();
  await page.getByLabel('AspStartWindow', { exact: true }).fill('30');
  await page
    .getByRole('button', { name: 'Save settings', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.rail')).toBeVisible();
  await page
    .getByRole('button', { name: 'Engine settings', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Advanced', exact: true }).click();
  await expect(page.getByLabel('AspStartWindow', { exact: true })).toHaveValue(
    '30',
  );
  await expect(
    page.getByLabel('Null-move pruning', { exact: true }),
  ).not.toBeChecked();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await start(page, { preset: '3 min' });
  await move(page, 'e2', 'e4');
  await exchange(page, 2);
  await go(page, 'Home');
  await expect(page.locator('.saved-game')).toHaveCount(1);
});

test('failed engine assets give an actionable error and restart recovers the real WASM', async ({
  page,
  context,
}) => {
  await context.route('**/engine/**/gwaymaegyi_wasm_bg.wasm', (route) =>
    route.abort(),
  );
  await page.goto('/');
  await expect(page.locator('.error-banner')).toBeVisible({ timeout: 20000 });
  // The Home controls stay usable; only engine-dependent play is blocked.
  await page.locator('.time-chip').filter({ hasText: '3 min' }).first().click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('.board-shell')).toHaveAttribute(
    'aria-busy',
    'true',
  );
  await expect(page.getByTestId('chessboard')).toHaveClass(/read-only/);
  await context.unrouteAll();
  await page
    .getByRole('button', { name: 'Restart engine', exact: true })
    .click();
  await expect(page.locator('.error-banner')).toHaveCount(0, {
    timeout: 20000,
  });
  await expect(page.locator('.board-shell')).toHaveAttribute(
    'aria-busy',
    'false',
    { timeout: 20000 },
  );
  await move(page, 'e2', 'e4');
  await exchange(page, 2);
  expect(await savedGames(page)).toBe(1);
});
