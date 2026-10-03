// Reuse actual pointer/touch paths and the real rail/Home shell for browser checks.
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export interface StartOptions {
  preset?: string;
  minutes?: number;
  increment?: number;
  side?: 'White' | 'Black' | 'Any';
  opponent?: 'Play a bot' | 'Two players';
  chess960?: boolean;
  position?: number;
}

export async function open(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.rail')).toBeVisible();
  await expect(page.locator('.home')).toBeVisible();
  // A storage banner here would mean the app fell back to session-only data.
  await expect(page.locator('.storage-banner')).toHaveCount(0);
}

export async function go(
  page: Page,
  view: 'Home' | 'Play' | 'Study',
): Promise<void> {
  // The sheet is modal, so it stands between the reader and the rail.
  await closePanel(page);
  await page
    .getByRole('navigation', { name: 'Main navigation', exact: true })
    .getByRole('button', { name: view, exact: true })
    .click();
}

/** The compact layout keeps move data and study in a bottom sheet. */
export async function panel(page: Page): Promise<void> {
  const toggle = page.locator('[data-sheet-toggle="panel"]');
  // The desktop shell has no sheet, so this is a no-op there.
  if (!(await page.locator('body[data-compact]').count())) return;
  // A reload can still be on the landing view while the stored game loads, and
  // the game shell is what carries the button.
  await expect(toggle).toBeAttached({ timeout: 15000 });
  if (await page.locator('dialog.sheet[open]').count()) return;
  await toggle.click();
  await expect(page.locator('dialog.sheet[open]')).toHaveCount(1);
}

/** Home with its saved games in reach: on a phone they open in a sheet. */
export async function homeGames(page: Page): Promise<void> {
  await go(page, 'Home');
  const toggle = page.locator('[data-games-toggle]');
  if (!(await page.locator('body[data-compact]').count())) return;
  if (await page.locator('dialog.sheet[open]').count()) return;
  await toggle.click();
  await expect(page.locator('dialog.sheet[open]')).toHaveCount(1);
}

/** A rail button: the sheet is modal, so it stands aside first. */
export async function rail(page: Page, name: string): Promise<void> {
  await closePanel(page);
  await page.getByRole('button', { name, exact: true }).click();
}

export async function closePanel(page: Page): Promise<void> {
  const sheet = page.locator('dialog.sheet[open]');
  if (!(await sheet.count())) return;
  await sheet.getByRole('button', { name: /^Close/ }).click();
  await expect(page.locator('dialog.sheet[open]')).toHaveCount(0);
}

export async function study(
  page: Page,
  tab: 'Analyze' | 'Review',
): Promise<void> {
  await go(page, 'Study');
  // On compact the tabs are in the sheet, so the sheet stays open afterwards:
  // whoever needs the board next closes it through tap() below.
  await panel(page);
  await page.getByRole('tab', { name: tab, exact: true }).click();
}

/** Choose a time control on Home and wait for the interactive board. */
export async function start(
  page: Page,
  options: StartOptions = {},
): Promise<void> {
  // Time controls live on Home, so always start from the landing view.
  await go(page, 'Home');
  if (options.preset)
    await page
      .locator('.time-chip')
      .filter({ hasText: options.preset })
      .first()
      .click();
  if (options.minutes !== undefined || options.increment !== undefined) {
    await page.locator('.time-chip').filter({ hasText: 'Custom' }).click();
    await page
      .getByLabel('Custom minutes', { exact: true })
      .fill(String(options.minutes ?? 10));
    await page
      .getByLabel('Custom increment seconds', { exact: true })
      .fill(String(options.increment ?? 0));
  }
  if (options.opponent)
    await page
      .getByRole('group', { name: 'Opponent' })
      .getByRole('button', { name: options.opponent, exact: true })
      .click();
  if (options.side)
    await page
      .getByRole('group', { name: 'Your side' })
      .getByRole('button', { name: options.side, exact: true })
      .click();
  if (options.chess960) {
    await page.getByLabel('Chess960', { exact: true }).check();
    if (options.position !== undefined)
      await page
        .getByLabel('Chess960 start position', { exact: true })
        .fill(String(options.position));
  }
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('.board-shell')).toHaveAttribute(
    'aria-busy',
    'false',
    { timeout: 20000 },
  );
}

export async function squarePoint(
  page: Page,
  key: string,
): Promise<{ x: number; y: number }> {
  // Moving on the board means looking at the board, not through the sheet.
  await closePanel(page);
  const board = page.locator('cg-board');
  await board.scrollIntoViewIfNeeded();
  if ((page.viewportSize()?.width ?? 1440) <= 999)
    await board.evaluate((e) =>
      e.scrollIntoView({ block: 'center', behavior: 'instant' }),
    );
  const box = await board.boundingBox();
  if (!box) throw new Error('Board not visible');
  const black = await page
    .locator('.cg-wrap')
    .evaluate((e) => e.classList.contains('orientation-black'));
  const file = key.charCodeAt(0) - 97,
    rank = Number(key[1]) - 1;
  return {
    x: box.x + (((black ? 7 - file : file) + 0.5) * box.width) / 8,
    y: box.y + (((black ? rank : 7 - rank) + 0.5) * box.height) / 8,
  };
}

export async function tap(page: Page, key: string): Promise<void> {
  const p = await squarePoint(page, key);
  if ((page.viewportSize()?.width ?? 1440) <= 999)
    await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}

export async function move(
  page: Page,
  from: string,
  to: string,
): Promise<void> {
  await tap(page, from);
  await tap(page, to);
}

export async function drag(
  page: Page,
  from: string,
  to: string,
): Promise<void> {
  const fromPoint = await squarePoint(page, from);
  const toPoint = await squarePoint(page, to);
  if ((page.viewportSize()?.width ?? 1440) <= 999) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [fromPoint],
    });
    for (let i = 1; i <= 8; i++)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: fromPoint.x + ((toPoint.x - fromPoint.x) * i) / 8,
            y: fromPoint.y + ((toPoint.y - fromPoint.y) * i) / 8,
          },
        ],
      });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await cdp.detach();
  } else {
    await page.mouse.move(fromPoint.x, fromPoint.y);
    await page.mouse.down();
    await page.mouse.move(toPoint.x, toPoint.y, { steps: 10 });
    await page.mouse.up();
  }
}

/** Wait for exactly `count` recorded plies in the notes. On a phone the notes
 * live in the sheet, so bring it up first; the sheet stays open afterwards until
 * a move or a navigation closes it. */
export async function plies(page: Page, count: number): Promise<void> {
  if (await page.evaluate(() => document.body.dataset.compact === 'true'))
    await panel(page);
  await expect(page.locator('.move-cell:not(.missing)')).toHaveCount(count, {
    timeout: 20000,
  });
}

/** Wait for a complete pair, i.e. the engine answered the human move. */
export async function exchange(page: Page, count: number): Promise<void> {
  await plies(page, count);
  await expect(page.locator('.move-cell.missing')).toHaveCount(0);
}

export function clock(page: Page, which: 0 | 1) {
  return page.locator('.chess-clock').nth(which);
}

export async function clockText(page: Page, which: 0 | 1): Promise<string> {
  return (await clock(page, which).innerText()).trim();
}

export async function loadFen(
  page: Page,
  fen: string,
  chess960 = false,
): Promise<void> {
  await study(page, 'Analyze');
  await page.getByRole('button', { name: 'Load FEN', exact: true }).click();
  await page.getByLabel('FEN position').fill(fen);
  await page.getByLabel('Chess960 castling').setChecked(chess960);
  await page
    .getByRole('button', { name: 'Load position', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

export async function importGame(page: Page, pgn: string): Promise<void> {
  await homeGames(page);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.getByLabel('PGN notation').fill(pgn);
  await page.getByRole('button', { name: 'Import game', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Home lists exactly one row per stored game, so duplicate records are visible. */
export async function savedGames(page: Page): Promise<number> {
  await homeGames(page);
  const games = page.locator('.saved-game');
  // Records are written through the SQLite worker, so the list can trail the
  // last move by a moment; no caller ever expects an empty history here.
  await expect.poll(() => games.count(), { timeout: 15000 }).toBeGreaterThan(0);
  return games.count();
}

export async function savedTitles(page: Page): Promise<string[]> {
  await homeGames(page);
  return page.locator('.saved-game strong').allInnerTexts();
}
