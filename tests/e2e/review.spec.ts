// Verify PGN recording, resumable engine review, immutable archive copies, and exports.
import { test, expect } from '@playwright/test';
import { open, navigate, importGame, game, row, move } from './helpers';
import { EXAMPLE_PGN } from '../../src/lib/domain/pgn';
test('import, real review, refresh, PGN export, rename and delete remain local', async ({
  page,
}) => {
  await open(page);
  await importGame(page, EXAMPLE_PGN);
  const original = await game(page);
  expect(original.moves).toHaveLength(7);
  await page.getByLabel('Review search budget').selectOption('quick');
  await page
    .locator('.review-section')
    .getByRole('button', { name: 'Review', exact: true })
    .click();
  await expect(page.getByText('Review complete', { exact: true })).toBeVisible({
    timeout: 20000,
  });
  expect(await row(page, 'reviews', original.id)).toBeTruthy();
  await expect(page.locator('.review-statistics')).toContainText('7');
  await page.reload();
  await expect(page.locator('.move-cell:not(.missing)')).toHaveCount(7);
  await navigate(page, 'Review');
  await expect(
    page.getByText('Review complete', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.move-list .grade-dot')).toHaveCount(7);
  const chart = page.getByRole('slider', {
    name: 'Game position on evaluation chart',
  });
  await chart.focus();
  await page.keyboard.press('End');
  await expect(chart).toHaveAttribute('aria-valuenow', '7');
  await page.keyboard.press('Home');
  await expect(chart).toHaveAttribute('aria-valuenow', '0');
  await page.keyboard.press('ArrowRight');
  await expect(chart).toHaveAttribute('aria-valuenow', '1');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PGN', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pgn$/);
  await navigate(page, 'Library');
  await page
    .getByRole('button', { name: 'Rename White vs Black', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Game name', exact: true })
    .fill('Tactical notebook');
  await page
    .getByRole('button', { name: 'Save game name', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Tactical notebook', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Delete Tactical notebook', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete game', exact: true })
    .click();
  await expect(page.locator('.saved-game')).toHaveCount(0);
  expect(await row(page, 'reviews', original.id)).toBeUndefined();
  await navigate(page, 'Review');
  await navigate(page, 'Library');
  await expect(page.locator('.saved-game')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.local-engine-badge')).toHaveText('Local engine');
  await navigate(page, 'Library');
  await expect(page.locator('.saved-game')).toHaveCount(0);
  expect(await row(page, 'games', original.id)).toBeUndefined();
});
test('review can stop and resume using its saved position evaluations', async ({
  page,
}) => {
  await open(page);
  await importGame(page, EXAMPLE_PGN);
  await page.getByLabel('Review search budget').selectOption('thorough');
  await page
    .locator('.review-section')
    .getByRole('button', { name: 'Review', exact: true })
    .click();
  await expect(page.locator('.review-progress')).not.toContainText('0 /');
  await page
    .locator('.review-section')
    .getByRole('button', { name: 'Stop', exact: true })
    .click();
  await expect(page.getByText('Review paused', { exact: true })).toBeVisible();
  await page
    .locator('.review-section')
    .getByRole('button', { name: 'Resume', exact: true })
    .click();
  await expect(page.getByText('Review complete', { exact: true })).toBeVisible({
    timeout: 25000,
  });
});
test('analysis branches create a copy rather than overwriting an archived game', async ({
  page,
}) => {
  await open(page);
  await importGame(page, EXAMPLE_PGN);
  const saved = await game(page);
  await navigate(page, 'Library');
  await page
    .getByRole('button', { name: 'Analyze White vs Black', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'First position', exact: true })
    .click();
  await move(page, 'd2', 'd4');
  await expect(page.locator('.move-row')).toHaveCount(1);
  const copy = await game(page);
  expect(copy.id).not.toBe(saved.id);
  expect(copy.moves[0]?.uci).toBe('d2d4');
  const original = await row(page, 'games', saved.id);
  expect(original).toMatchObject({ id: saved.id });
  await navigate(page, 'Library');
  await expect(page.locator('.saved-game')).toHaveCount(2);
});
test('bad PGN/FEN is rejected without erasing the active game', async ({
  page,
}) => {
  await open(page);
  await navigate(page, 'Analysis');
  await page.getByRole('button', { name: 'Load FEN', exact: true }).click();
  await page.getByLabel('FEN position').fill('not a chess position');
  await page
    .getByRole('button', { name: 'Load position', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('FEN has invalid');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await navigate(page, 'Library');
  await page.getByRole('button', { name: 'Import PGN', exact: true }).click();
  await page.getByLabel('PGN notation').fill('1. e5 *');
  await page.getByRole('button', { name: 'Import game', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Illegal PGN move');
});
