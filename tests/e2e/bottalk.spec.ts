// Verify the opponent characters talk on the board: a greeting when the game
// starts, a reaction to a real move, silence in a two-player game, and no
// attribution anywhere. A remark belongs to the character that said it, so the
// review no longer lists quotes under a name.
import { test, expect } from '@playwright/test';
import {
  closePanel,
  open,
  start,
  study,
  go,
  move,
  plies,
  exchange,
} from './helpers';
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

test('the chosen character greets and reacts to a real mistake', async ({
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
  // Let the engine answer the opening, then walk into a real mistake — the
  // queen goes to f7 and the king takes it. Ordinary moves no longer earn a
  // remark, so only a real event can change the bubble.
  await page.waitForTimeout(2500);
  await move(page, 'e2', 'e4');
  await page.waitForTimeout(4000);
  await move(page, 'd1', 'h5');
  await page.waitForTimeout(4000);
  await move(page, 'h5', 'f7');
  await expect
    .poll(async () => (await bubble(page).innerText()).trim(), {
      timeout: 30000,
    })
    .not.toBe(greeting);
  expect(await bubble(page).innerText()).not.toMatch(/\{[a-z]+\}/);
});

test('study never credits a remark to a character', async ({ page }) => {
  await open(page);
  await pick(page, 'Nay Chi');
  await start(page, { preset: '3 min' });
  await expect(bubble(page)).toBeVisible();
  await move(page, 'e2', 'e4');
  await plies(page, 2);
  await move(page, 'd1', 'h5');
  await plies(page, 3);
  await exchange(page, 4);
  const said = (await bubble(page).innerText()).trim();
  await study(page, 'Analyze');
  // Study is the review's ground: the character's bubble is not on it at all,
  // and with no review stored there is nothing beside the board but the arrows.
  await closePanel(page);
  await expect(page.locator('.bot-bubble')).toHaveCount(0);
  await expect(page.locator('.study-remark')).toHaveCount(0);
  // The remarks list that ran under a name heading is gone from every tab.
  await expect(page.getByLabel('Opponent remarks')).toHaveCount(0);
  await expect(page.locator('.opponent-line')).toHaveCount(0);
  await expect(page.locator('.opponent-words')).toHaveCount(0);
  await expect(page.locator('.study-card')).not.toContainText(' said');
  // The line the character last said is still the one on the board, verbatim.
  await go(page, 'Play');
  await expect(bubble(page)).toHaveText(said);
  expect(said).not.toMatch(/\{[a-z]+\}/);
});

test('a two-player game has nobody talking', async ({ page }) => {
  await open(page);
  await start(page, { preset: '3 min', opponent: 'Two players' });
  await move(page, 'e2', 'e4');
  await move(page, 'e7', 'e5');
  await plies(page, 2);
  await expect(page.locator('.bot-bubble')).toHaveCount(0);
});
