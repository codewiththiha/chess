// Verify engine play, tap/drag/keyboard input, clocks, and terminal recording in Chromium.
import { test, expect } from '@playwright/test';
import {
  closePanel,
  open,
  start,
  move,
  drag,
  exchange,
  plies,
  loadFen,
  panel,
  rail,
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
  await panel(page);
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
  await panel(page);
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
  await panel(page);
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
  await closePanel(page);
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
  await panel(page);
  await page
    .getByRole('button', { name: 'Take back move', exact: true })
    .click();
  await expect(page.locator('.move-cell:not(.missing)')).toHaveCount(0);
  await move(page, 'd2', 'd4');
  await exchange(page, 2);
  await panel(page);
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

test('the rail holds its last settled value while a search runs', async ({
  page,
}) => {
  await open(page);
  await start(page, { preset: '3 min' });
  const gauge = page.locator('.evaluation-rail');
  const fill = page.locator('.evaluation-white');
  // Once the engine has reported, a move must not blank the rail: the value of
  // the position just left stays up until the new one has been settled. The
  // bump this guards against was the rail dropping to its unknown half on every
  // move, then snapping to the real score once the search finished.
  await expect(gauge).not.toHaveClass(/unknown/, { timeout: 30000 });
  await move(page, 'e2', 'e4');
  for (let sample = 0; sample < 15; sample += 1) {
    await expect(gauge).not.toHaveClass(/unknown/);
    expect(await fill.getAttribute('style')).toMatch(/height:\s*[\d.]+%/);
    await page.waitForTimeout(100);
  }
});

test('a game that ends fills the rail for its winner and scores both sides', async ({
  page,
}, testInfo) => {
  await open(page);
  // Two players, so the short mate below is played by hand: the engine answers
  // nobody here, it only settles an evaluation for every position on screen.
  await start(page, { preset: '3 min', opponent: 'Two players' });
  const mate: [string, string][] = [
    ['f2', 'f3'],
    ['e7', 'e5'],
    ['g2', 'g4'],
    ['d8', 'h4'],
  ];
  for (const [from, to] of mate) {
    await move(page, from, to);
    // Accuracy reads settled evaluations only, so wait for each search to finish
    // instead of cancelling it with the next move.
    if (from !== 'd8') await page.waitForTimeout(2500);
  }
  // Black delivered the mate: the rail belongs to Black, to the very top.
  await expect(page.locator('.evaluation-rail')).toHaveAttribute(
    'title',
    /Black wins/,
  );
  await expect(page.locator('.evaluation-white')).toHaveAttribute(
    'style',
    /height:\s*0%/,
  );
  // A phone keeps the game card in its sheet; the desktop already shows it.
  await panel(page);
  const sides = page.locator('.accuracy-report .accuracy-side');
  await expect(sides).toHaveCount(2);
  const score = async (index: number) =>
    Number(
      (await sides.nth(index).locator('strong').innerText()).replace('%', ''),
    );
  // 2. g4 handed the game over, so Black kept more of its winning chances.
  expect(await score(0)).toBeLessThan(await score(1));
  await testInfo.attach(`${testInfo.project.name}-end-of-game`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  // And the same end of the same game in the dark theme: this block of tiles is
  // new, so both themes are worth a look while it is on screen.
  await rail(page, 'Board appearance');
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page
    .getByRole('button', { name: 'Save appearance', exact: true })
    .click();
  await panel(page);
  await testInfo.attach(`${testInfo.project.name}-end-of-game-dark`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});
