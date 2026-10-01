// Persist plain snapshots transactionally in IndexedDB, with bounded restoration.
import Dexie from 'dexie';
import type { Table } from 'dexie';
import {
  decodeGame,
  decodePreferences,
  object,
  text,
  choice,
  bool,
  timestamp,
} from './validation';
import { decodeReview } from './review-validation';
import { SavedDataError } from './errors';
import { position } from '../domain/chess';
import type { GameRecord, Preferences, ReviewRecord } from '../domain/types';
export interface GameSummary {
  id: string;
  title: string;
  white: string;
  black: string;
  kind: 'play' | 'analysis';
  createdAt: number;
  updatedAt: number;
  result: string;
  plies: number;
  fen: string;
  chess960: boolean;
}
export class ChessDatabase extends Dexie {
  games!: Table<GameRecord, string>;
  reviews!: Table<ReviewRecord, string>;
  settings!: Table<{ key: string; value: Preferences }, string>;
  constructor(name = 'gwaymaegyi-chess') {
    super(name);
    this.version(1).stores({
      games: 'id,updatedAt,createdAt,kind,result',
      reviews: 'gameId,updatedAt',
      settings: 'key',
    });
  }
  async preferences(): Promise<Preferences | null> {
    const row = await this.settings.get('preferences');
    if (!row) return null;
    try {
      return decodePreferences(row.value);
    } catch (error) {
      throw new SavedDataError('Saved settings are invalid.', error);
    }
  }
  async savePreferences(value: Preferences): Promise<void> {
    await this.settings.put({ key: 'preferences', value });
  }
  async game(id: string): Promise<GameRecord | null> {
    const value: unknown = await this.games.get(id);
    if (!value) return null;
    try {
      return decodeGame(value);
    } catch (error) {
      throw new SavedDataError('This saved game has invalid data.', error);
    }
  }
  async review(game: GameRecord): Promise<ReviewRecord | null> {
    const value: unknown = await this.reviews.get(game.id);
    if (!value) return null;
    try {
      return decodeReview(value, game);
    } catch (error) {
      throw new SavedDataError('This saved review has invalid data.', error);
    }
  }
  async saveGame(record: GameRecord): Promise<void> {
    await this.games.put(record);
  }
  async summaries(): Promise<GameSummary[]> {
    // oxlint-disable-next-line unicorn/no-array-reverse -- This is Dexie's indexed query order, not Array mutation.
    const records = await this.games.orderBy('updatedAt').reverse().toArray();
    const list: GameSummary[] = [];
    for (const raw of records) {
      try {
        const g = object(raw);
        if (
          g.version !== 1 ||
          typeof g.id !== 'string' ||
          typeof g.title !== 'string' ||
          !Array.isArray(g.moves) ||
          !g.moves.length
        )
          continue;
        const fen = text(object(g.moves.at(-1)).fen, 256);
        position(fen);
        list.push({
          id: text(g.id, 128),
          title: text(g.title, 120),
          white: text(g.white, 120),
          black: text(g.black, 120),
          kind: choice(g.kind, ['play', 'analysis']),
          createdAt: timestamp(g.createdAt),
          updatedAt: timestamp(g.updatedAt),
          result: choice(g.result, ['*', '1-0', '0-1', '1/2-1/2']),
          plies: g.moves.length,
          fen,
          chess960: bool(g.chess960),
        });
      } catch {
        /* A corrupt row stays exportable through browser storage, not playable. */
      }
    }
    return list;
  }
  async removeGame(id: string): Promise<void> {
    await this.transaction('rw', this.games, this.reviews, async () => {
      await this.games.delete(id);
      await this.reviews.delete(id);
    });
  }
}
