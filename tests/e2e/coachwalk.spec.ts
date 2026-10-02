// Verify the review reads as a coach talking: a walkthrough in the character's
// voice, remarks tied to the move they are about, and a verdict mark on the
// piece that moved — with no quote attributed to anyone anywhere.
import { test, expect } from '@playwright/test';
import { open, go, importGame, study, plies } from './helpers';
import type { Page } from '@playwright/test';

/** A real game where White really does throw the queen away on f7. */
const BLUNDER_PGN =
  '[Event "Coach example"]\n[White "White"]\n[Black "Black"]\n[Result "0-1"]\n\n1. e4 e5 2. Qh5 Nc6 3. Qxf7+ Kxf7 *';

async function reviewed(page: Page): Promise<void> {
  await open(page);
  await importGame(page, BLUNDER_PGN);
  await plies(page, 6);
  await study(page, 'Review');
  await page.getByLabel('Review search budget').selectOption('quick');
  await page
    .locator('.study-card')
    .getByRole('button', { name: 'Review', exact: true })
    .click();
  await expect(page.locator('.review-progress')).toContainText('Reviewed', {
    timeout: 25000,
  });
}

test('the review is a conversation with the coach, not a list of quotes', async ({
  page,
}) => {
  await reviewed(page);
  const chat = page.getByRole('log', { name: 'Review chat', exact: true });
  const answers = chat.locator('.coach-answer');
  // The walkthrough opens by reading the game back, then takes the moments.
  await expect(answers.first()).toContainText(/moves/);
  await expect(answers.first()).toContainText('6');
  expect(await answers.count()).toBeGreaterThan(1);
  // Every moment bubble carries the move it is about, one tap away.
  const moments = chat.locator('.coach-answer').filter({
    has: page.locator('.coach-jump'),
  });
  expect(await moments.count()).toBeGreaterThan(1);
  const about = moments.filter({ hasText: 'Qxf7+' });
  await expect(about).toHaveCount(1);
  const text = (await about.innerText()).trim();
  // It says what the move cost and what was better, in plain words.
  expect(text).toMatch(/blunder|mistake|concession|loose/);
  expect(text).toMatch(/was the move/);
  // It names the real consequence the board shows: the queen is en prise.
  expect(text).toContain('straight to the king');
  expect(text).not.toMatch(/[{}]/);
  // Nothing here asks a reader to weigh a number or know what an engine is.
  expect(text).not.toMatch(
    /engine|centipawn|\bdepth\b|\bcp\b|points?\b|principal variation/i,
  );
  // Nothing in the panel credits a quote to a character any more.
  await expect(page.getByLabel('Opponent remarks')).toHaveCount(0);
  await expect(page.locator('.opponent-line')).toHaveCount(0);
  await expect(page.locator('.coach-log')).not.toContainText(' said');
});

test('a remark is one tap from the move it talks about', async ({ page }) => {
  await reviewed(page);
  const chat = page.getByRole('log', { name: 'Review chat', exact: true });
  const about = chat.locator('.coach-moment').filter({ hasText: 'Qxf7+' });
  await expect(about).toHaveCount(1);
  // Anywhere in the bubble works, not just the pill: click the remark's own
  // text, at its bottom-right, and the board should follow it.
  const box = await about.boundingBox();
  if (!box) throw new Error('The remark is not on screen.');
  await page.mouse.click(box.x + box.width - 12, box.y + box.height - 8);
  // The board follows the remark to the move, and the notes count it.
  await expect(page.locator('.notation-caption')).toContainText('5 / 6');
  const badge = page.locator('.move-badge');
  await expect(badge).toHaveCount(1);
  await expect(badge).toHaveAttribute('data-square', 'f7');
  await expect(badge).toHaveAttribute('data-grade', 'blunder');
  await expect(badge).toHaveAttribute('data-tone', 'error');
  await expect(badge).toHaveAttribute('title', 'Blunder');
});

test('the mark sits on the top-right corner of the square that moved', async ({
  page,
}) => {
  await reviewed(page);
  const chat = page.getByRole('log', { name: 'Review chat', exact: true });
  await chat
    .locator('.coach-answer', { hasText: 'Qxf7' })
    .locator('.coach-jump')
    .click();
  const badge = page.locator('.move-badge');
  await expect(badge).toBeVisible();
  const square = page.locator('#square-f7');
  const box = await square.boundingBox();
  const mark = await badge.boundingBox();
  if (!box || !mark)
    throw new Error('The board square or the mark is missing.');
  const centreX = box.x + box.width / 2;
  const centreY = box.y + box.height / 2;
  expect(mark.x + mark.width / 2).toBeGreaterThan(centreX);
  expect(mark.y + mark.height / 2).toBeLessThan(centreY);
  // It stays inside the board rather than hanging off the edge.
  const board = await page.locator('.board-surface').boundingBox();
  if (!board) throw new Error('No board surface.');
  expect(mark.x).toBeGreaterThanOrEqual(board.x);
  expect(mark.y).toBeGreaterThanOrEqual(board.y);
  // The colour follows the grade, using the theme's own semantic colours.
  const grade = await badge.getAttribute('data-grade');
  const tone = await badge.getAttribute('data-tone');
  const expected =
    grade === 'best' || grade === 'good'
      ? 'success'
      : grade === 'inaccuracy'
        ? 'warning'
        : 'error';
  expect(tone).toBe(expected);
});

test('the mark can be switched off with the other board aids', async ({
  page,
}) => {
  await reviewed(page);
  const chat = page.getByRole('log', { name: 'Review chat', exact: true });
  await chat
    .locator('.coach-answer', { hasText: 'Qxf7' })
    .locator('.coach-jump')
    .click();
  await expect(page.locator('.move-badge')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Board appearance', exact: true })
    .click();
  await page.getByLabel('Move feedback', { exact: true }).uncheck();
  await page
    .getByRole('button', { name: 'Save appearance', exact: true })
    .click();
  await expect(page.locator('.move-badge')).toHaveCount(0);
  // The switch is remembered for the next game too.
  await page.reload();
  await expect(page.locator('.rail')).toBeVisible();
  await go(page, 'Play');
  await expect(page.locator('.move-badge')).toHaveCount(0);
});

test('an ordinary question is still answered in the same thread', async ({
  page,
}) => {
  await reviewed(page);
  const chat = page.getByRole('log', { name: 'Review chat', exact: true });
  const before = await chat.locator('.coach-answer').count();
  // Stand on the blunder the walkthrough named, then ask about it.
  await chat.getByRole('button', { name: 'Go to move 3.' }).click();
  await page.getByLabel('Ask about this position').fill('where did i go wrong');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(chat.locator('.coach-you')).toHaveCount(1);
  await expect(chat.locator('.coach-answer')).toHaveCount(before + 1);
  // The answer is about the move on screen, and cites its stored grade.
  await expect(chat.locator('.coach-answer').last()).toContainText(
    'where it went wrong',
  );
  await expect(chat.locator('.coach-answer').last()).toContainText('Qxf7+');
  await expect(chat.locator('.coach-answer').last()).not.toContainText(
    'centipawn',
  );
});

test('the walkthrough follows the reader ply by ply', async ({ page }) => {
  await reviewed(page);
  const chat = page.getByRole('log', { name: 'Review chat', exact: true });
  const about = chat.locator('.coach-moment').filter({ hasText: 'Qxf7+' });
  await expect(about).toHaveCount(1);
  // The remark knows which ply it is about; that is what lights it up.
  await expect(about).toHaveAttribute('data-ply', '5');
  // Standing elsewhere in the game leaves the conversation unmarked.
  await page.locator('.move-cell[data-ply="6"]').click();
  await expect(chat.locator('.coach-current')).toHaveCount(0);
  // Step onto the move the remark is about: exactly that remark is marked and
  // brought into view, so the reader never has to hunt for it.
  await page.locator('.move-cell[data-ply="5"]').click();
  await expect(chat.locator('.coach-current')).toHaveCount(1);
  await expect(about).toHaveClass(/coach-current/);
  await expect(about).toHaveAttribute('aria-current', 'true');
  await expect(about).toBeInViewport();
  // Stepping on clears it again: one remark at a time, following the board.
  await page.locator('.move-cell[data-ply="4"]').click();
  await expect(chat.locator('.coach-current')).toHaveCount(0);
});
