// Exercise the SQLite record layer against real SQLite, including duplicate merging.
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SqlStore } from '../../src/lib/data/sql-handle';
import type {
  SqlHandle,
  SqlValue,
  StoredBot,
  StoredGame,
} from '../../src/lib/data/sql-handle';
import { gameIdentity } from '../../src/lib/domain/identity';

function game(overrides: Partial<StoredGame> = {}): StoredGame {
  return {
    id: 'game-one',
    dedupe: 'identity',
    title: 'Local game',
    kind: 'play',
    createdAt: 1_000,
    updatedAt: 1_000,
    startFen: 'standard',
    chess960: 0,
    human: 'white',
    white: 'You',
    black: 'gwaymaegyi',
    result: '*',
    termination: '',
    moves: '[]',
    clock: '{}',
    engineElo: 1600,
    headers: '{}',
    opponent: 'bot',
    botId: null,
    ...overrides,
  };
}

function bot(overrides: Partial<StoredBot> = {}): StoredBot {
  return {
    id: 'bot-one',
    name: 'Sparring Partner',
    category: 'custom',
    elo: 1450,
    strength: 'elo',
    mode: 'balanced',
    blurb: 'Trades early.',
    avatar: 'data:image/png;base64,AAAA',
    behaviors: '{}',
    parameters: '{}',
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

let store: SqlStore;
let handle: SqlHandle;
let sqlite: Awaited<ReturnType<typeof sqlite3InitModule>>;

/** A private in-memory database, for schema work that must not see the shared one. */
function freshDatabase(): SqlHandle {
  const database = new sqlite.oo1.DB(':memory:', 'ct');
  return {
    selectObjects: (sql: string, params?: SqlValue[]) =>
      database.selectObjects(sql, params ?? []),
    exec: (sql: string, params?: SqlValue[]) => {
      database.exec({ sql, bind: params ?? [] });
    },
    close: () => {
      database.close();
    },
  };
}

beforeAll(async () => {
  sqlite = await sqlite3InitModule();
  handle = freshDatabase();
  store = new SqlStore(handle);
});

beforeEach(() => {
  store.migrate();
  handle.exec('DELETE FROM games');
  handle.exec('DELETE FROM reviews');
  handle.exec('DELETE FROM settings');
  handle.exec('DELETE FROM bots');
});

describe('game records', () => {
  it('round-trips a stored game and reports summaries newest first', () => {
    expect(store.writeGame(game({ id: 'older', updatedAt: 500 }))).toEqual({
      id: 'older',
      merged: false,
    });
    expect(
      store.writeGame(game({ id: 'newer', dedupe: 'other', updatedAt: 900 })),
    ).toEqual({ id: 'newer', merged: false });
    expect(store.gameCount()).toBe(2);
    const summaries = store.listSummaries();
    expect(summaries.map((row) => row.id)).toEqual(['newer', 'older']);
    expect(store.readGame('older')?.title).toBe('Local game');
    expect(store.readGame('missing')).toBeNull();
  });

  it('updates an existing row instead of inserting a second one', () => {
    store.writeGame(game({ id: 'same', moves: '[{"uci":"e2e4"}]' }));
    store.writeGame(
      game({
        id: 'same',
        moves: '[{"uci":"e2e4"},{"uci":"e7e5"}]',
        updatedAt: 7,
      }),
    );
    expect(store.gameCount()).toBe(1);
    expect(store.readGame('same')?.moves).toContain('e7e5');
    expect(store.readGame('same')?.updatedAt).toBe(7);
  });

  it('merges identical play into the reviewed record and moves its review', () => {
    store.writeGame(game({ id: 'played', createdAt: 2_000 }));
    store.writeReview({
      gameId: 'played',
      fingerprint: 'fingerprint',
      engineRevision: '4e2af5f',
      depth: 7,
      nodeBudget: '25000',
      timeMs: 750,
      updatedAt: 2_500,
      complete: 1,
      points: '[]',
    });
    const result = store.writeGame(
      game({ id: 'analysis-copy', kind: 'import', createdAt: 9_000 }),
    );
    expect(result).toEqual({ id: 'played', merged: true });
    expect(store.gameCount()).toBe(1);
    expect(store.readReview('played')?.complete).toBe(1);
    expect(store.readReview('analysis-copy')).toBeNull();
    expect(store.listSummaries()[0]?.reviewed).toBe(1);
    expect(store.readGame('played')?.kind).toBe('import');
  });

  it('keeps the oldest record when neither duplicate has a review', () => {
    store.writeGame(game({ id: 'first', createdAt: 100 }));
    const result = store.writeGame(game({ id: 'second', createdAt: 800 }));
    expect(result).toEqual({ id: 'first', merged: true });
    expect(store.allGames().map((row) => row.id)).toEqual(['first']);
  });

  it('moves an unfinished review onto the surviving duplicate', () => {
    store.writeGame(game({ id: 'source' }));
    store.writeReview({
      gameId: 'source',
      fingerprint: 'partial',
      engineRevision: '4e2af5f',
      depth: 5,
      nodeBudget: '10000',
      timeMs: 300,
      updatedAt: 1_200,
      complete: 0,
      points: '[{"ply":0}]',
    });
    // The oldest unreviewed record survives, so partial evidence must follow it.
    const merged = store.writeGame(game({ id: 'target', createdAt: 50 }));
    expect(merged).toEqual({ id: 'target', merged: true });
    expect(store.readReview('source')).toBeNull();
    expect(store.readReview('target')?.points).toBe('[{"ply":0}]');
    expect(store.listSummaries()[0]?.reviewed).toBe(0);
  });

  it('tracks completion on the game row and clears it when a review is removed', () => {
    store.writeGame(game({ id: 'reviewed' }));
    store.writeReview({
      gameId: 'reviewed',
      fingerprint: 'fingerprint',
      engineRevision: '4e2af5f',
      depth: 10,
      nodeBudget: '100000',
      timeMs: 2_000,
      updatedAt: 3_000,
      complete: 1,
      points: '[]',
    });
    expect(store.listSummaries()[0]?.reviewed).toBe(1);
    expect(store.listSummaries()[0]?.reviewComplete).toBe(1);
    store.deleteReview('reviewed');
    expect(store.listSummaries()[0]?.reviewed).toBe(0);
    expect(store.readReview('reviewed')).toBeNull();
  });

  it('upgrades a database written before Elo, opponent, and bot identities', () => {
    const legacy = freshDatabase();
    legacy.exec(`CREATE TABLE games (
      id TEXT PRIMARY KEY, dedupe TEXT NOT NULL, title TEXT NOT NULL, kind TEXT NOT NULL,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, start_fen TEXT NOT NULL,
      chess960 INTEGER NOT NULL, human TEXT NOT NULL, white TEXT NOT NULL, black TEXT NOT NULL,
      result TEXT NOT NULL, termination TEXT NOT NULL, moves TEXT NOT NULL, clock TEXT NOT NULL,
      engine_level INTEGER NOT NULL, headers TEXT NOT NULL, reviewed INTEGER NOT NULL DEFAULT 0
    )`);
    legacy.exec(
      `INSERT INTO games VALUES ('old', 'identity', 'Old game', 'play', 1, 2, 'standard',
        0, 'white', 'You', 'gwaymaegyi', '*', '', '[]', '{}', 1500, '{}', 0)`,
    );
    const upgraded = new SqlStore(legacy);
    upgraded.migrate();
    const row = upgraded.readGame('old');
    expect(row?.engineElo).toBe(1500);
    expect(row?.opponent).toBe('bot');
    expect(row?.botId).toBeNull();
    const columns = legacy
      .selectObjects('PRAGMA table_info(games)')
      .map((value) => String(value.name));
    expect(columns).toContain('engine_elo');
    expect(columns).not.toContain('engine_level');
    // Running the upgrade twice must not fail or drop the row.
    upgraded.migrate();
    expect(upgraded.readGame('old')?.engineElo).toBe(1500);
    legacy.close();
  });

  it('deletes a game with its review and keeps unrelated rows', () => {
    store.writeGame(game({ id: 'keep', dedupe: 'keep' }));
    store.writeGame(game({ id: 'drop', dedupe: 'drop' }));
    store.writeReview({
      gameId: 'keep',
      fingerprint: 'f',
      engineRevision: '4e2af5f',
      depth: 5,
      nodeBudget: '10000',
      timeMs: 300,
      updatedAt: 1,
      complete: 1,
      points: '[]',
    });
    store.deleteGame('keep');
    expect(store.allGames().map((row) => row.id)).toEqual(['drop']);
    expect(store.readReview('keep')).toBeNull();
  });

  it('stores the bot a game was played against on the game row', () => {
    store.writeGame(game({ botId: 'dev-intern' }));
    expect(store.readGame('game-one')?.botId).toBe('dev-intern');
    store.writeGame(game({ botId: null }));
    expect(store.readGame('game-one')?.botId).toBeNull();
  });

  it('keeps the reader bots in the database and writes them idempotently', () => {
    store.writeBot(bot());
    store.writeBot(bot({ elo: 2600, name: 'Renamed', avatar: null }));
    const rows = store.listBots();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'bot-one',
      name: 'Renamed',
      elo: 2600,
      avatar: null,
    });
    store.writeBot(bot({ id: 'bot-two', elo: 900 }));
    // Newest Elo first, so the list reads strongest to weakest.
    expect(store.listBots().map((row) => row.id)).toEqual([
      'bot-one',
      'bot-two',
    ]);
    store.deleteBot('bot-one');
    expect(store.listBots().map((row) => row.id)).toEqual(['bot-two']);
  });

  it('stores preferences and metadata as settings', () => {
    expect(store.setting('preferences')).toBeNull();
    store.setSetting('preferences', '{"version":1}');
    store.setSetting('preferences', '{"version":1,"board":"ocean"}');
    expect(store.setting('preferences')).toBe('{"version":1,"board":"ocean"}');
  });

  it('rejects malformed stored rows instead of returning them', () => {
    store.writeGame(game({ id: 'good' }));
    handle.exec('UPDATE games SET created_at = ? WHERE id = ?', [
      'not-a-number',
      'good',
    ]);
    expect(() => store.readGame('good')).toThrow(/creation time/);
  });

  it('derives one identity for the same moves and a different one after a change', () => {
    const base = {
      startFen: '8/8/8/8/8/8/8/8',
      chess960: false,
      human: 'white',
      moves: [{ uci: 'e2e4' }, { uci: 'e7e5' }],
    };
    expect(gameIdentity(base)).toBe(gameIdentity({ ...base }));
    expect(gameIdentity(base)).not.toBe(
      gameIdentity({ ...base, moves: [...base.moves, { uci: 'g1f3' }] }),
    );
    expect(gameIdentity(base)).not.toBe(
      gameIdentity({ ...base, chess960: true }),
    );
  });
});
