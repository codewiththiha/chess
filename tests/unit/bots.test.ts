// Verify the shipped bot identities, stored bots, and per-game bot policy.
import { describe, expect, it } from 'vitest';
import {
  AVATAR_BYTES_MAX,
  BOT_MODES,
  BOT_NAME_MAX,
  DEFAULT_BOT_ID,
  DEV_BOTS,
  botById,
  botForGame,
  botSummary,
  botStrengthLabel,
  devBots,
  newBot,
  orderedBots,
  policyForGame,
  removeBot,
  upsertBot,
  validateBot,
} from '../../src/lib/domain/bots';
import type { BotProfile } from '../../src/lib/domain/bots';
import {
  createGame,
  DEFAULT_NEW_GAME,
  studyGame,
} from '../../src/lib/domain/games';
import { defaultPreferences } from '../../src/lib/domain/preferences';
import { decodeBotProfile } from '../../src/lib/data/validation';
import { ELO_MAX, ELO_MIN } from '../../src/lib/domain/strength';

/** A one-pixel PNG: the smallest picture the reader could really choose. */
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

function customBot(overrides: Partial<BotProfile> = {}): BotProfile {
  return { ...newBot('Sparring Partner'), ...overrides };
}

describe('shipped bots', () => {
  it('are unique, in range, and use styles the engine lists', () => {
    const ids = DEV_BOTS.map((bot) => bot.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const bot of DEV_BOTS) {
      expect(() => validateBot(bot)).not.toThrow();
      expect(bot.category).toBe('dev');
      expect(bot.elo).toBeGreaterThanOrEqual(ELO_MIN);
      expect(bot.elo).toBeLessThanOrEqual(ELO_MAX);
      expect(BOT_MODES).toContain(bot.mode);
      expect(bot.avatar).toBeNull();
    }
  });

  it('names the default bot and describes every bot in one line', () => {
    expect(botById(devBots(), DEFAULT_BOT_ID)?.name).toBe('Pair Programmer');
    const uncapped = devBots().find((bot) => bot.strength === 'full');
    expect(uncapped).toBeDefined();
    expect(uncapped && botStrengthLabel(uncapped)).toBe('Full strength');
    expect(botSummary(devBots()[0]!)).toBe('800 Elo · Human-like');
  });

  it('hands out copies so a caller cannot edit the shipped list', () => {
    const bots = devBots();
    bots[0]!.name = 'Changed';
    expect(DEV_BOTS[0]!.name).toBe('Intern');
  });
});

describe('stored bots', () => {
  it('accepts a picture and rejects text that is not one', () => {
    const bot = customBot({ avatar: PNG });
    expect(() => validateBot(bot)).not.toThrow();
    expect(() =>
      validateBot(customBot({ avatar: 'https://example.com/face.png' })),
    ).toThrow('PNG, JPEG, or WebP');
    expect(() =>
      validateBot(
        customBot({
          avatar: `data:image/png;base64,${'A'.repeat(AVATAR_BYTES_MAX)}`,
        }),
      ),
    ).toThrow('PNG, JPEG, or WebP');
  });

  it('rejects names, strengths, and Elo targets the engine cannot use', () => {
    expect(() => validateBot(customBot({ name: '  ' }))).toThrow('name');
    expect(() =>
      validateBot(customBot({ name: 'x'.repeat(BOT_NAME_MAX + 1) })),
    ).toThrow('under');
    expect(() => validateBot(customBot({ elo: 499 }))).toThrow('Nominal Elo');
    expect(() => validateBot(customBot({ elo: 1600.5 }))).toThrow(
      'Nominal Elo',
    );
    expect(() =>
      validateBot({
        ...customBot(),
        strength: 'max' as BotProfile['strength'],
      }),
    ).toThrow('strength');
  });

  it('round trips through the stored row shape', () => {
    const bot = customBot({ avatar: PNG, blurb: 'Trades early.', elo: 1450 });
    const decoded = decodeBotProfile({ ...bot, category: 'custom' });
    expect(decoded).toEqual(bot);
  });

  it('replaces in place, deletes, and orders shipped bots first', () => {
    const list = [DEV_BOTS[1]!, customBot({ id: 'a', elo: 1000 })];
    const updated = upsertBot(
      list,
      customBot({ id: 'a', elo: 2400, name: 'B' }),
    );
    expect(updated.map((bot) => bot.id)).toEqual([DEV_BOTS[1]!.id, 'a']);
    expect(updated[1]!.elo).toBe(2400);
    expect(upsertBot(updated, customBot({ id: 'c' }))).toHaveLength(3);
    expect(removeBot(updated, 'a').map((bot) => bot.id)).toEqual([
      DEV_BOTS[1]!.id,
    ]);
    const ordered = orderedBots([
      customBot({ id: 'low', elo: 900 }),
      customBot({ id: 'high', elo: 2700 }),
      DEV_BOTS[3]!,
      DEV_BOTS[0]!,
    ]);
    expect(ordered.map((bot) => bot.id)).toEqual([
      DEV_BOTS[0]!.id,
      DEV_BOTS[3]!.id,
      'high',
      'low',
    ]);
  });
});

describe('bots decide a bot game', () => {
  const bots = devBots();

  it('names the bot side and records the identity and its Elo', () => {
    const game = createGame(
      { ...DEFAULT_NEW_GAME, botId: 'dev-junior' },
      { id: 'dev-junior', name: 'Junior Dev', elo: 1200 },
    );
    expect(game.title).toBe('You vs Junior Dev');
    expect(game.botId).toBe('dev-junior');
    expect(game.engineElo).toBe(1200);
    expect(game.black).toBe('Junior Dev');
    expect(game.white).toBe('You');
  });

  it('leaves a two-player game without a bot', () => {
    const game = createGame(
      { ...DEFAULT_NEW_GAME, opponent: 'human' },
      { id: 'dev-junior', name: 'Junior Dev', elo: 1200 },
    );
    expect(game.botId).toBeNull();
    expect(game.white).toBe('Player 1');
  });

  it('plays the bot style and strength instead of the dialog settings', () => {
    const engine = defaultPreferences().engine;
    const game = createGame(
      { ...DEFAULT_NEW_GAME, botId: 'dev-attacker' },
      { id: 'dev-attacker', name: 'Chaos Engineer', elo: 2100 },
    );
    const policy = policyForGame(
      { ...engine, mode: 'human-like', strength: 'full', elo: 3000 },
      game,
      bots,
    );
    expect(policy.mode).toBe('aggressive');
    expect(policy.elo).toBe(2100);
    // The dialog still owns the resource settings the bot does not claim.
    expect(policy.hashMiB).toBe(engine.hashMiB);
  });

  it('falls back to the Elo the record captured when the bot is gone', () => {
    const game = createGame(
      { ...DEFAULT_NEW_GAME, botId: 'bot-deleted' },
      { id: 'bot-deleted', name: 'Deleted', elo: 1350 },
    );
    expect(botForGame(game, bots)).toBeNull();
    const policy = policyForGame(defaultPreferences().engine, game, bots);
    expect(policy.elo).toBe(1350);
    expect(policy.mode).toBe(defaultPreferences().engine.mode);
  });

  it('never lets a bot touch a two-player or study record', () => {
    const engine = { ...defaultPreferences().engine, elo: 1700 };
    const twoPlayers = createGame({ ...DEFAULT_NEW_GAME, opponent: 'human' });
    expect(botForGame(twoPlayers, bots)).toBeNull();
    expect(policyForGame(engine, twoPlayers, bots)).toEqual(engine);
    expect(policyForGame(engine, studyGame(), bots)).toEqual(engine);
    // A study board stays bot-free even if a bot id lingers on the record.
    const study = { ...studyGame(), engineElo: 1600, botId: 'dev-intern' };
    expect(botForGame(study, bots)).toBeNull();
    expect(policyForGame(engine, study, bots)).toEqual(engine);
  });
});
