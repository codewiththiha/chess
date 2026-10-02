// Verify the bot library: shipped bots, a custom bot with a picture, and reload.
import { test, expect } from '@playwright/test';
import { exchange, go, move, open, savedGames, start } from './helpers';

/** A one-pixel PNG, the smallest picture a reader could actually pick. */
const PICTURE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

function picker(page: import('@playwright/test').Page) {
  return page.getByRole('group', { name: 'Bot', exact: true });
}

/** The card for one bot, so no locator matches the row and its edit button twice. */
function card(page: import('@playwright/test').Page, name: string) {
  return picker(page).locator('.bot-card', { hasText: name });
}

function row(page: import('@playwright/test').Page, name: string) {
  return page.locator('.player-row').filter({ hasText: name });
}

/** Open one saved game from the Home library through its own action button. */
async function openSaved(page: import('@playwright/test').Page, title: string) {
  await go(page, 'Home');
  await page.getByRole('button', { name: `Open ${title}` }).click();
  await expect(page.locator('.player-row')).toHaveCount(2);
}

test('the three characters are offered on Home and one starts a game', async ({
  page,
}) => {
  await open(page);
  await expect(picker(page).locator('.bot-card')).toHaveCount(4);
  await expect(
    card(page, 'Kyar Nyo').locator('.bot-strength-label'),
  ).toHaveText('1300 Elo · Human-like');
  await expect(
    card(page, 'Kyaw Gyi').locator('.bot-strength-label'),
  ).toHaveText('2500 Elo · Attacking');
  // Each card says how the character will talk to the reader.
  await expect(card(page, 'Kyar Nyo').locator('.bot-voice-label')).toHaveText(
    'Gentle',
  );
  await expect(card(page, 'Kyaw Gyi').locator('.bot-voice-label')).toHaveText(
    'Ruthless',
  );
  await card(page, 'Kyaw Gyi').locator('.bot-pick').click();
  await expect(card(page, 'Kyaw Gyi').locator('.bot-pick')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await start(page, { preset: '3 min' });
  // The character is the opponent identity, so the board names it with its Elo.
  await expect(row(page, 'Kyaw Gyi').locator('.player-meta')).toContainText(
    '2500 Elo',
  );
  // No picture was supplied, so no placeholder is drawn anywhere.
  await expect(page.locator('.player-pfp')).toHaveCount(0);
  await move(page, 'e2', 'e4');
  await exchange(page, 2);
  expect(await savedGames(page)).toBe(1);
});

test('a custom bot with a picture survives a reload and plays a game', async ({
  page,
}) => {
  await open(page);
  await picker(page).getByRole('button', { name: 'Add bot' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Rook Robot');
  await page.getByLabel('Description', { exact: true }).fill('Trades early.');
  await page.getByLabel('Bot picture').setInputFiles({
    name: 'face.png',
    mimeType: 'image/png',
    buffer: PICTURE,
  });
  await expect(page.locator('.bot-picture img')).toBeVisible();
  await page.getByLabel('Bot Elo').fill('900');
  await page.getByRole('button', { name: 'Ruthless', exact: true }).click();
  await page.getByRole('button', { name: 'Attacking', exact: true }).click();
  await page.getByRole('button', { name: 'Save bot', exact: true }).click();
  await expect(
    card(page, 'Rook Robot').locator('.bot-strength-label'),
  ).toHaveText('900 Elo · Attacking');
  await expect(card(page, 'Rook Robot').locator('img')).toBeVisible();
  await expect(card(page, 'Rook Robot').locator('.bot-voice-label')).toHaveText(
    'Ruthless',
  );

  // Bots are rows in the local database, not session state.
  await page.reload();
  await expect(page.locator('.home')).toBeVisible();
  await expect(card(page, 'Rook Robot').locator('img')).toBeVisible();

  await start(page, { preset: '3 min' });
  await expect(row(page, 'Rook Robot').locator('.player-pfp')).toBeVisible();
  await expect(row(page, 'Rook Robot').locator('.player-meta')).toContainText(
    '900 Elo',
  );
  await move(page, 'e2', 'e4');
  await exchange(page, 2);
  await go(page, 'Home');
  await expect(page.locator('.saved-game').first()).toContainText('Rook Robot');
  await openSaved(page, 'You vs Rook Robot');
  await expect(row(page, 'Rook Robot').locator('.player-meta')).toContainText(
    '900 Elo',
  );
});

test('a bot can be edited and deleted, and the game keeps its Elo', async ({
  page,
}) => {
  await open(page);
  await picker(page).getByRole('button', { name: 'Add bot' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Temp Bot');
  await page.getByLabel('Bot Elo').fill('2100');
  await page.getByRole('button', { name: 'Save bot', exact: true }).click();
  await start(page, { preset: '3 min' });
  await expect(row(page, 'Temp Bot').locator('.player-meta')).toContainText(
    '2100 Elo',
  );
  await move(page, 'e2', 'e4');
  await exchange(page, 2);
  await go(page, 'Home');
  await page.getByRole('button', { name: 'Edit Temp Bot' }).click();
  await page.getByLabel('Bot Elo').fill('2500');
  await page.getByRole('button', { name: 'Save bot', exact: true }).click();
  await expect(
    card(page, 'Temp Bot').locator('.bot-strength-label'),
  ).toHaveText('2500 Elo · Balanced');
  // Deleting the bot must not damage the game that was played against it.
  await page.getByRole('button', { name: 'Edit Temp Bot' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(card(page, 'Temp Bot')).toHaveCount(0);
  await openSaved(page, 'You vs Temp Bot');
  await expect(row(page, 'Temp Bot').locator('.player-meta')).toContainText(
    '2100 Elo',
  );
});
