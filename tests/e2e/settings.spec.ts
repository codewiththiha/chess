// Exercise dynamic controls, browser backends, appearance persistence, and live limit updates.
import { test, expect } from '@playwright/test';
import {
  closePanel,
  exchange,
  move,
  open,
  panel,
  plies,
  rail,
  start,
  study,
} from './helpers';

test('all discovered behaviors and parameters are editable and persisted', async ({
  page,
}) => {
  await open(page);
  await rail(page, 'Engine settings');
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
  await page.reload();
  await expect(page.locator('.rail')).toBeVisible();
  await rail(page, 'Engine settings');
  await page.getByRole('tab', { name: 'Advanced', exact: true }).click();
  await expect(page.getByLabel('AspStartWindow', { exact: true })).toHaveValue(
    '30',
  );
  await expect(
    page.getByLabel('Null-move pruning', { exact: true }),
  ).not.toBeChecked();
});

test('portable backend and nominal Elo/seed still configure the real engine', async ({
  page,
}) => {
  await open(page);
  await rail(page, 'Engine settings');
  await page
    .getByLabel('Personality', { exact: true })
    .selectOption('human-like');
  // Strength is Elo-only now: drag the target down and check the round trip.
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
  await page.reload();
  await expect(page.locator('.rail')).toBeVisible();
  await rail(page, 'Engine settings');
  await expect(page.getByLabel('WASM backend', { exact: true })).toHaveValue(
    'portable',
  );
  await expect(page.getByLabel('Random seed', { exact: true })).toHaveValue(
    '18446744073709551615',
  );
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  // A real reply from the portable binary proves the chosen backend runs.
  await start(page, { preset: '3 min' });
  await move(page, 'e2', 'e4');
  await exchange(page, 2);
});

test('invalid ranges remain staged and do not overwrite saved settings', async ({
  page,
}) => {
  await open(page);
  await rail(page, 'Engine settings');
  await page.getByLabel('Hash memory, MiB', { exact: true }).fill('65');
  await page
    .getByRole('button', { name: 'Save settings', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    'Hash must be an integer from 1 to 64.',
  );
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await rail(page, 'Engine settings');
  // Hash lives on the default Engine tab; the rejected value must not have landed.
  await expect(
    page.getByLabel('Hash memory, MiB', { exact: true }),
  ).toHaveValue('8');
});

test('board/pieces/theme and all motion/aids persist without external downloads', async ({
  page,
}) => {
  await open(page);
  await rail(page, 'Board appearance');
  await page.getByRole('button', { name: 'Walnut', exact: true }).click();
  await page.getByRole('button', { name: /Classic Colin/ }).click();
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.getByLabel('Piece animations', { exact: true }).uncheck();
  await page.getByLabel('Board coordinates', { exact: true }).uncheck();
  await page
    .getByRole('button', { name: 'Save appearance', exact: true })
    .click();
  await start(page, { preset: '3 min' });
  await expect(page.getByTestId('chessboard')).toHaveClass(
    /board-walnut pieces-cburnett/,
  );
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    'chess-dark',
  );
  await expect(page.locator('.cg-wrap coords')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.rail')).toBeVisible();
  await start(page, { preset: '3 min' });
  await expect(page.getByTestId('chessboard')).toHaveClass(
    /board-walnut pieces-cburnett/,
  );
  await expect(page.locator('.cg-wrap coords')).toHaveCount(0);
});

test('live performance changes and cancellation do not produce stale analysis moves', async ({
  page,
}) => {
  await open(page);
  await start(page, { preset: '3 min' });
  await study(page, 'Analyze');
  await rail(page, 'Engine settings');
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
  // The dialog closes once the engine has actually taken the new limits, which
  // can take longer than a default wait while a no-deadline search is stopping.
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 30000 });
  await panel(page);
  await expect(
    page.locator('.study-card').getByRole('button', { name: 'Stop' }),
  ).toBeVisible();
  await rail(page, 'Engine settings');
  await page.getByRole('tab', { name: 'Performance', exact: true }).click();
  await page.getByLabel('Maximum depth', { exact: true }).fill('2');
  await page.getByLabel('Maximum nodes', { exact: true }).fill('1000');
  await page
    .getByRole('button', { name: 'Save settings', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 30000 });
  // Analysis runs continuously in study, so the card shows live status instead.
  await panel(page);
  await expect(page.locator('.analysis-summary')).toBeVisible();
  await move(page, 'e2', 'e4');
  await panel(page);
  await expect(
    page.locator('.move-cell').filter({ hasText: 'e4' }),
  ).toBeVisible();
  // The engine answers in study too now, so wait for the reply before stepping
  // back; a clean two-ply record is the proof that the limited settings produced
  // one real answer and no stale line.
  await plies(page, 2);
  await expect(page.locator('.move-cell.missing')).toHaveCount(0);
  // The ply controls sit on the board, so the sheet steps aside for them.
  await closePanel(page);
  await page
    .getByRole('button', { name: 'First position', exact: true })
    .click();
  await expect(page.locator('#square-e2')).toHaveAttribute(
    'aria-label',
    'e2, white pawn',
  );
});

test('a bot on the board plays to its own card, so the strength controls rest', async ({
  page,
}) => {
  await open(page);
  // Home picks the opponent first: the default is a shipped character, whose
  // style and strength are the bot's own and not this dialog's to change.
  await expect(
    page.getByRole('group', { name: 'Bot', exact: true }),
  ).toBeVisible();
  await rail(page, 'Engine settings');
  await expect(page.locator('#engine-elo')).toBeDisabled();
  await expect(page.getByLabel('Personality', { exact: true })).toBeDisabled();
  await expect(
    page.getByLabel('Full strength', { exact: true }),
  ).toBeDisabled();
  await expect(page.locator('.settings-content')).toContainText(
    'plays with the style and strength on their own card',
  );
  // A dead control is worse than a disabled one, so nothing here silently
  // pretends to apply: the settings still save.
  await page
    .getByRole('button', { name: 'Save settings', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 30000 });
  // Two players means no bot: the engine's own target is the reader's to set.
  await page.getByRole('button', { name: 'Two players', exact: true }).click();
  await rail(page, 'Engine settings');
  await expect(page.locator('#engine-elo')).toBeEnabled();
  await expect(page.getByLabel('Personality', { exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a game against a character reports whose card governs it', async ({
  page,
}) => {
  await open(page);
  await start(page, { preset: '3 min' });
  await move(page, 'e2', 'e4');
  await closePanel(page);
  await rail(page, 'Engine settings');
  await expect(page.locator('#engine-elo')).toBeDisabled();
  await expect(page.locator('.settings-content')).toContainText(
    'plays with the style and strength on their own card',
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
