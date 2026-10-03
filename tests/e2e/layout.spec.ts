// Audit each screen at this viewport: nothing spills out of the frame, the
// primary action is in view, and every screen is captured as a visual record.
import { test, expect } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import {
  closePanel,
  exchange,
  homeGames,
  importGame,
  move,
  open,
  panel,
  plies,
  start,
  study,
} from './helpers';

/** The blunder game the review has something to say about. */
const BLUNDER_PGN =
  '[Event "Layout example"]\n[White "White"]\n[Black "Black"]\n[Result "0-1"]\n\n1. e4 e5 2. Qh5 Nc6 3. Qxf7+ Kxf7 *';

interface Spill {
  tag: string;
  cls: string;
  left: number;
  right: number;
  text: string;
}

/**
 * Anything painted past the left or right edge of the frame. Elements inside a
 * scroller are exempt — a carousel is allowed to hold content out of view — as
 * are the off-canvas skip link, closed dialogs, and clipped screen-reader text.
 */
async function spill(page: Page): Promise<Spill[]> {
  return page.evaluate(() => {
    const offenders: Spill[] = [];
    const width = window.innerWidth;
    // Anything that scrolls sideways is allowed to hold content out of view:
    // a carousel is not a spilled control.
    const scrollers = new Set<Element>();
    for (const candidate of document.querySelectorAll('body *')) {
      const style = getComputedStyle(candidate);
      if (
        (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
        candidate.scrollWidth > candidate.clientWidth + 1
      )
        scrollers.add(candidate);
    }
    for (const element of document.querySelectorAll('body *')) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (box.right <= width + 1 && box.left >= -1) continue;
      if (element.closest('[hidden], dialog:not([open]), .skip-link')) continue;
      let insideScroller = false;
      let parent: Element | null = element.parentElement;
      while (parent && parent !== document.body) {
        if (scrollers.has(parent)) {
          insideScroller = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (insideScroller) continue;
      offenders.push({
        tag: element.tagName.toLowerCase(),
        cls: typeof element.className === 'string' ? element.className : '',
        left: Math.round(box.left),
        right: Math.round(box.right),
        text: (element.textContent ?? '').trim().slice(0, 40),
      });
    }
    return offenders;
  });
}

/** Capture the screen, then report anything hanging off it. */
async function record(page: Page, testInfo: TestInfo): Promise<void> {
  const name = `${testInfo.project.name}`;
  await testInfo.attach(name, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  expect(await spill(page)).toEqual([]);
}

/** The named control is on screen, wholly inside the frame. */
async function inView(page: Page, selector: string): Promise<void> {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`${selector} is not on screen.`);
  const frame = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(frame.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(frame.height + 1);
}

test('Home: the picker and the action that starts a game both fit', async ({
  page,
}, testInfo) => {
  await open(page);
  await record(page, testInfo);
  // The one button that starts a game is always whole and on screen.
  await inView(page, '.start-button');
  await expect(page.locator('.start-button')).toBeEnabled();
  await inView(page, '.time-chip');
  // The saved games are one tap away, wherever this layout keeps them.
  await homeGames(page);
  await testInfo.attach(`${testInfo.project.name}-games`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  expect(await spill(page)).toEqual([]);
});

test('Play: the board, its controls and the rail all fit', async ({
  page,
}, testInfo) => {
  await open(page);
  await start(page, { preset: '3 min' });
  await move(page, 'e2', 'e4');
  await exchange(page, 2);
  await panel(page);
  await testInfo.attach(`${testInfo.project.name}-play-sheet`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  expect(await spill(page)).toEqual([]);
  // Close the sheet so the record shows the board's own chrome.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await record(page, testInfo);
  await inView(page, '.board-surface');
  await inView(page, '.rail');
});

test('Study: the analysis card and the review conversation fit', async ({
  page,
}, testInfo) => {
  await open(page);
  await importGame(page, BLUNDER_PGN);
  await plies(page, 6);
  await study(page, 'Review');
  await testInfo.attach(`${testInfo.project.name}-review`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  expect(await spill(page)).toEqual([]);
  await study(page, 'Analyze');
  await testInfo.attach(`${testInfo.project.name}-analyze`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  expect(await spill(page)).toEqual([]);
});

test('Dialogs: settings and the opponent editor fit', async ({
  page,
}, testInfo) => {
  await open(page);
  await page
    .getByRole('button', { name: 'Engine settings', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await testInfo.attach(`${testInfo.project.name}-settings`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  expect(await spill(page)).toEqual([]);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  // The games are one tap away; on a phone that tap is a sheet, and the picker
  // it covers has to come back before the bot editor can be opened from it.
  await homeGames(page);
  await closePanel(page);
  await page.getByRole('button', { name: 'Add bot' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await testInfo.attach(`${testInfo.project.name}-bot-editor`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  expect(await spill(page)).toEqual([]);
});
