// Exercise real IndexedDB corruption isolation, exact clock expiry, and failed WASM asset recovery.
import { test, expect } from '@playwright/test';
import {
  open,
  move,
  game,
  navigate,
  prefs,
  row,
  putRow,
  importGame,
} from './helpers';
import { object } from '../../src/lib/data/validation';
import { EXAMPLE_PGN } from '../../src/lib/domain/pgn';
test('restored clocks remain paused until resumed and then expire by elapsed time', async ({
  page,
}) => {
  await open(page);
  await move(page, 'e2', 'e4');
  await expect(page.locator('.move-cell.missing')).toHaveCount(0);
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await expect(
    page.getByText('Saved on this device', { exact: true }),
  ).toBeVisible();
  const saved = await game(page);
  saved.clock.whiteMs = 800;
  await putRow(page, 'games', saved);
  await page.reload();
  await expect(page.locator('.local-engine-badge')).toHaveText('Local engine');
  await expect(
    page.getByRole('heading', { name: 'Pick up where you left off.' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Resume game', exact: true })
    .first()
    .click();
  await expect(
    page.getByText('Black wins · 0-1', { exact: true }),
  ).toBeVisible();
  const expired = await game(page);
  expect(expired.moves).toHaveLength(2);
  expect(expired.clock.whiteMs).toBe(0);
  expect(expired.termination).toBe('Time expired');
});
test('invalid preferences do not hide or overwrite the existing archive', async ({
  page,
}) => {
  await open(page);
  await move(page, 'e2', 'e4');
  await expect(page.locator('.move-cell.missing')).toHaveCount(0);
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await expect(
    page.getByText('Saved on this device', { exact: true }),
  ).toBeVisible();
  const saved = await game(page);
  const settings = await prefs(page);
  settings.engine.hashMiB = 4096;
  await putRow(page, 'settings', { key: 'preferences', value: settings });
  await page.reload();
  await expect(page.locator('.local-engine-badge')).toHaveText('Local engine');
  await expect(page.locator('.storage-banner')).toContainText(
    'Saved settings were invalid',
  );
  await navigate(page, 'Library');
  await expect(page.locator('.saved-game')).toHaveCount(1);
  expect(await row(page, 'games', saved.id)).toMatchObject({ id: saved.id });
});
test('invalid cached review is rejected without erasing legal moves and can be recomputed', async ({
  page,
}) => {
  await open(page);
  await importGame(page, EXAMPLE_PGN);
  await page.getByLabel('Review search budget').selectOption('quick');
  await page
    .locator('.review-section')
    .getByRole('button', { name: 'Review', exact: true })
    .click();
  await expect(page.getByText('Review complete', { exact: true })).toBeVisible({
    timeout: 20000,
  });
  const saved = await game(page);
  const cache = object(await row(page, 'reviews', saved.id));
  if (!Array.isArray(cache.points)) throw new Error('Missing review');
  object(cache.points[0]).whiteCp = Number.NaN;
  await putRow(page, 'reviews', cache);
  await page.reload();
  await expect(page.locator('.move-cell:not(.missing)')).toHaveCount(7);
  await navigate(page, 'Review');
  await expect(page.locator('.review-section')).toContainText(
    'Saved review was rejected',
  );
  expect((await game(page)).moves).toHaveLength(7);
  await page.getByLabel('Review search budget').selectOption('quick');
  await page
    .locator('.review-section')
    .getByRole('button', { name: 'Review', exact: true })
    .click();
  await expect(page.getByText('Review complete', { exact: true })).toBeVisible({
    timeout: 20000,
  });
});
test('failed engine assets give an actionable error and restart recovers the real WASM', async ({
  page,
  context,
}) => {
  await context.route('**/engine/**/gwaymaegyi_wasm_bg.wasm', (route) =>
    route.abort(),
  );
  await page.goto('/');
  await expect(page.locator('.error-banner')).toContainText(
    'Engine needs attention',
  );
  await expect(page.getByTestId('chessboard')).toHaveClass(/read-only/);
  await context.unrouteAll();
  await page
    .getByRole('button', { name: 'Restart engine', exact: true })
    .click();
  await expect(page.locator('.local-engine-badge')).toHaveText('Local engine');
  await expect(page.locator('.error-banner')).toHaveCount(0);
  await move(page, 'e2', 'e4');
  await expect(page.locator('.move-row')).toHaveCount(1);
  await expect(page.locator('.move-cell.missing')).toHaveCount(0);
});
