// Verify the opponent characters talk on the board: a greeting when the game
// starts, a reaction to a real move, the conversation in study, and silence in
// a two-player game. The bubble never repeats the name the row already shows.
import { test, expect } from '@playwright/test';
import { open, start, study, move, plies, exchange } from './helpers';
import type { Page } from '@playwright/test';

function bubble(page: Page) {
  return page.locator('.bot-bubble');
}

/** Talk to one character by picking its card on Home. */
async function pick(page: Page, name: string): Promise<void> {
  await page
    .getByRole('group', { name: 'Bot', exact: true })
    .locator('.bot-card', { hasText: name })
    .locator('.bot-pick')
    .click();
}

test('the chosen character greets and talks as the game unfolds', async ({
  page,
}) => {
  await open(page);
  await pick(page, 'Kyaw Gyi');
  await start(page, { preset: '3 min' });
  // The greeting arrives as soon as the board does, without a name inside it:
  // the row above already says who is speaking.
  await expect(bubble(page)).toBeVisible();
  const greeting = (await bubble(page).innerText()).trim();
  expect(greeting.length).toBeGreaterThan(10);
  expect(greeting).not.toContain('Kyaw Gyi');
  // The row above the bubble still names the opponent.
  await expect(
    page.locator('.player-row').filter({ hasText: 'Kyaw Gyi' }),
  ).toHaveCount(1);
  // Play on, and the character says something new about a real move.
  await move(page, 'e2', 'e4');
  await plies(page, 2);
  await move(page, 'g1', 'f3');
  await plies(page, 3);
  await expect
    .poll(async () => (await bubble(page).innerText()).trim(), {
      timeout: 20000,
    })
    .not.toBe(greeting);
  expect(await bubble(page).innerText()).not.toMatch(/\{[a-z]+\}/);
});

test('the conversation is kept and can be read in study', async ({ page }) => {
  await open(page);
  await pick(page, 'Nay Chi');
  await start(page, { preset: '3 min' });
  await expect(bubble(page)).toBeVisible();
  await move(page, 'e2', 'e4');
  await plies(page, 2);
  await move(page, 'd1', 'h5');
  await plies(page, 3);
  await exchange(page, 4);
  // Whatever it said, study shows the remarks with the move they were about.
  await study(page, 'Analyze');
  const said = page.getByLabel('Opponent remarks');
  await expect(said).toBeVisible();
  await expect(said.getByRole('heading')).toHaveText('Nay Chi said');
  expect(await said.locator('.opponent-line').count()).toBeGreaterThan(0);
  await expect(said).toContainText('Start');
  expect(await said.innerText()).not.toMatch(/\{[a-z]+\}/);
});

test('a two-player game has nobody talking', async ({ page }) => {
  await open(page);
  await start(page, { preset: '3 min', opponent: 'Two players' });
  await move(page, 'e2', 'e4');
  await move(page, 'e7', 'e5');
  await plies(page, 2);
  await expect(page.locator('.bot-bubble')).toHaveCount(0);
});
