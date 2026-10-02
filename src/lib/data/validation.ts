// Decode persisted data before it can replace a live legal game.
import { defaultPreferences, validatePreferences } from '../domain/preferences';
import { eloForLevel, FULL_STRENGTH_LEVEL } from '../domain/strength';
import { studyGame } from '../domain/games';
import { moveEntry, fenAt, position } from '../domain/chess';
import type { GameRecord, Preferences, Result } from '../domain/types';
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected an object.');
  return value as Record<string, unknown>;
}
export function text(value: unknown, max = 512): string {
  if (typeof value !== 'string' || value.length > max)
    throw new Error('Invalid text field.');
  return value;
}
export function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error('Invalid numeric field.');
  return value;
}
export function timestamp(value: unknown): number {
  const result = number(value);
  if (!Number.isSafeInteger(result) || result < 0 || result > 8640000000000000)
    throw new Error('Invalid saved date.');
  return result;
}
export function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Invalid boolean field.');
  return value;
}
export function choice<T extends string>(
  value: unknown,
  choices: readonly T[],
): T {
  const found = choices.find((c) => c === value);
  if (found === undefined) throw new Error('Unknown option.');
  return found;
}
function legacyStrength(engine: Record<string, unknown>): 'elo' | 'full' {
  return typeof engine.skillLevel === 'number' &&
    engine.skillLevel >= FULL_STRENGTH_LEVEL
    ? 'full'
    : 'elo';
}

export function decodePreferences(value: unknown): Preferences {
  const p = object(value);
  const e = object(p.engine);
  const c = object(e.compute);
  const defaults = defaultPreferences();
  const result: Preferences = {
    ...defaults,
    appearance: choice(p.appearance, ['light', 'dark', 'system']),
    board: choice(p.board, ['sage', 'walnut', 'ocean', 'slate']),
    pieces: choice(p.pieces, ['chessnut', 'celtic', 'cburnett']),
    animations: bool(p.animations),
    sound: bool(p.sound),
    coordinates: bool(p.coordinates),
    legalMoves: bool(p.legalMoves),
    lastMove: bool(p.lastMove),
    check: bool(p.check),
    arrows: bool(p.arrows),
    // Preferences saved before the Elo-only model stored a skill level instead.
    arrowCount:
      p.arrowCount === undefined ? defaults.arrowCount : number(p.arrowCount),
    premove: p.premove === undefined ? defaults.premove : bool(p.premove),
    evaluation: bool(p.evaluation),
    lastGameId: p.lastGameId === null ? null : text(p.lastGameId, 128),
    engine: {
      backend: choice(e.backend, ['auto', 'portable', 'simd128']),
      mode: choice(e.mode, [
        'balanced',
        'aggressive',
        'human-like',
        'analysis',
      ]),
      strength:
        e.strength === 'skill' || e.strength === 'elo' || e.strength === 'full'
          ? e.strength === 'skill'
            ? legacyStrength(e)
            : e.strength
          : defaults.engine.strength,
      elo:
        e.strength === 'skill'
          ? eloForLevel(number(e.skillLevel))
          : number(e.elo),
      hashMiB: number(e.hashMiB),
      multiPv: number(e.multiPv),
      seed: text(e.seed, 20),
      behaviors: Object.fromEntries(
        Object.entries(object(e.behaviors)).map(([k, v]) => [
          text(k, 64),
          bool(v),
        ]),
      ),
      parameters: Object.fromEntries(
        Object.entries(object(e.parameters)).map(([k, v]) => [
          text(k, 64),
          number(v),
        ]),
      ),
      compute: {
        profile: choice(c.profile, [
          'full',
          'balanced',
          'responsive',
          'custom',
        ]),
        depth: number(c.depth),
        nodes: text(c.nodes, 20),
        quantum: number(c.quantum),
        reportIntervalMs: number(c.reportIntervalMs),
        timeMs: c.timeMs === null ? null : number(c.timeMs),
      },
    },
  };
  if (p.version !== 1) throw new Error('Unknown preference version.');
  validatePreferences(result);
  return result;
}
export function decodeGame(value: unknown): GameRecord {
  const x = object(value);
  if (x.version !== 1) throw new Error('Unsupported game version.');
  const g = studyGame(text(x.startFen, 256));
  const clock = object(x.clock);
  g.id = text(x.id, 128);
  if (!g.id) throw new Error('Missing game identity.');
  g.kind = choice(x.kind, ['play', 'import']);
  g.title = text(x.title, 120);
  g.white = text(x.white, 120);
  g.black = text(x.black, 120);
  g.human = choice(x.human, ['white', 'black']);
  g.chess960 = bool(x.chess960);
  g.createdAt = timestamp(x.createdAt);
  g.updatedAt = timestamp(x.updatedAt);
  g.result = choice<Result>(x.result, ['*', '1-0', '0-1', '1/2-1/2']);
  g.termination = text(x.termination, 128);
  g.opponent = x.opponent === 'human' ? 'human' : 'bot';
  g.engineElo = number(x.engineElo);
  g.headers = Object.fromEntries(
    Object.entries(object(x.headers)).map(([k, v]) => [
      text(k, 64),
      text(v, 512),
    ]),
  );
  const validClock = (v: unknown) => {
    const n = number(v);
    if (n < 0 || n > 1e12) throw new Error('Invalid saved clock.');
    return n;
  };
  g.clock = {
    initialMs: validClock(clock.initialMs),
    incrementMs: validClock(clock.incrementMs),
    whiteMs: validClock(clock.whiteMs),
    blackMs: validClock(clock.blackMs),
    running: null,
    anchor: null,
  };
  if (!Array.isArray(x.moves) || x.moves.length > 2048)
    throw new Error('Invalid saved move history.');
  for (const raw of x.moves) {
    const m = object(raw);
    const entry = moveEntry(
      fenAt(g, g.moves.length),
      text(m.uci, 5),
      g.chess960,
    );
    entry.whiteMs = validClock(m.whiteMs);
    entry.blackMs = validClock(m.blackMs);
    g.moves.push(entry);
  }
  position(fenAt(g, g.moves.length));
  return g;
}
