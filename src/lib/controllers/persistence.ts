// Save snapshots and restore records from the local SQLite database.
import { ChessDatabase } from '../data/database';
import { SavedDataError } from '../data/errors';
import { readLegacyLibrary, reviewGameId } from '../data/legacy-indexeddb';
import { devBots, upsertBot, removeBot as dropBot } from '../domain/bots';
import type { BotProfile } from '../domain/bots';
import { clockSnapshot } from '../domain/clocks';
import { importPgn, exportPgn } from '../domain/pgn';
import type { AppState } from '../state/app.svelte';
import type { GameRecord } from '../domain/types';

const LEGACY_KEY = 'legacy-indexeddb-imported';

export class PersistenceController {
  readonly db = new ChessDatabase();
  private saves = 0;
  private preferencesApplied = false;
  onMerged: () => void = () => {};
  constructor(private readonly state: AppState) {}

  async initialize(): Promise<GameRecord | null> {
    const s = this.state;
    try {
      const status = await this.db.open();
      if (status.persistent) await this.importLegacy();
      else
        s.storageError =
          `Local storage could not be opened for permanent use, so games last only until this tab closes. ${status.notes}`.trim();
      try {
        const prefs = await this.db.preferences();
        // A settings save may have landed while this read was in flight.
        if (prefs && !this.preferencesApplied) s.preferences = prefs;
      } catch (error) {
        if (!(error instanceof SavedDataError)) throw error;
        s.storageError =
          'Saved settings were invalid. Defaults are in use; your games remain in the local library.';
      }
      await this.loadBots();
      let game: GameRecord | null = null;
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

  /** Shipped bots are code; the reader's are rows that must survive a reload. */
  private async loadBots(): Promise<void> {
    const stored = await this.db.bots();
    this.state.bots = stored.reduce(
      (list, bot) => upsertBot(list, bot),
      devBots(),
    );
  }

  async saveBot(bot: BotProfile): Promise<void> {
    await this.db.saveBot(bot);
    this.state.bots = upsertBot(this.state.bots, bot);
    this.state.preferences.botId = bot.id;
    await this.preferences();
  }

  async deleteBot(id: string): Promise<void> {
    await this.db.removeBot(id);
    this.state.bots = dropBot(this.state.bots, id);
    if (this.state.preferences.botId === id) {
      this.state.preferences.botId =
        this.state.bots.find((bot) => bot.category === 'dev')?.id ?? null;
      await this.preferences();
    }
  }

  /** Move the retired IndexedDB library into SQLite once, keeping reviews attached. */
  private async importLegacy(): Promise<void> {
    if (await this.db.meta(LEGACY_KEY)) return;
    const legacy = await readLegacyLibrary();
    if (!legacy) {
      await this.db.setMeta(LEGACY_KEY, new Date().toISOString());
      return;
    }
    const ids = new Map<string, string>();
    let games = 0;
    for (const record of legacy.games) {
      try {
        const { id } = await this.db.saveGame(record);
        ids.set(record.id, id);
        games += 1;
      } catch {
        /* An unreadable legacy row does not block the rest of the import. */
      }
    }
    let reviews = 0;
    for (const raw of legacy.reviews) {
      const previous = reviewGameId(raw);
      const record = await this.db.game(
        (previous && ids.get(previous)) ?? previous ?? '',
      );
      if (!record) continue;
      if (await this.db.importReview(raw, record)) reviews += 1;
    }
    if (legacy.preferences && !(await this.db.preferences()))
      await this.db.savePreferences(legacy.preferences);
    await this.db.setMeta(LEGACY_KEY, new Date().toISOString());
    if (games || reviews)
      this.state.notice = {
        text: `Imported ${games} saved ${games === 1 ? 'game' : 'games'}${reviews ? ` and ${reviews} ${reviews === 1 ? 'review' : 'reviews'}` : ''} from the previous local database.`,
        error: false,
      };
  }

  private unavailable(error: unknown): void {
    this.state.storageError = `Local storage is unavailable. Export important games before leaving. ${error instanceof Error ? error.message : ''}`;
  }

  async save(): Promise<void> {
    const s = this.state;
    const record = s.snapshot();
    // An untouched board is not a game worth keeping.
    if (!record.moves.length) return;
    const ticket = ++this.saves;
    s.saving = true;
    record.clock = clockSnapshot(record.clock, performance.now());
    try {
      const result = await this.db.saveGame(record);
      if (result.id !== s.record.id) {
        // Identical play already existed; adopt the surviving record and its review.
        s.record.id = result.id;
        const review = s.reviewSnapshot();
        if (review && review.gameId !== result.id) {
          review.gameId = result.id;
          await this.db.saveReview(review);
          s.review = review;
        }
      }
      s.preferences.lastGameId = s.record.id;
      this.preferencesApplied = true;
      await this.db.savePreferences(s.preferenceSnapshot());
      if (ticket === this.saves) {
        s.saved = true;
        s.storageError = '';
        await this.refresh();
      }
      if (result.merged) this.onMerged();
    } catch (error) {
      s.saved = false;
      this.unavailable(error);
    } finally {
      if (ticket === this.saves) s.saving = false;
    }
  }

  async preferences(): Promise<void> {
    this.preferencesApplied = true;
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
    await this.db.saveGames(records);
    await this.refresh();
    return records;
  }

  async rename(id: string, title: string): Promise<void> {
    const name = title.trim();
    if (!name || name.length > 120)
      throw new Error('Use a name between 1 and 120 characters.');
    const record = await this.db.game(id);
    if (!record) throw new Error('This game is no longer saved.');
    record.title = name;
    record.updatedAt = Date.now();
    await this.db.saveGame(record);
    if (this.state.record.id === id) this.state.record.title = name;
    await this.refresh();
  }

  async exportAll(): Promise<string> {
    const games = await this.db.allGames();
    return games.map((record) => exportPgn(record)).join('\n\n');
  }

  async remove(id: string): Promise<void> {
    await this.db.removeGame(id);
    await this.refresh();
  }
}
