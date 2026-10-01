// Exercise corrupt-preference isolation and truthful IndexedDB write-failure handling.
import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { AppState } from '../../src/lib/state/app.svelte';
import { PersistenceController } from '../../src/lib/controllers/persistence';
import { Session } from '../../src/lib/controllers/session';
import { defaultPreferences } from '../../src/lib/domain/preferences';
import { analysisGame } from '../../src/lib/domain/games';
import { moveEntry, INITIAL_FEN } from '../../src/lib/domain/chess';
import type { ChessDatabase } from '../../src/lib/data/database';
const databases: ChessDatabase[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const db of databases.splice(0)) await db.delete();
});
it('loads the archive even when the saved preferences cannot be decoded', async () => {
  const state = new AppState();
  const storage = new PersistenceController(state);
  databases.push(storage.db);
  const game = analysisGame();
  game.moves.push(moveEntry(INITIAL_FEN, 'e2e4', false));
  await storage.db.saveGame(game);
  const prefs = defaultPreferences();
  prefs.engine.hashMiB = 4096;
  prefs.lastGameId = game.id;
  await storage.db.savePreferences(prefs);
  expect(await storage.initialize()).toBeNull();
  expect(state.library).toHaveLength(1);
  expect(state.storageError).toContain('Saved settings were invalid');
  expect((await storage.db.game(game.id))?.moves).toHaveLength(1);
});
it('does not claim settings were saved when IndexedDB rejects the write', async () => {
  const session = new Session();
  databases.push(session.storage.db);
  session.state.dialog = 'appearance';
  const prefs = session.state.preferenceSnapshot();
  prefs.board = 'ocean';
  vi.spyOn(session.storage.db, 'savePreferences').mockRejectedValue(
    new DOMException('Quota exhausted', 'QuotaExceededError'),
  );
  try {
    await expect(session.applyPreferences(prefs)).rejects.toThrow(
      'could not be saved locally',
    );
    expect(session.state.preferences.board).toBe('ocean');
    expect(session.state.dialog).toBe('appearance');
    expect(session.state.storageError).toContain(
      'Local storage is unavailable',
    );
    expect(session.state.notice).toBeNull();
  } finally {
    session.dispose();
  }
});
