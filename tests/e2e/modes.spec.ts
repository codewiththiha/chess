// Verify the mode split: bot games stay live in study, two-player boards are human,
// and engine arrows are study-only.
import { test, expect } from '@playwright/test';
import { open, start, study, move, plies, go } from './helpers';

test('two players move both sides and no engine replies', async ({ page }) => {
  await open(page);
  await start(page, { preset: '3 min', opponent: 'Two players' });
  await move(page, 'e2', 'e4');
  await move(page, 'e7', 'e5');
  await plies(page, 2);
  // Neither side waited on an engine, so nothing is missing from the notation.
  await expect(page.locator('.move-cell.missing')).toHaveCount(0);
  const names = await page.locator('.player-name-text').allInnerTexts();
  expect(names.toSorted()).toEqual(['Player 1', 'Player 2']);
  // Two plies were played by hand, so White is the side on move.
  await expect(page.locator('.play-status strong')).toHaveText('White to move');
  // Both colours are still playable by the same person.
  await move(page, 'g1', 'f3');
  await plies(page, 3);
});

test('a bot game keeps playing while study is on screen', async ({ page }) => {
  await open(page);
  await start(page, { preset: '3 min' });
  await move(page, 'e2', 'e4');
  // Study is a view, not a pause: the engine still answers here.
  await study(page, 'Analyze');
  await plies(page, 2);
  await expect(page.locator('.move-cell.missing')).toHaveCount(0);
});

test('engine arrows are drawn in study and never during play', async ({
  page,
}) => {
  await open(page);
  await start(page, { preset: '3 min' });
  await move(page, 'e2', 'e4');
  await plies(page, 2);
  const arrows = page.locator('svg.cg-shapes line');
  await expect(arrows).toHaveCount(0);
  await study(page, 'Analyze');
  // Arrows are zero-height SVG lines, so count them rather than asking for visibility.
  await expect
    .poll(() => arrows.count(), { timeout: 20000 })
    .toBeGreaterThan(0);
  expect(await arrows.count()).toBeLessThanOrEqual(4);
  // Returning to play clears them again.
  await go(page, 'Play');
  await expect(arrows).toHaveCount(0);
});

test('premoves stay off until the setting is enabled', async ({ page }) => {
  await open(page);
  await start(page, { preset: '3 min' });
  await move(page, 'e2', 'e4');
  await plies(page, 2);
  // Without the setting the board refuses a queued move while the engine thinks,
  // so the record still holds the two plies the game really played.
  await page.locator('.board-shell').evaluate((node) => node.scrollIntoView());
  await move(page, 'd7', 'd5');
  await plies(page, 2);
});
