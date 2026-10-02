// Prove the characters speak: a stubbed platform engine records what is said.
import { expect, test } from '@playwright/test';
import { go, open, start } from './helpers';

interface Said {
  text: string;
  rate: number;
  pitch: number;
  lang: string;
  voice: string | null;
}

function picker(page: import('@playwright/test').Page) {
  return page.getByRole('group', { name: 'Bot', exact: true });
}

async function face(
  page: import('@playwright/test').Page,
  name: string,
): Promise<void> {
  // The picker lives on Home, so face an opponent from there.
  await go(page, 'Home');
  await picker(page)
    .locator('.bot-card', { hasText: name })
    .locator('.bot-pick')
    .click();
}

/**
 * Stand in for the platform's speech engine. The headless browser has no voices
 * of its own, so the test supplies a few and records every utterance instead of
 * letting it be spoken into nothing.
 */
async function stubbedEngine(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.addInitScript(() => {
    const said: Said[] = [];
    (window as unknown as { said: Said[] }).said = said;
    const voices = [
      { name: 'Ada (English)', lang: 'en-GB' },
      { name: 'Samantha', lang: 'en-US' },
      { name: 'Daniel', lang: 'en-GB' },
    ];
    const synthesis = {
      cancel() {},
      getVoices: () => voices,
      speak(utterance: SpeechSynthesisUtterance) {
        said.push({
          text: utterance.text,
          rate: utterance.rate,
          pitch: utterance.pitch,
          lang: utterance.lang,
          voice: (utterance.voice as { name?: string } | null)?.name ?? null,
        });
      },
    };
    // Plain objects cannot be assigned to a real utterance, so the utterance is
    // stubbed as well and the engine accepts the voices the test offers.
    (
      window as unknown as { SpeechSynthesisUtterance: unknown }
    ).SpeechSynthesisUtterance = class {
      text: string;
      lang = '';
      rate = 1;
      pitch = 1;
      voice: unknown = null;
      constructor(text: string) {
        this.text = text;
      }
    };
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      get: () => synthesis,
    });
  });
}

function spoken(page: import('@playwright/test').Page) {
  return page.evaluate(() => (window as unknown as { said: Said[] }).said);
}

/** The bubble's words without the character's name above them. */
async function bubbleText(
  page: import('@playwright/test').Page,
): Promise<string> {
  return page.locator('.bot-bubble').evaluate((node) => {
    const name = node.querySelector('.bot-bubble-name');
    const rest = [...node.childNodes]
      .filter((child) => child !== name)
      .map((child) => child.textContent ?? '')
      .join('');
    return rest.trim();
  });
}

/** The one switch that lets the characters speak, one icon away in the rail. */
function speechSwitch(page: import('@playwright/test').Page) {
  return page.getByRole('button', { name: 'Opponent speech', exact: true });
}

/** Talking is opt-in, so a test that wants to hear it has to ask for it. */
async function turnSpeechOn(page: import('@playwright/test').Page) {
  await open(page);
  await speechSwitch(page).click();
  await expect(speechSwitch(page)).toHaveAttribute('aria-pressed', 'true');
}

test('the characters are silent until the reader asks them to talk', async ({
  page,
}) => {
  await stubbedEngine(page);
  await open(page);
  // Silence is the default, and the rail says so.
  await expect(speechSwitch(page)).toHaveAttribute('aria-pressed', 'false');
  await start(page, { preset: '3 min' });
  await expect(page.locator('.bot-bubble')).toBeVisible();
  await page.waitForTimeout(600);
  expect((await spoken(page)).length).toBe(0);
  // Turning it on from the rail lets the characters talk out loud.
  await speechSwitch(page).click();
  await expect(speechSwitch(page)).toHaveAttribute('aria-pressed', 'true');
  await start(page, { preset: '3 min' });
  await expect(page.locator('.bot-bubble')).toBeVisible();
  await expect
    .poll(async () => (await spoken(page)).length, { timeout: 5000 })
    .toBeGreaterThan(0);
  // And it survives a reload, because it is stored like every other setting.
  await page.reload();
  await expect(speechSwitch(page)).toHaveAttribute('aria-pressed', 'true');
});

test('the character speaks its line in its own voice', async ({ page }) => {
  await stubbedEngine(page);
  await turnSpeechOn(page);
  await face(page, 'Kyar Nyo');
  await start(page, { preset: '3 min' });
  await expect(page.locator('.bot-bubble')).toBeVisible();
  await expect
    .poll(async () => (await spoken(page)).length, { timeout: 5000 })
    .toBeGreaterThan(0);
  const greeting = (await spoken(page))[0]!;
  // The words out loud are the words in the bubble, never a different line.
  expect(greeting.text).toBe(await bubbleText(page));
  // Kyar Nyo is warm: a feminine platform voice, unhurried, pitched up.
  expect(greeting.pitch).toBeGreaterThan(1);
  expect(greeting.rate).toBe(1);
  expect(greeting.lang).toBe('en-US');
  expect(greeting.voice).toBe('Samantha');

  // A second line, and a different character, is spoken in a colder manner.
  await face(page, 'Kyaw Gyi');
  await start(page, { preset: '3 min' });
  await expect
    .poll(async () => (await spoken(page)).length, { timeout: 5000 })
    .toBeGreaterThan(1);
  const second = (await spoken(page)).at(-1)!;
  expect(second.text).toBe(await bubbleText(page));
  expect(second.pitch).toBeLessThan(1);
  expect(second.rate).toBeLessThan(1);
  expect(second.voice).toBe('Daniel');
});

test('the same line is never said twice in a row', async ({ page }) => {
  await stubbedEngine(page);
  await turnSpeechOn(page);
  await face(page, 'Kyaw Gyi');
  await start(page, { preset: '3 min' });
  await expect(page.locator('.bot-bubble')).toBeVisible();
  await expect
    .poll(async () => (await spoken(page)).length, { timeout: 5000 })
    .toBeGreaterThan(0);
  const lines = (await spoken(page)).map((one) => one.text);
  expect(new Set(lines).size).toBe(lines.length);
});
