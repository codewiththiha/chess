// Exercise the SQLite record layer against real SQLite, including duplicate merging.
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SqlStore } from '../../src/lib/data/sql-handle';
import type {
  SqlHandle,
  SqlValue,
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
    engineLevel: 8,
    headers: '{}',
    ...overrides,
  };
}

let store: SqlStore;
let handle: SqlHandle;

beforeAll(async () => {
  const sqlite3 = await sqlite3InitModule();
  const database = new sqlite3.oo1.DB(':memory:', 'ct');
  handle = {
    selectObjects: (sql: string, params?: SqlValue[]) =>
      database.selectObjects(sql, params ?? []),
    exec: (sql: string, params?: SqlValue[]) => {
      database.exec({ sql, bind: params ?? [] });
    },
    close: () => {
      database.close();
    },
  };
  store = new SqlStore(handle);
});

beforeEach(() => {
  store.migrate();
  handle.exec('DELETE FROM games');
  handle.exec('DELETE FROM reviews');
  handle.exec('DELETE FROM settings');
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
