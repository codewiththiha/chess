// Exercise real Dexie transactions against a browser-compatible in-memory IndexedDB implementation.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { ChessDatabase } from '../../src/lib/data/database';
import { decodeGame, decodePreferences } from '../../src/lib/data/validation';
import { analysisGame } from '../../src/lib/domain/games';
import { moveEntry, INITIAL_FEN } from '../../src/lib/domain/chess';
import { defaultPreferences } from '../../src/lib/domain/preferences';
const opened: ChessDatabase[] = [];
afterEach(async () => {
  for (const db of opened.splice(0)) await db.delete();
});
describe('local persistence', () => {
  it('round-trips preferences and legal records, always restoring paused', async () => {
    const db = new ChessDatabase(`test-${crypto.randomUUID()}`);
    opened.push(db);
    const prefs = defaultPreferences();
    prefs.engine.seed = '18446744073709551615';
    await db.savePreferences(prefs);
    expect((await db.preferences())?.engine.seed).toBe(prefs.engine.seed);
    const g = analysisGame();
    g.moves.push(moveEntry(INITIAL_FEN, 'e2e4', false));
    g.clock.running = 'black';
    g.clock.anchor = 123;
    await db.saveGame(g);
    const loaded = await db.game(g.id);
    expect(loaded?.moves[0]?.san).toBe('e4');
    expect(loaded?.clock.running).toBeNull();
    expect(await db.summaries()).toHaveLength(1);
  });
  it('deletes a game and its review in the same transaction', async () => {
    const db = new ChessDatabase(`test-${crypto.randomUUID()}`);
    opened.push(db);
    const g = analysisGame();
    g.moves.push(moveEntry(INITIAL_FEN, 'e2e4', false));
    await db.saveGame(g);
    await db.reviews.put({
      version: 1,
      gameId: g.id,
      fingerprint: 'test',
      engineRevision: 'test',
      depth: 5,
      nodeBudget: '1000',
      timeMs: 100,
      updatedAt: 0,
      points: [],
      complete: false,
    });
    await db.removeGame(g.id);
    expect(await db.game(g.id)).toBeNull();
    expect(await db.reviews.get(g.id)).toBeUndefined();
  });
  it('replays stored moves rather than trusting stored SAN or FEN', () => {
    const g = analysisGame();
    g.moves.push(moveEntry(INITIAL_FEN, 'e2e4', false));
    const move = g.moves[0];
    if (!move) throw new Error('Missing move');
    move.san = 'malicious';
    move.fen = 'invalid';
    expect(decodeGame(g).moves[0]?.san).toBe('e4');
    move.uci = 'e2e5';
    expect(() => decodeGame(g)).toThrow('Illegal');
  });
  it('rejects corrupt preferences and clocks', () => {
    const p = defaultPreferences();
    p.engine.compute.nodes = '-1';
    expect(() => decodePreferences(p)).toThrow();
    const g = analysisGame();
    g.clock.whiteMs = -1;
    expect(() => decodeGame(g)).toThrow('clock');
  });
});
