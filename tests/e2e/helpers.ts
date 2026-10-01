// Reuse actual pointer/touch paths and validate data read from the real browser database.
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  decodeGame,
  decodePreferences,
  object,
} from '../../src/lib/data/validation';
import type { GameRecord, Preferences } from '../../src/lib/domain/types';
export async function open(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.local-engine-badge')).toHaveText('Local engine');
}
export async function navigate(page: Page, label: string): Promise<void> {
  const mobile = (page.viewportSize()?.width ?? 1440) <= 760;
  await page
    .getByRole('navigation', {
      name: mobile ? 'Mobile navigation' : 'Main navigation',
      exact: true,
    })
    .getByRole('button', { name: label, exact: true })
    .click();
}
export async function squarePoint(
  page: Page,
  key: string,
): Promise<{ x: number; y: number }> {
  const board = page.locator('cg-board');
  await board.scrollIntoViewIfNeeded();
  if ((page.viewportSize()?.width ?? 1440) <= 760)
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
  if ((page.viewportSize()?.width ?? 1440) <= 760)
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
  const start = await squarePoint(page, from);
  const end = await squarePoint(page, to);
  if ((page.viewportSize()?.width ?? 1440) <= 760) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [start],
    });
    for (let i = 1; i <= 8; i++)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: start.x + ((end.x - start.x) * i) / 8,
            y: start.y + ((end.y - start.y) * i) / 8,
          },
        ],
      });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await cdp.detach();
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 10 });
    await page.mouse.up();
  }
}
export async function row(
  page: Page,
  store: string,
  key: string,
): Promise<unknown> {
  return page.evaluate(
    ({ store: storeName, key: rowKey }) =>
      new Promise<unknown>((resolve, reject) => {
        const request = indexedDB.open('gwaymaegyi-chess');
        request.addEventListener(
          'error',
          () => reject(new Error('Database did not open')),
          { once: true },
        );
        request.addEventListener(
          'success',
          () => {
            const db = request.result;
            const transaction = db.transaction(storeName, 'readonly');
            const get = transaction.objectStore(storeName).get(rowKey);
            get.addEventListener('success', () => resolve(get.result), {
              once: true,
            });
            get.addEventListener(
              'error',
              () => reject(new Error('Database read failed')),
              { once: true },
            );
            transaction.addEventListener('complete', () => db.close(), {
              once: true,
            });
            transaction.addEventListener(
              'abort',
              () => {
                db.close();
                reject(new Error('Database transaction aborted'));
              },
              { once: true },
            );
          },
          { once: true },
        );
      }),
    { store, key },
  );
}
export async function prefs(page: Page): Promise<Preferences> {
  return decodePreferences(
    object(await row(page, 'settings', 'preferences')).value,
  );
}
export async function game(page: Page): Promise<GameRecord> {
  const p = await prefs(page);
  if (!p.lastGameId) throw new Error('Game not saved');
  return decodeGame(await row(page, 'games', p.lastGameId));
}
export async function loadFen(
  page: Page,
  fen: string,
  chess960 = false,
): Promise<void> {
  await navigate(page, 'Analysis');
  await page.getByRole('button', { name: 'Load FEN', exact: true }).click();
  await page.getByLabel('FEN position').fill(fen);
  await page.getByLabel('Chess960 castling').setChecked(chess960);
  await page
    .getByRole('button', { name: 'Load position', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
export async function importGame(page: Page, pgn: string): Promise<void> {
  await navigate(page, 'Library');
  await page.getByRole('button', { name: 'Import PGN', exact: true }).click();
  await page.getByLabel('PGN notation').fill(pgn);
  await page.getByRole('button', { name: 'Import game', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
export async function putRow(
  page: Page,
  store: string,
  value: unknown,
): Promise<void> {
  return page.evaluate(
    ({ store: storeName, value: record }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('gwaymaegyi-chess');
        request.addEventListener(
          'error',
          () => reject(new Error('Database did not open')),
          { once: true },
        );
        request.addEventListener(
          'success',
          () => {
            const db = request.result;
            const transaction = db.transaction(storeName, 'readwrite');
            transaction.objectStore(storeName).put(record);
            transaction.addEventListener(
              'complete',
              () => {
                db.close();
                resolve();
              },
              { once: true },
            );
            transaction.addEventListener(
              'abort',
              () => {
                db.close();
                reject(new Error('Database write failed'));
              },
              { once: true },
            );
          },
          { once: true },
        );
      }),
    { store, value },
  );
}
