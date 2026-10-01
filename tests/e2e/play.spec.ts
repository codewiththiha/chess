// Verify engine play, tap/drag/keyboard input, clocks, and terminal recording in Chromium.
import { test, expect } from '@playwright/test';
import { open, move, drag, game, prefs, loadFen } from './helpers';
test('tap moves are answered by real WASM and restore paused after refresh', async ({
  page,
}) => {
  await open(page);
  await move(page, 'e2', 'e4');
  await expect(page.locator('.move-row')).toHaveCount(1);
  await expect(page.locator('.move-cell.missing')).toHaveCount(0);
  await expect(
    page.getByText('Saved on this device', { exact: true }),
  ).toBeVisible();
  const stored = await game(page);
  expect(stored.moves).toHaveLength(2);
  expect(stored.moves[0]?.uci).toBe('e2e4');
  expect(stored.moves[1]?.color).toBe('black');
  await page.reload();
  await expect(page.locator('.local-engine-badge')).toHaveText('Local engine');
  await expect(
    page.getByRole('heading', { name: 'Pick up where you left off.' }),
  ).toBeVisible();
  expect((await game(page)).moves.map((m) => m.uci)).toEqual(
    stored.moves.map((m) => m.uci),
  );
});
test('grab and drag records legal moves, not illegal drops', async ({
  page,
}) => {
  await open(page);
  await drag(page, 'e2', 'e5');
  await expect(page.locator('.move-row')).toHaveCount(0);
  await drag(page, 'e2', 'e4');
  await expect(page.locator('.move-row')).toHaveCount(1);
  await expect(page.locator('.move-cell.missing')).toHaveCount(0);
  expect((await game(page)).moves[0]?.san).toBe('e4');
});
test('keyboard moves use the same legality and notation path', async ({
  page,
}) => {
  await open(page);
  await page.keyboard.press('f');
  await expect(page.locator('.cg-wrap')).toHaveClass(/orientation-white/);
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
  await expect(page.locator('.move-row')).toHaveCount(1);
  await expect(page.locator('.move-cell.missing')).toHaveCount(0);
  expect((await game(page)).moves[0]?.uci).toBe('e2e4');
});
test('promotion can cancel and then explicitly underpromote', async ({
  page,
}) => {
  await open(page);
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
test('standard and king-already-on-target Chess960 castling work on the board', async ({
  page,
}) => {
  await open(page);
  await loadFen(page, 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  await move(page, 'e1', 'g1');
  await expect(page.locator('#square-f1')).toHaveAttribute(
    'aria-label',
    'f1, white rook',
  );
  await expect(page.locator('#square-g1')).toHaveAttribute(
    'aria-label',
    'g1, white king',
  );
  await loadFen(page, '4k3/8/8/8/8/8/8/6KR w H - 0 1', true);
  await move(page, 'g1', 'h1');
  await expect(page.locator('#square-f1')).toHaveAttribute(
    'aria-label',
    'f1, white rook',
  );
  await expect(page.locator('#square-g1')).toHaveAttribute(
    'aria-label',
    'g1, white king',
  );
});
test('new games support Chess960, black, custom clocks and en passant', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'New game', exact: true }).click();
  await page.getByRole('button', { name: 'Black', exact: true }).click();
  await page.getByLabel('Chess960', { exact: true }).check();
  await page.getByLabel('Position number (0–959)').fill('42');
  await page.getByLabel('Minutes', { exact: true }).fill('5');
  await page.getByLabel('Increment, seconds').fill('3');
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await expect(page.locator('.cg-wrap')).toHaveClass(/orientation-black/);
  await expect(page.locator('.move-row')).toHaveCount(1);
  await expect(
    page.getByText('Saved on this device', { exact: true }),
  ).toBeVisible();
  const saved = await game(page);
  expect(saved.chess960).toBe(true);
  expect(saved.human).toBe('black');
  expect(saved.clock.initialMs).toBe(300000);
  expect(saved.clock.incrementMs).toBe(3000);
  await loadFen(page, '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
  await move(page, 'e5', 'd6');
  await expect(page.locator('#square-d5')).toHaveAttribute(
    'aria-label',
    'd5, empty',
  );
});
test('history pauses play, takeback is reversible, and resignation is recorded', async ({
  page,
}) => {
  await open(page);
  await move(page, 'e2', 'e4');
  await expect(page.locator('.move-cell.missing')).toHaveCount(0);
  await expect(page.locator('.move-row')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Previous move', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'An earlier position.' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Latest position', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Take back move', exact: true })
    .click();
  await expect(page.locator('.move-row')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Resume game', exact: true })
    .first()
    .click();
  await move(page, 'd2', 'd4');
  await expect(page.locator('.move-row')).toHaveCount(1);
  await expect(page.locator('.move-cell.missing')).toHaveCount(0);
  await page.locator('.game-actions-menu summary').click();
  await page.getByRole('button', { name: 'Resign game', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Resign', exact: true })
    .click();
  await expect(
    page.getByText('Black wins · 0-1', { exact: true }),
  ).toBeVisible();
  expect((await game(page)).termination).toBe('Resignation');
  expect((await prefs(page)).lastGameId).toBeTruthy();
});
