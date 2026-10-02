// Verify the review chat answers from the engine and admits missing evidence.
import { test, expect } from '@playwright/test';
import { open, start, study, move, plies } from './helpers';

test('the chat answers about the position from the live engine line', async ({
  page,
}) => {
  await open(page);
  await start(page, { preset: '3 min' });
  await move(page, 'e2', 'e4');
  await plies(page, 2);
  await study(page, 'Analyze');
  const chat = page.getByRole('log', { name: 'Review chat', exact: true });
  await expect(chat).toBeVisible();
  await page
    .getByRole('button', { name: "What's the best move?", exact: true })
    .click();
  const answers = chat.locator('.coach-answer');
  await expect(answers).toHaveCount(2);
  // The answer has to name a real move and a real standing, or say it has none.
  await expect(answers.last()).not.toHaveText(
    /^Ask about this position or the game\.$/,
  );
  const text = (await answers.last().innerText()).trim();
  expect(text).toMatch(
    /is the move I would play|I have not worked out this position yet/,
  );
  expect(text).not.toMatch(/engine|centipawn|points|\bdepth\b/i);
});

test('a typed question is answered and the chat keeps the thread', async ({
  page,
}) => {
  await open(page);
  await start(page, { preset: '3 min' });
  await move(page, 'e2', 'e4');
  await plies(page, 2);
  await study(page, 'Analyze');
  await page.getByLabel('Ask about this position').fill('who is better here?');
  await page.getByRole('button', { name: 'Send question' }).click();
  const chat = page.getByRole('log', { name: 'Review chat', exact: true });
  await expect(chat.locator('.coach-you')).toHaveText('who is better here?');
  await expect(chat.locator('.coach-answer')).toHaveCount(2);
  await expect(chat.locator('.coach-answer').last()).toContainText(
    /is (a little |slightly |clearly )?(better|winning)|level|mating from here|worked out this position/,
  );
  await expect(chat.locator('.coach-answer').last()).not.toContainText(
    'centipawn',
  );
  // Asking again keeps the earlier exchange instead of replacing it.
  await page.getByLabel('Ask about this position').fill('what is the plan');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(chat.locator('.coach-you')).toHaveCount(2);
  await expect(chat.locator('.coach-answer')).toHaveCount(3);
});

test('the chat refuses to grade a game that was never reviewed', async ({
  page,
}) => {
  await open(page);
  await start(page, { preset: '3 min' });
  await move(page, 'e2', 'e4');
  await plies(page, 2);
  await study(page, 'Analyze');
  await page.getByLabel('Ask about this position').fill('where did i go wrong');
  await page.getByRole('button', { name: 'Send question' }).click();
  const chat = page.getByRole('log', { name: 'Review chat', exact: true });
  // Grading needs a stored review, and the chat says so instead of guessing.
  await expect(chat.locator('.coach-answer').last()).toContainText(
    /Run a review|no moves yet/,
  );
  await expect(chat.locator('.coach-answer').last()).not.toContainText(
    'centipawn',
  );
});
