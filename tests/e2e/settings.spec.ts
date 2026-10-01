// Exercise dynamic controls, browser backends, appearance persistence, and live limit updates.
import { test, expect } from '@playwright/test';
import { open, navigate, prefs, move, game } from './helpers';
test('all discovered behaviors and parameters are editable and persisted', async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole('button', { name: 'Engine settings', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Advanced', exact: true }).click();
  await expect(page.locator('.behavior-row input')).toHaveCount(11);
  await expect(page.locator('.parameter-grid input')).toHaveCount(38);
  await page.getByRole('button', { name: 'Disable all', exact: true }).click();
  await expect(page.locator('.behavior-row input:checked')).toHaveCount(0);
  await page.getByRole('button', { name: 'Enable all', exact: true }).click();
  await page.getByLabel('Null-move pruning', { exact: true }).uncheck();
  await page.getByLabel('AspStartWindow', { exact: true }).fill('30');
  await page
    .getByRole('button', { name: 'Save settings', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const settings = await prefs(page);
  expect(settings.engine.behaviors['null-move']).toBe(false);
  expect(settings.engine.parameters.AspStartWindow).toBe(30);
  await page.reload();
  await expect(page.locator('.local-engine-badge')).toHaveText('Local engine');
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
});
test('portable backend and nominal Elo/seed configure the real engine', async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole('button', { name: 'Engine settings', exact: true })
    .click();
  await page
    .getByLabel('Personality', { exact: true })
    .selectOption('human-like');
  await page.getByRole('button', { name: 'Nominal Elo', exact: true }).click();
  await page.getByLabel('Nominal Elo', { exact: true }).fill('500');
  await page
    .getByLabel('Random seed', { exact: true })
    .fill('18446744073709551615');
  await page
    .getByLabel('WASM backend', { exact: true })
    .selectOption('portable');
  await page
    .getByRole('button', { name: 'Save settings', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.engine-footnote')).toContainText('Portable WASM');
  await page
    .getByRole('button', { name: 'Resume game', exact: true })
    .first()
    .click();
  await move(page, 'e2', 'e4');
  await expect(page.locator('.move-row')).toHaveCount(1);
  await expect(page.locator('.move-cell.missing')).toHaveCount(0);
  expect((await game(page)).moves).toHaveLength(2);
  expect((await prefs(page)).engine.seed).toBe('18446744073709551615');
});
test('invalid ranges remain staged and do not overwrite saved settings', async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole('button', { name: 'Engine settings', exact: true })
    .click();
  await page.getByLabel('Hash memory, MiB', { exact: true }).fill('65');
  await page
    .getByRole('button', { name: 'Save settings', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    'Hash must be an integer from 1 to 64.',
  );
  await expect(page.getByRole('dialog')).toBeVisible();
  expect((await prefs(page)).engine.hashMiB).toBe(8);
});
test('board/pieces/theme and all motion/aids persist without external downloads', async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole('button', { name: 'Board appearance', exact: true })
    .click();
  await page.getByRole('button', { name: 'Walnut', exact: true }).click();
  await page.getByRole('button', { name: /Classic Colin/ }).click();
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.getByLabel('Piece animations', { exact: true }).uncheck();
  await page.getByLabel('Board coordinates', { exact: true }).uncheck();
  await page
    .getByRole('button', { name: 'Save appearance', exact: true })
    .click();
  await expect(page.getByTestId('chessboard')).toHaveClass(
    /board-walnut pieces-cburnett/,
  );
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    'chess-dark',
  );
  await expect(page.locator('.cg-wrap coords')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.local-engine-badge')).toHaveText('Local engine');
  await expect(page.getByTestId('chessboard')).toHaveClass(
    /board-walnut pieces-cburnett/,
  );
  expect((await prefs(page)).animations).toBe(false);
});
test('live performance changes and cancellation do not produce stale analysis moves', async ({
  page,
}) => {
  await open(page);
  await navigate(page, 'Analysis');
  await page
    .getByRole('button', { name: 'Engine settings', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Performance', exact: true }).click();
  await page
    .getByRole('button', {
      name: 'Full Maximum limits, no deadline',
      exact: true,
    })
    .click();
  await page
    .getByRole('button', { name: 'Save settings', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Stop analysis', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Engine settings', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Performance', exact: true }).click();
  await page.getByLabel('Maximum depth', { exact: true }).fill('2');
  await page.getByLabel('Maximum nodes', { exact: true }).fill('1000');
  await page
    .getByRole('button', { name: 'Save settings', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Analyze position', exact: true }),
  ).toBeVisible();
  await move(page, 'e2', 'e4');
  await expect(page.locator('.move-row')).toHaveCount(1);
  await expect(page.locator('.move-cell.missing')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'First position', exact: true })
    .click();
  await expect(page.locator('#square-e2')).toHaveAttribute(
    'aria-label',
    'e2, white pawn',
  );
  expect((await game(page)).moves).toHaveLength(1);
});
