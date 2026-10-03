// Verify the one-screen phone layout: no page scroll, the board always with its
// controls and the sentence about the move, and move data one tap away.
import { test, expect } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import {
  closePanel,
  exchange,
  move,
  open,
  panel,
  plies,
  start,
  study,
} from './helpers';

/** The one-screen layout is what phones get, so the desktop project opts out. */
function phoneOnly(testInfo: TestInfo): void {
  test.skip(
    testInfo.project.name !== 'mobile',
    'The one-screen layout is what phones get.',
  );
}

/** A control the reader must reach is wholly inside the screen. */
async function onScreen(page: Page, selector: string): Promise<void> {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`${selector} is not on screen.`);
  const height = await page.evaluate(() => window.innerHeight);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
}

/** The page never scrolls: the document is exactly one screen tall. */
async function fitsOneScreen(page: Page): Promise<void> {
  // Wait for the compact shell, so nothing is measured against the wide one.
  await expect
    .poll(() => page.evaluate(() => document.body.dataset.compact === 'true'))
    .toBe(true);
  const metrics = await page.evaluate(() => ({
    scrollY: window.scrollY,
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.innerHeight + 1);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
  expect(metrics.scrollY).toBe(0);
}

test('the picker may scroll, but Start never leaves the screen', async ({
  page,
}, testInfo) => {
  phoneOnly(testInfo);
  await open(page);
  // The picker is the one band allowed to scroll on this view, and the dock sits
  // outside it. Walk the picker to its end and back: Start must not move, and
  // nothing may paint over it — the earlier layout let a longer control column
  // push it out of sight behind the saved games.
  const startButton = page.locator('.start-button');
  await expect(startButton).toBeInViewport();
  const resting = await startButton.boundingBox();
  if (!resting) throw new Error('Start is not on screen.');
  const options = page.locator('.home-options');
  const depth = await options.evaluate((node) => node.scrollHeight);
  for (const step of [0.5, 1]) {
    await options.evaluate((node, ratio) => {
      node.scrollTop = (node.scrollHeight - node.clientHeight) * ratio;
    }, step);
    await expect(startButton).toBeInViewport();
    const moved = await startButton.boundingBox();
    if (!moved) throw new Error('Start left the screen with the picker.');
    expect(Math.abs(moved.y - resting.y)).toBeLessThanOrEqual(1);
  }
  expect(depth).toBeGreaterThanOrEqual(
    await options.evaluate((n) => n.clientHeight),
  );
  const rail = await page.locator('.rail').boundingBox();
  if (!rail) throw new Error('No rail.');
  expect(resting.y + resting.height).toBeLessThanOrEqual(rail.y + 1);
  expect(resting.height).toBeGreaterThanOrEqual(44);
  await fitsOneScreen(page);
});

test('Home, play and study each hold still on one screen', async ({
  page,
}, testInfo) => {
  phoneOnly(testInfo);
  await open(page);
  await fitsOneScreen(page);
  await start(page, { preset: '3 min' });
  await fitsOneScreen(page);
  // The whole board fits, with the players above and below it and the strip
  // and the rail in reach: nothing is clipped off the bottom of the screen.
  for (const selector of [
    '.player-row',
    '.board-surface',
    '.compact-bar',
    '.rail',
  ])
    await onScreen(page, selector);
  await move(page, 'e2', 'e4');
  await exchange(page, 2);
  await fitsOneScreen(page);
  await onScreen(page, '.board-surface');
  await study(page, 'Review');
  await fitsOneScreen(page);
});

test('the board never moves under the reader while the game runs', async ({
  page,
}, testInfo) => {
  phoneOnly(testInfo);
  await open(page);
  await start(page, { preset: '3 min' });
  await move(page, 'e2', 'e4');
  await exchange(page, 2);
  await closePanel(page);
  const before = await page.locator('.board-surface').boundingBox();
  // A second move brings a fresh line of talk in. The strip keeps its place, so
  // the board gives up nothing and nothing shifts under the reader.
  await move(page, 'd2', 'd4');
  await exchange(page, 4);
  await expect(page.locator('.bot-bubble')).toBeVisible();
  await closePanel(page);
  const after = await page.locator('.board-surface').boundingBox();
  if (!before || !after) throw new Error('The board is not on screen.');
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(1);
  // Opening and closing the sheet leaves the board where it was, too.
  await panel(page);
  await closePanel(page);
  const restored = await page.locator('.board-surface').boundingBox();
  if (!restored) throw new Error('The board left the screen.');
  expect(Math.abs(restored.y - after.y)).toBeLessThanOrEqual(1);
  await fitsOneScreen(page);
});

test('the move data and the game controls open from the kebab', async ({
  page,
}, testInfo) => {
  phoneOnly(testInfo);
  await open(page);
  await start(page, { preset: '3 min' });
  await move(page, 'e2', 'e4');
  await exchange(page, 2);
  // Nothing of the notes is on screen until the reader asks for it.
  await closePanel(page);
  await expect(page.locator('.move-cell')).toHaveCount(0);
  await panel(page);
  await expect(page.locator('.move-cell:not(.missing)')).toHaveCount(2);
  // The sheet carries the whole story: the notes, the clocks, the board actions.
  await expect(page.locator('.clock-summary')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Take back move', exact: true }),
  ).toBeVisible();
  await closePanel(page);
  await expect(page.locator('.move-cell')).toHaveCount(0);
  await expect(page.locator('.board-surface')).toBeVisible();
});

test('a finished game opens its move data by itself', async ({
  page,
}, testInfo) => {
  phoneOnly(testInfo);
  await open(page);
  await start(page, { preset: '3 min' });
  await move(page, 'e2', 'e4');
  await exchange(page, 2);
  await panel(page);
  await page.locator('.game-actions-menu summary').click();
  await page.getByRole('button', { name: 'Resign game', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Resign', exact: true })
    .click();
  // The result lands, and the record of the game comes up on its own.
  await expect(page.locator('.play-status strong')).toHaveText('Resignation');
  await expect(page.locator('dialog.sheet[open]')).toHaveCount(1);
  await expect(page.locator('.move-cell:not(.missing)')).toHaveCount(2);
  await fitsOneScreen(page);
});

test('the move list keeps five columns, so no move is clipped', async ({
  page,
}, testInfo) => {
  phoneOnly(testInfo);
  await open(page);
  await start(page, { preset: '3 min' });
  await move(page, 'e2', 'e4');
  await exchange(page, 2);
  await move(page, 'd2', 'd4');
  await exchange(page, 4);
  await move(page, 'g1', 'f3');
  await exchange(page, 6);
  await panel(page);
  const rows = page.locator('.move-row');
  await expect(rows).toHaveCount(3);
  for (const row of await rows.all()) {
    // Every row has five children — number, move, grade dot, move, grade dot —
    // and they all stay on the row's own line.
    await expect(row.locator('> *')).toHaveCount(5);
    const boxes = await row.evaluate((node) => ({
      row: node.getBoundingClientRect().toJSON(),
      cells: [...node.querySelectorAll('.move-cell')].map((cell) =>
        cell.getBoundingClientRect().toJSON(),
      ),
    }));
    expect(boxes.cells).toHaveLength(2);
    for (const cell of boxes.cells) {
      expect(cell.left).toBeGreaterThanOrEqual(boxes.row.left - 1);
      expect(cell.right).toBeLessThanOrEqual(boxes.row.right + 1);
      // A wrapped cell is the clipped pill this layout used to produce.
      expect(cell.height).toBeLessThanOrEqual(boxes.row.height);
      expect(cell.width).toBeGreaterThan(0);
    }
    expect(boxes.row.height).toBeLessThanOrEqual(48);
  }
});

test('review keeps the board, the ply control, and the sentence together', async ({
  page,
}, testInfo) => {
  phoneOnly(testInfo);
  await open(page);
  await start(page, { preset: '3 min' });
  await move(page, 'e2', 'e4');
  await exchange(page, 2);
  await move(page, 'd2', 'd4');
  await exchange(page, 4);
  await study(page, 'Review');
  await page.getByLabel('Review search budget').selectOption('quick');
  await page
    .locator('.study-card')
    .getByRole('button', { name: 'Review', exact: true })
    .click();
  await expect(page.locator('.review-progress')).toContainText('Reviewed', {
    timeout: 25000,
  });
  // The review said something about a real move: find which ply, and what.
  const moment = page.locator('.coach-moment[data-ply]').first();
  await expect(moment).toBeVisible();
  const sentence = ((await moment.textContent()) ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  // Tapping the moment takes the board to that move, and the sheet steps out of
  // the way so the reader sees it.
  await moment.click();
  await expect(page.locator('dialog.sheet[open]')).toHaveCount(0);
  await expect(page.locator('.ply-counter')).toContainText('/4');
  // The review's own line sits beside the board, word for word with the
  // remark the reader just tapped, and it is not the character's talk.
  const remark = page.locator('.study-remark');
  await expect(remark).toBeVisible();
  await expect(page.locator('.bot-bubble')).toHaveCount(0);
  const strip = ((await remark.textContent()) ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  expect(strip.length).toBeGreaterThan(20);
  expect(sentence).toContain(strip);
  await expect(page.locator('.board-surface')).toBeVisible();
  // All three sit inside the screen at once, and nothing scrolls to reach them.
  const board = await page.locator('.board-surface').boundingBox();
  const stripBox = await remark.boundingBox();
  const next = await page
    .getByRole('button', { name: 'Next move', exact: true })
    .boundingBox();
  if (!board || !stripBox || !next)
    throw new Error('The review strip is missing.');
  const height = await page.evaluate(() => window.innerHeight);
  for (const box of [board, stripBox, next]) {
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
  }
  // Stepping on keeps the board and the sentence in step, sheet unopened.
  await page.getByRole('button', { name: 'Next move', exact: true }).click();
  await expect(page.locator('.ply-counter')).toContainText(`/${4}`);
  await expect(page.locator('.board-surface')).toBeVisible();
  await expect(remark).toBeVisible();
  await plies(page, 4);
  await fitsOneScreen(page);
});

test('the review line holds its place from move to move', async ({
  page,
}, testInfo) => {
  phoneOnly(testInfo);
  await open(page);
  await start(page, { preset: '3 min' });
  await move(page, 'e2', 'e4');
  await exchange(page, 2);
  await move(page, 'd2', 'd4');
  await exchange(page, 4);
  await study(page, 'Review');
  await page.getByLabel('Review search budget').selectOption('quick');
  await page
    .locator('.study-card')
    .getByRole('button', { name: 'Review', exact: true })
    .click();
  await expect(page.locator('.review-progress')).toContainText('Reviewed', {
    timeout: 25000,
  });
  await closePanel(page);
  const remark = page.locator('.study-remark');
  await expect(remark).toBeVisible();
  // Walk the whole game: a ply the review has nothing about keeps the line the
  // reader was already on, so the sentence never disappears between moments.
  let previous = ((await remark.textContent()) ?? '').trim();
  expect(previous.length).toBeGreaterThan(0);
  for (let ply = 1; ply <= 4; ply += 1) {
    await page
      .getByRole('button', { name: 'Previous move', exact: true })
      .click();
    await expect(remark).toBeVisible();
    const text = ((await remark.textContent()) ?? '').trim();
    expect(text.length).toBeGreaterThan(0);
    if (text !== previous) expect(text.length).toBeGreaterThan(20);
    previous = text;
  }
  await expect(remark).toBeVisible();
  await expect(page.locator('.ply-counter')).toContainText('/4');
  await fitsOneScreen(page);
});

test('the play strip resigns without opening the sheet', async ({
  page,
}, testInfo) => {
  phoneOnly(testInfo);
  await open(page);
  await start(page, { preset: '3 min' });
  await move(page, 'e2', 'e4');
  await closePanel(page);
  // One tap on the strip, one confirmation, and the game is over and recorded.
  const quick = page.locator('[data-quick-resign]');
  await expect(quick).toHaveAttribute('aria-label', 'Resign this game');
  await quick.click();
  await expect(page.locator('dialog.sheet[open]')).toHaveCount(0);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Resign', exact: true })
    .click();
  await expect(page.locator('.compact-bar .play-status strong')).toHaveText(
    'Resignation',
  );
  await expect(page.locator('[data-quick-resign]')).toBeDisabled();
  await fitsOneScreen(page);
});

test('every opponent is on the phone screen at once', async ({
  page,
}, testInfo) => {
  phoneOnly(testInfo);
  await open(page);
  const picker = page.locator('.bot-picker');
  await expect(picker).toBeVisible();
  // The picker is a wrap, not a sideways scroll: nothing hides off to the side.
  const scroll = await picker.evaluate((node) => ({
    width: node.clientWidth,
    content: node.scrollWidth,
  }));
  expect(scroll.content).toBeLessThanOrEqual(scroll.width + 1);
  const screen = await page.evaluate(() => window.innerWidth);
  const cards = await page.locator('.bot-card').all();
  expect(cards.length).toBeGreaterThan(3);
  for (const card of cards) {
    const name = ((await card.innerText()) ?? 'card').split('\n')[0];
    const box = await card.boundingBox();
    if (!box) throw new Error(`${name} is not on screen.`);
    expect(box.x, name).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, name).toBeLessThanOrEqual(screen + 1);
    expect(box.width, name).toBeGreaterThan(80);
  }
  await fitsOneScreen(page);
});
