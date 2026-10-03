// Verify PGN recording, resumable engine review, one-record branching, and exports.
import { test, expect } from '@playwright/test';
import {
  go,
  homeGames,
  open,
  start,
  study,
  importGame,
  move,
  exchange,
  plies,
  loadFen,
  savedGames,
} from './helpers';
import { EXAMPLE_PGN } from '../../src/lib/domain/pgn';

test('import, real review, refresh, export, rename and delete stay on one record', async ({
  page,
}) => {
  await open(page);
  await importGame(page, EXAMPLE_PGN);
  await plies(page, 7);
  expect(await savedGames(page)).toBe(1);
  await study(page, 'Review');
  await page.getByLabel('Review search budget').selectOption('quick');
  await page
    .locator('.study-card')
    .getByRole('button', { name: 'Review', exact: true })
    .click();
  await expect(page.locator('.review-progress')).toContainText('Reviewed', {
    timeout: 25000,
  });
  await expect(page.locator('.review-statistics')).toContainText('7');
  // The stored review belongs to the same game and is restored, not recomputed.
  await page.reload();
  await expect(page.locator('.rail')).toBeVisible();
  // A finished game restores onto the landing view; the notes live in the game shell.
  await go(page, 'Play');
  await plies(page, 7);
  await study(page, 'Review');
  await expect(page.locator('.review-progress')).toContainText('Reviewed', {
    timeout: 20000,
  });
  await expect(page.locator('.move-list .grade-dot')).toHaveCount(7);
  await expect(
    page.locator('.study-card').getByRole('button', { name: 'Review again' }),
  ).toBeVisible();
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
  await homeGames(page);
  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export White vs Black', exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pgn$/);
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
    page.getByRole('button', { name: 'Open Tactical notebook', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Delete Tactical notebook', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete game', exact: true })
    .click();
  await expect(page.locator('.saved-game')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.rail')).toBeVisible();
  await homeGames(page);
  await expect(page.locator('.saved-game')).toHaveCount(0);
});

test('review can stop and resume using its saved position evaluations', async ({
  page,
}) => {
  await open(page);
  await importGame(page, EXAMPLE_PGN);
  await study(page, 'Review');
  await page.getByLabel('Review search budget').selectOption('thorough');
  await page
    .locator('.study-card')
    .getByRole('button', { name: 'Review', exact: true })
    .click();
  await expect(page.locator('.review-progress')).toContainText('Checking', {
    timeout: 20000,
  });
  await page
    .locator('.study-card')
    .getByRole('button', { name: 'Stop', exact: true })
    .click();
  await expect(page.locator('.review-progress')).toContainText(
    'Partly reviewed',
  );
  await page
    .locator('.study-card')
    .getByRole('button', { name: 'Resume', exact: true })
    .click();
  await expect(page.locator('.review-progress')).toContainText('Reviewed', {
    timeout: 30000,
  });
});

test('studying a saved game branches the same record instead of copying it', async ({
  page,
}) => {
  await open(page);
  await importGame(page, EXAMPLE_PGN);
  expect(await savedGames(page)).toBe(1);
  await study(page, 'Analyze');
  // An imported game opens on its first position, so d4 branches from the start.
  await expect(page.locator('.notation-caption')).toContainText('0 / 7');
  await move(page, 'd2', 'd4');
  await plies(page, 1);
  await expect(
    page.locator('.move-cell').filter({ hasText: 'd4' }),
  ).toBeVisible();
  // The imported game is one record, so a branch never adds a second copy.
  expect(await savedGames(page)).toBe(1);
  await page.reload();
  await plies(page, 1);
  expect(await savedGames(page)).toBe(1);
});

test('bad PGN/FEN is rejected without erasing the active game', async ({
  page,
}) => {
  await open(page);
  await start(page, { preset: '3 min' });
  await move(page, 'e2', 'e4');
  await exchange(page, 2);
  await study(page, 'Analyze');
  await page.getByRole('button', { name: 'Load FEN', exact: true }).click();
  await page.getByLabel('FEN position').fill('not a chess position');
  await page
    .getByRole('button', { name: 'Load position', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('FEN has invalid');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await homeGames(page);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.getByLabel('PGN notation').fill('1. e5 *');
  await page.getByRole('button', { name: 'Import game', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Illegal PGN move');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await go(page, 'Play');
  await exchange(page, 2);
  expect(await savedGames(page)).toBe(1);
});

test('a position can be loaded for study without inventing a game', async ({
  page,
}) => {
  await open(page);
  await loadFen(page, 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  await move(page, 'e1', 'g1');
  await expect(page.locator('#square-f1')).toHaveAttribute(
    'aria-label',
    'f1, white rook',
  );
  await plies(page, 1);
});

const MATED_BLACK =
  '[Event "Rail example"]\n[White "White"]\n[Black "Black"]\n[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# *';
const MATED_WHITE =
  '[Event "Rail example"]\n[White "White"]\n[Black "Black"]\n[Result "1-0"]\n\n1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# *';

test('a decided game fills the rail for its winner', async ({ page }) => {
  await open(page);
  await importGame(page, MATED_BLACK);
  await plies(page, 4);
  // An import opens on the first position, and the whole point of this test is
  // the end of the game: Play jumps to the live position.
  await go(page, 'Play');
  // Black won, so the rail is empty of White — not left half-filled.
  await expect(page.locator('.evaluation-white')).toHaveAttribute(
    'style',
    /height:\s*0%/,
  );
  await expect(page.locator('.evaluation-rail')).toHaveAttribute(
    'title',
    /Black wins/,
  );
  await importGame(page, MATED_WHITE);
  await plies(page, 7);
  await go(page, 'Play');
  await expect(page.locator('.evaluation-white')).toHaveAttribute(
    'style',
    /height:\s*100%/,
  );
  await expect(page.locator('.evaluation-rail')).toHaveAttribute(
    'title',
    /White wins/,
  );
});

test('a finished game reports each side its accuracy', async ({ page }) => {
  await open(page);
  await importGame(page, MATED_BLACK);
  await plies(page, 4);
  await study(page, 'Review');
  await page
    .locator('.study-card')
    .getByRole('button', { name: 'Review', exact: true })
    .click();
  await expect(page.locator('.review-progress')).toContainText('Reviewed', {
    timeout: 60000,
  });
  const sides = page.locator('.accuracy-report .accuracy-side');
  await expect(sides).toHaveCount(2);
  await expect(sides.nth(0)).toContainText('White');
  await expect(sides.nth(0)).toContainText('%');
  await expect(sides.nth(1)).toContainText('Black');
  await expect(sides.nth(1)).toContainText('%');
  const percent = async (index: number) =>
    Number((await sides.nth(index).innerText()).replace(/[^\d]/g, ''));
  const white = await percent(0);
  const black = await percent(1);
  // White walked into mate in four moves; Black delivered it and kept more.
  expect(white).toBeLessThan(100);
  expect(black).toBeGreaterThan(white);
});
