// Audit real rendered states, reduced motion, device widths, and same-origin asset loading.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { open, start, go, study, move, exchange } from './helpers';

test('all runtime assets are local and the initial screen has no serious accessibility violations', async ({
  page,
}) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
  expect(
    requests.filter(
      (u) => /^https?:/.test(u) && new URL(u).hostname !== '127.0.0.1',
    ),
  ).toEqual([]);
  expect(errors).toEqual([]);
});

test('the desktop shell fits the viewport without page scrolling', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop',
    'Narrow screens scroll by design.',
  );
  await open(page);
  const scrolls = () =>
    page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight + 1,
    );
  expect(await scrolls()).toBe(false);
  await page
    .getByRole('button', { name: 'Board appearance', exact: true })
    .click();
  // Dialogs mount after the stored preferences land, so wait for the modal
  // before driving it with the keyboard.
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await start(page, { preset: '3 min' });
  await move(page, 'e2', 'e4');
  await exchange(page, 2);
  expect(await scrolls()).toBe(false);
  await study(page, 'Review');
  expect(await scrolls()).toBe(false);
  await go(page, 'Home');
  expect(await scrolls()).toBe(false);
});

test('settings and appearance dialogs preserve keyboard focus and accessible labels', async ({
  page,
}) => {
  await open(page);
  const trigger = page.getByRole('button', {
    name: 'Engine settings',
    exact: true,
  });
  await trigger.click();
  await page.getByRole('tab', { name: 'Advanced', exact: true }).click();
  let results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await page
    .getByRole('button', { name: 'Board appearance', exact: true })
    .click();
  results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('320px layouts and reduced-motion preferences retain all functional controls', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(320);
  await page
    .getByRole('button', { name: 'Board appearance', exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(320);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Start', exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(320);
  await start(page, { preset: '3 min' });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(320);
  await expect(
    page.getByRole('button', { name: 'Take back move', exact: true }),
  ).toBeVisible();
});

test('dark Home, play, study and review remain accessible', async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole('button', { name: 'Board appearance', exact: true })
    .click();
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page
    .getByRole('button', { name: 'Save appearance', exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    'chess-dark',
  );
  for (const view of ['Home', 'Play'] as const) {
    await go(page, view);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  }
  await start(page, { preset: '3 min' });
  await move(page, 'e2', 'e4');
  await exchange(page, 2);
  for (const tab of ['Analyze', 'Review'] as const) {
    await study(page, tab);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  }
});
