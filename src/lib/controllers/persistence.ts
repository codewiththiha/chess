// Save snapshots and restore local records without coupling IndexedDB to components.
import { ChessDatabase } from '../data/database';
import { SavedDataError } from '../data/errors';
import { clockSnapshot } from '../domain/clocks';
import { importPgn, exportPgn } from '../domain/pgn';
import type { AppState } from '../state/app.svelte';
import type { GameRecord } from '../domain/types';
export class PersistenceController {
  readonly db = new ChessDatabase();
  private saves = 0;
  constructor(private state: AppState) {}
  async initialize(): Promise<GameRecord | null> {
    const s = this.state;
    let game: GameRecord | null = null;
    try {
      try {
        const prefs = await this.db.preferences();
        if (prefs) s.preferences = prefs;
      } catch (error) {
        if (!(error instanceof SavedDataError)) throw error;
        s.storageError =
          'Saved settings were invalid. Defaults are in use; your games remain in the local library.';
      }
      if (s.preferences.lastGameId) {
        try {
          game = await this.db.game(s.preferences.lastGameId);
        } catch (error) {
          if (!(error instanceof SavedDataError)) throw error;
          s.storageError =
            'The last saved game was invalid and was not restored. Other games remain in the local library.';
        }
      }
      await this.refresh();
      return game;
    } catch (error) {
      this.unavailable(error);
      return null;
    }
  }
  private unavailable(error: unknown): void {
    this.state.storageError = `Local storage is unavailable. Export important games before leaving. ${error instanceof Error ? error.message : ''}`;
  }
  async save(): Promise<void> {
    const s = this.state;
    const ticket = ++this.saves;
    s.saving = true;
    const record = s.snapshot();
    record.clock = clockSnapshot(record.clock, performance.now());
    s.preferences.lastGameId = record.id;
    try {
      await this.db.saveGame(record);
      await this.db.savePreferences(s.preferenceSnapshot());
      if (ticket === this.saves) {
        s.saved = true;
        s.storageError = '';
        await this.refresh();
      }
    } catch (error) {
      s.saved = false;
      this.unavailable(error);
    } finally {
      if (ticket === this.saves) s.saving = false;
    }
  }
  async preferences(): Promise<void> {
    try {
      await this.db.savePreferences(this.state.preferenceSnapshot());
    } catch (error) {
      this.unavailable(error);
      throw new Error(
        'Preferences are active for this session but could not be saved locally.',
        { cause: error },
      );
    }
  }
  async refresh(): Promise<void> {
    this.state.library = await this.db.summaries();
  }
  async import(text: string): Promise<GameRecord[]> {
    const records = importPgn(text);
    await this.db.transaction('rw', this.db.games, async () => {
      for (const g of records) await this.db.saveGame(g);
    });
    await this.refresh();
    return records;
  }
  async rename(id: string, title: string): Promise<void> {
    const name = title.trim();
    if (!name || name.length > 120)
      throw new Error('Use a name between 1 and 120 characters.');
    const g = await this.db.game(id);
    if (!g) throw new Error('This game is no longer saved.');
    g.title = name;
    g.updatedAt = Date.now();
    await this.db.saveGame(g);
    if (this.state.record.id === id) this.state.record.title = name;
    await this.refresh();
  }
  async exportAll(): Promise<string> {
    const output: string[] = [];
    for (const summary of this.state.library) {
      const g = await this.db.game(summary.id);
      if (g) output.push(exportPgn(g));
    }
    return output.join('\n\n');
  }
  async remove(id: string): Promise<void> {
    await this.db.removeGame(id);
    await this.refresh();
  }
}
