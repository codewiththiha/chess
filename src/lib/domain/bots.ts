// Define opponent identities: the bots that ship with the app and the ones saved locally.
import { clampElo, ELO_MIN, ELO_MAX, strengthLabel } from './strength';
import type { EngineMode, EngineSettings, GameRecord } from './types';

export type BotCategory = 'dev' | 'custom';

export interface BotProfile {
  id: string;
  name: string;
  category: BotCategory;
  /** Nominal Elo the bot plays at; ignored when `strength` is 'full'. */
  elo: number;
  strength: 'elo' | 'full';
  /** Playing policy the bot asks the engine for. */
  mode: EngineMode;
  blurb: string;
  /** Picture the reader supplied, as a small image data URI, or null for none. */
  avatar: string | null;
  behaviors: Record<string, boolean>;
  parameters: Record<string, number>;
}

export const BOT_NAME_MAX = 24;
export const BOT_BLURB_MAX = 90;
/** A stored picture is downscaled to this size before it reaches the database. */
export const AVATAR_PIXELS = 128;
export const AVATAR_BYTES_MAX = 192 * 1024;
export const AVATAR_TYPES = [
  'data:image/png;base64,',
  'data:image/jpeg;base64,',
  'data:image/webp;base64,',
] as const;
export const BOT_MODES: readonly EngineMode[] = [
  'balanced',
  'aggressive',
  'human-like',
  'analysis',
];

/**
 * The bots the app ships with. They are plain sparring identities built from the
 * engine settings the interface already exposes (policy + nominal Elo), so every
 * one of them plays exactly what its card claims.
 */
export const DEV_BOTS: readonly BotProfile[] = [
  {
    id: 'dev-intern',
    name: 'Intern',
    category: 'dev',
    elo: 800,
    strength: 'elo',
    mode: 'human-like',
    blurb: 'Learning the ropes. Drops pieces, then finds a tactic.',
    avatar: null,
    behaviors: {},
    parameters: {},
  },
  {
    id: 'dev-junior',
    name: 'Junior Dev',
    category: 'dev',
    elo: 1200,
    strength: 'elo',
    mode: 'balanced',
    blurb: 'Solid for a while, then over-extends.',
    avatar: null,
    behaviors: {},
    parameters: {},
  },
  {
    id: 'dev-pair',
    name: 'Pair Programmer',
    category: 'dev',
    elo: 1600,
    strength: 'elo',
    mode: 'balanced',
    blurb: 'Even play. Punishes anything loose.',
    avatar: null,
    behaviors: {},
    parameters: {},
  },
  {
    id: 'dev-reviewer',
    name: 'Code Reviewer',
    category: 'dev',
    elo: 1900,
    strength: 'elo',
    mode: 'human-like',
    blurb: 'Quiet, patient, and hard to trick.',
    avatar: null,
    behaviors: {},
    parameters: {},
  },
  {
    id: 'dev-attacker',
    name: 'Chaos Engineer',
    category: 'dev',
    elo: 2100,
    strength: 'elo',
    mode: 'aggressive',
    blurb: 'Creates threats first and counts material later.',
    avatar: null,
    behaviors: {},
    parameters: {},
  },
  {
    id: 'dev-principal',
    name: 'Principal',
    category: 'dev',
    elo: ELO_MAX,
    strength: 'full',
    mode: 'balanced',
    blurb: 'Bounded only by the clock. No handicap.',
    avatar: null,
    behaviors: {},
    parameters: {},
  },
];

export const DEFAULT_BOT_ID = 'dev-pair';

export function devBots(): BotProfile[] {
  return DEV_BOTS.map((bot) => ({ ...bot }));
}

export function isAvatarDataUri(value: string): boolean {
  return (
    AVATAR_TYPES.some((prefix) => value.startsWith(prefix)) &&
    value.length <= AVATAR_BYTES_MAX
  );
}

/** Reject anything the engine, the database, or a player row cannot use. */
export function validateBot(bot: BotProfile): void {
  const name = bot.name.trim();
  if (!name) throw new Error('Give the bot a name.');
  if (name.length > BOT_NAME_MAX)
    throw new Error(`Keep the bot name under ${BOT_NAME_MAX} characters.`);
  if (bot.blurb.length > BOT_BLURB_MAX)
    throw new Error(`Keep the description under ${BOT_BLURB_MAX} characters.`);
  if (bot.category !== 'dev' && bot.category !== 'custom')
    throw new Error('Unknown bot category.');
  if (bot.strength !== 'elo' && bot.strength !== 'full')
    throw new Error('Unknown bot strength.');
  if (!Number.isSafeInteger(bot.elo) || bot.elo < ELO_MIN || bot.elo > ELO_MAX)
    throw new Error(
      `Nominal Elo must be an integer from ${ELO_MIN} to ${ELO_MAX}.`,
    );
  if (!BOT_MODES.includes(bot.mode)) throw new Error('Unknown bot style.');
  if (bot.avatar !== null && !isAvatarDataUri(bot.avatar))
    throw new Error(
      'The bot picture must be a small PNG, JPEG, or WebP image.',
    );
}

export function botById(
  bots: BotProfile[],
  id: string | null,
): BotProfile | null {
  if (!id) return null;
  return bots.find((bot) => bot.id === id) ?? null;
}

export function botStrengthLabel(bot: BotProfile): string {
  return strengthLabel(bot.strength, bot.elo);
}

/** Describe a bot in one line: strength, then the policy it plays. */
export function botSummary(bot: BotProfile): string {
  const style =
    bot.mode === 'human-like'
      ? 'Human-like'
      : bot.mode === 'aggressive'
        ? 'Attacking'
        : bot.mode === 'analysis'
          ? 'Analysis'
          : 'Balanced';
  return `${botStrengthLabel(bot)} · ${style}`;
}

/** Insert or replace one bot without disturbing the order of the others. */
export function upsertBot(bots: BotProfile[], bot: BotProfile): BotProfile[] {
  const index = bots.findIndex((existing) => existing.id === bot.id);
  if (index === -1) return [...bots, bot];
  return bots.map((existing, position) =>
    position === index ? bot : existing,
  );
}

/** Show the shipped bots first in their published order, then the reader's. */
export function orderedBots(bots: BotProfile[]): BotProfile[] {
  const shipped = new Map(DEV_BOTS.map((bot, index) => [bot.id, index]));
  return bots.toSorted((a, b) => {
    const left = shipped.get(a.id);
    const right = shipped.get(b.id);
    if (left !== undefined || right !== undefined)
      return (
        (left ?? Number.MAX_SAFE_INTEGER) - (right ?? Number.MAX_SAFE_INTEGER)
      );
    return b.elo - a.elo;
  });
}

export function removeBot(bots: BotProfile[], id: string): BotProfile[] {
  return bots.filter((bot) => bot.id !== id);
}

export function customBots(bots: BotProfile[]): BotProfile[] {
  return bots.filter((bot) => bot.category === 'custom');
}

export function botsOfCategory(
  bots: BotProfile[],
  category: BotCategory,
): BotProfile[] {
  return bots.filter((bot) => bot.category === category);
}

/** The bot that answers in this record, if the record was played against one. */
export function botForGame(
  record: GameRecord,
  bots: BotProfile[],
): BotProfile | null {
  if (record.opponent !== 'bot') return null;
  return botById(bots, record.botId);
}

/**
 * Engine settings the loaded game must play with. A bot's own style and strength
 * win over the global settings, so a stored game keeps the opponent it was
 * started against; a deleted bot falls back to the Elo the record captured.
 */
export function policyForGame(
  engine: EngineSettings,
  record: GameRecord,
  bots: BotProfile[],
): EngineSettings {
  if (record.opponent !== 'bot') return engine;
  const bot = botForGame(record, bots);
  if (!bot) return { ...engine, elo: clampElo(record.engineElo) };
  return {
    ...engine,
    mode: bot.mode,
    strength: bot.strength,
    elo: clampElo(bot.elo),
    behaviors: { ...engine.behaviors, ...bot.behaviors },
    parameters: { ...engine.parameters, ...bot.parameters },
  };
}

/** What the opponent row shows under the bot's name. */
export function gameOpponentLabel(
  record: GameRecord,
  bots: BotProfile[],
): string {
  if (record.opponent === 'human') return 'Second player';
  const bot = botForGame(record, bots);
  if (bot) return botStrengthLabel(bot);
  return strengthLabel('elo', clampElo(record.engineElo));
}

/** Give the reader a fresh identity each time they add one. */
export function newBot(name: string): BotProfile {
  return {
    id: `bot-${crypto.randomUUID()}`,
    name,
    category: 'custom',
    elo: 1600,
    strength: 'elo',
    mode: 'balanced',
    blurb: '',
    avatar: null,
    behaviors: {},
    parameters: {},
  };
}
