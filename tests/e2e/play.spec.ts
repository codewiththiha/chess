// Verify engine play, tap/drag/keyboard input, clocks, and terminal recording in Chromium.
import { test, expect } from '@playwright/test';
import {
  open,
  start,
  move,
  drag,
  exchange,
  plies,
  loadFen,
  savedGames,
} from './helpers';

test('tap moves are answered by real WASM and the game returns as one record', async ({
  page,
}) => {
  await open(page);
  await start(page, { preset: '3 min' });
  await move(page, 'e2', 'e4');
  await exchange(page, 2);
  await expect(page.locator('.play-status strong')).toHaveText('Your move');
  expect(await savedGames(page)).toBe(1);
  await page.reload();
  await expect(page.locator('.rail')).toBeVisible();
  await exchange(page, 2);
  await expect(page.locator('.play-status strong')).toHaveText('Your move');
  expect(await savedGames(page)).toBe(1);
});

test('grab and drag records legal moves, not illegal drops', async ({
  page,
}) => {
  await open(page);
  await start(page);
  await drag(page, 'e2', 'e5');
  await expect(page.locator('.move-cell:not(.missing)')).toHaveCount(0);
  await drag(page, 'e2', 'e4');
  await exchange(page, 2);
  await expect(
    page.locator('.move-cell').filter({ hasText: 'e4' }),
  ).toBeVisible();
});

test('keyboard moves use the same legality and notation path', async ({
  page,
}) => {
  await open(page);
  await start(page);
  await page.locator('#square-e2').focus();
  await page.keyboard.press('f');
  await expect(page.locator('.cg-wrap')).toHaveClass(/orientation-black/);
  await expect(page.locator('#square-e2')).toBeFocused();
  await page.keyboard.press('f');
  await expect(page.locator('.cg-wrap')).toHaveClass(/orientation-white/);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await exchange(page, 2);
  await expect(
    page.locator('.move-cell').filter({ hasText: 'e4' }),
  ).toBeVisible();
});

test('promotion can cancel and then explicitly underpromote', async ({
  page,
}) => {
  await open(page);
  await start(page);
  await loadFen(page, '7k/P7/8/8/8/8/8/7K w - - 0 1');
  await move(page, 'a7', 'a8');
  await expect(page.getByRole('dialog')).toContainText('Choose your promotion');
  await page.keyboard.press('Escape');
  await expect(page.locator('#square-a7')).toHaveAttribute(
    'aria-label',
    'a7, white pawn',
  );
  await move(page, 'a7', 'a8');
  await page.getByRole('button', { name: 'Knight', exact: true }).click();
  await expect(page.locator('#square-a8')).toHaveAttribute(
    'aria-label',
    'a8, white knight',
  );
  await expect(
    page.locator('.move-cell').filter({ hasText: 'a8=N' }),
  ).toBeVisible();
});

test('new games support Chess960, black, custom clocks and en passant', async ({
  page,
}) => {
  await open(page);
  await start(page, {
    minutes: 5,
    increment: 3,
    side: 'Black',
    chess960: true,
    position: 42,
  });
  await expect(page.locator('.cg-wrap')).toHaveClass(/orientation-black/);
  // Black to move means the engine plays first on a real Chess960 start.
  await plies(page, 1);
  await expect(page.locator('.clock-summary')).toContainText('5 + 3');
  await loadFen(page, '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
  await move(page, 'e5', 'd6');
  await expect(page.locator('#square-d5')).toHaveAttribute(
    'aria-label',
    'd5, empty',
  );
});

test('history keeps the record, takeback is reversible, and resignation is recorded', async ({
  page,
}) => {
  await open(page);
  await start(page, { preset: '3 min' });
  await move(page, 'e2', 'e4');
  await exchange(page, 2);
  await page
    .getByRole('button', { name: 'Previous move', exact: true })
    .click();
  await expect(page.locator('.play-status strong')).toContainText(
    'Move 1 of 2',
  );
  await page
    .getByRole('button', { name: 'Latest position', exact: true })
    .click();
  await expect(page.locator('.play-status strong')).toHaveText('Your move');
  await page
    .getByRole('button', { name: 'Take back move', exact: true })
    .click();
  await expect(page.locator('.move-cell:not(.missing)')).toHaveCount(0);
  await move(page, 'd2', 'd4');
  await exchange(page, 2);
  await page.locator('.game-actions-menu summary').click();
  await page.getByRole('button', { name: 'Resign game', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Resign', exact: true })
    .click();
  await expect(page.locator('.play-status strong')).toHaveText('Resignation');
  await expect(page.locator('.play-status span')).toContainText(
    'Black wins · 0-1',
  );
  expect(await savedGames(page)).toBe(1);
});
