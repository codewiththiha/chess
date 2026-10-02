// Exercise save-path isolation, single-record merging, and truthful failure reporting.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppState } from '../../src/lib/state/app.svelte';
import { PersistenceController } from '../../src/lib/controllers/persistence';
import { makeClock, startClock } from '../../src/lib/domain/clocks';
import { studyGame } from '../../src/lib/domain/games';
import { moveEntry, INITIAL_FEN } from '../../src/lib/domain/chess';
import type {
  GameRecord,
  Preferences,
  ReviewRecord,
} from '../../src/lib/domain/types';

interface SaveResult {
  id: string;
  merged: boolean;
}

class FakeDb {
  games: GameRecord[] = [];
  reviews: ReviewRecord[] = [];
  preferences: Preferences[] = [];
  merged = false;
  rejectWrites = false;
  saveGame(record: GameRecord): Promise<SaveResult> {
    if (this.rejectWrites)
      return Promise.reject(
        new DOMException('Quota exhausted', 'QuotaExceededError'),
      );
    this.games.push(record);
    return Promise.resolve({
      id: this.merged ? 'survivor-id' : record.id,
      merged: this.merged,
    });
  }
  saveReview(review: ReviewRecord): Promise<void> {
    this.reviews.push(review);
    return Promise.resolve();
  }
  savePreferences(prefs: Preferences): Promise<void> {
    if (this.rejectWrites) return Promise.reject(new Error('write failed'));
    this.preferences.push(prefs);
    return Promise.resolve();
  }
  summaries(): Promise<[]> {
    return Promise.resolve([]);
  }
}

function storageWith(db: FakeDb): {
  storage: PersistenceController;
  state: AppState;
} {
  const state = new AppState();
  const storage = new PersistenceController(state);
  (storage as unknown as { db: FakeDb }).db = db;
  return { state, storage };
}

afterEach(() => vi.restoreAllMocks());

describe('save isolation', () => {
  it('skips an untouched board and freezes a running clock in the saved copy', async () => {
    const db = new FakeDb();
    const { storage, state } = storageWith(db);
    await storage.save();
    expect(db.games).toHaveLength(0);

    const record = state.record;
    record.moves.push(moveEntry(INITIAL_FEN, 'e2e4', false));
    record.clock = makeClock(1, 0);
    startClock(record.clock, 'white', 0);
    vi.spyOn(performance, 'now').mockReturnValue(2_500);
    await storage.save();

    const saved = db.games[0];
    expect(saved).toBeDefined();
    expect(saved?.clock.running).toBeNull();
    expect(saved?.clock.whiteMs).toBe(57500);
    expect(record.clock.running).toBe('white');
    expect(state.saved).toBe(true);
  });

  it('adopts the surviving record and re-points its stored review after a merge', async () => {
    const db = new FakeDb();
    db.merged = true;
    const { storage, state } = storageWith(db);
    const record = state.record;
    record.moves.push(moveEntry(INITIAL_FEN, 'e2e4', false));
    const review: ReviewRecord = {
      version: 1,
      gameId: record.id,
      fingerprint: 'fingerprint',
      engineRevision: 'revision',
      depth: 5,
      nodeBudget: '10000',
      timeMs: 300,
      updatedAt: 1,
      complete: false,
      points: [],
    };
    state.review = review;

    await storage.save();

    expect(state.record.id).toBe('survivor-id');
    expect(db.reviews[0]?.gameId).toBe('survivor-id');
    expect(state.review?.gameId).toBe('survivor-id');
  });

  it('never claims a game was saved when the local database rejects the write', async () => {
    const db = new FakeDb();
    db.rejectWrites = true;
    const { storage, state } = storageWith(db);
    state.record.moves.push(moveEntry(INITIAL_FEN, 'e2e4', false));

    await storage.save();

    expect(state.saved).toBe(false);
    expect(state.storageError).toContain('Local storage is unavailable');
  });

  it('keeps active settings while reporting that they could not be written', async () => {
    const db = new FakeDb();
    const { storage, state } = storageWith(db);
    state.preferences.board = 'ocean';
    db.rejectWrites = true;

    await expect(storage.preferences()).rejects.toThrow(
      'could not be saved locally',
    );
    expect(state.preferences.board).toBe('ocean');
    expect(state.storageError).toContain('Local storage is unavailable');
  });
});

it('saves a studied board without inventing a second game record', async () => {
  const db = new FakeDb();
  const { storage, state } = storageWith(db);
  const studied = studyGame();
  studied.moves.push(moveEntry(INITIAL_FEN, 'd2d4', false));
  state.record = studied;
  await storage.save();
  await storage.save();
  expect(db.games.map((game) => game.id)).toEqual([studied.id, studied.id]);
});
