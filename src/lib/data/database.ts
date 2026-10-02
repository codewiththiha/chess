// Store validated games, reviews, and preferences in the local SQLite database.
import {
  decodeGame,
  decodePreferences,
  text,
  choice,
  timestamp,
} from './validation';
import { decodeReview } from './review-validation';
import { SavedDataError } from './errors';
import { SqlClient } from './sql-client';
import type { DatabaseStatus } from './sql-client';
import type {
  SqlValue,
  StoredGame,
  StoredReview,
  StoredSummary,
} from './sql-handle';
import { gameIdentity, isStoredGame } from '../domain/identity';
import { position } from '../domain/chess';
import type { GameRecord, Preferences, ReviewRecord } from '../domain/types';

export interface GameSummary {
  id: string;
  title: string;
  white: string;
  black: string;
  kind: 'play' | 'import';
  createdAt: number;
  updatedAt: number;
  result: string;
  plies: number;
  fen: string;
  chess960: boolean;
  reviewed: boolean;
  reviewComplete: boolean;
}

function parse(value: string, what: string): unknown {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new SavedDataError(`Stored ${what} is not valid data.`, error);
  }
}

function encode(record: GameRecord): StoredGame {
  return {
    id: record.id,
    dedupe: gameIdentity(record),
    title: record.title,
    kind: record.kind,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    startFen: record.startFen,
    chess960: record.chess960 ? 1 : 0,
    human: record.human,
    white: record.white,
    black: record.black,
    result: record.result,
    termination: record.termination,
    moves: JSON.stringify(record.moves),
    clock: JSON.stringify(record.clock),
    engineLevel: record.engineLevel,
    headers: JSON.stringify(record.headers),
  };
}

function decodeGameRow(row: StoredGame): GameRecord {
  try {
    return decodeGame({
      version: 1,
      id: row.id,
      kind: row.kind,
      title: row.title,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      startFen: row.startFen,
      chess960: row.chess960 === 1,
      human: row.human,
      white: row.white,
      black: row.black,
      result: row.result,
      termination: row.termination,
      moves: parse(row.moves, 'move list'),
      clock: parse(row.clock, 'clock'),
      engineLevel: row.engineLevel,
      headers: parse(row.headers, 'headers'),
    });
  } catch (error) {
    if (error instanceof SavedDataError) throw error;
    throw new SavedDataError('This saved game has invalid data.', error);
  }
}

export class ChessDatabase {
  private readonly client = new SqlClient();

  open(): Promise<DatabaseStatus> {
    return this.client.open();
  }

  get persistent(): boolean {
    return this.client.persistent;
  }

  get version(): string {
    return this.client.version;
  }

  get notes(): string {
    return this.client.notes;
  }

  close(): void {
    this.client.close();
  }

  private call<T>(method: string, ...args: unknown[]): Promise<T> {
    return this.client.call<T>(method, ...args);
  }

  async meta(key: string): Promise<string | null> {
    return this.call<string | null>('setting', key);
  }

  async setMeta(key: string, value: string): Promise<void> {
    await this.call('setSetting', key, value);
  }

  async preferences(): Promise<Preferences | null> {
    const value = await this.meta('preferences');
    if (value === null) return null;
    try {
      return decodePreferences(parse(value, 'settings'));
    } catch (error) {
      throw new SavedDataError('Saved settings are invalid.', error);
    }
  }

  async savePreferences(preferences: Preferences): Promise<void> {
    await this.setMeta('preferences', JSON.stringify(preferences));
  }

  async summaries(): Promise<GameSummary[]> {
    const rows = await this.call<StoredSummary[]>('listSummaries');
    const list: GameSummary[] = [];
    for (const row of rows) {
      try {
        if (
          typeof row.id !== 'string' ||
          typeof row.title !== 'string' ||
          !row.plies
        )
          continue;
        const fen = text(row.fen, 256);
        position(fen);
        list.push({
          id: text(row.id, 128),
          title: text(row.title, 120),
          white: text(row.white, 120),
          black: text(row.black, 120),
          kind: choice(row.kind, ['play', 'import']),
          createdAt: timestamp(row.createdAt),
          updatedAt: timestamp(row.updatedAt),
          result: choice(row.result, ['*', '1-0', '0-1', '1/2-1/2']),
          plies: row.plies,
          fen,
          chess960: row.chess960 === 1,
          reviewed: row.reviewed === 1,
          reviewComplete: row.reviewComplete === 1,
        });
      } catch {
        /* A corrupt row stays in the database but is not offered as playable. */
      }
    }
    return list;
  }

  async game(id: string): Promise<GameRecord | null> {
    const row = await this.call<StoredGame | null>('readGame', id);
    return row ? decodeGameRow(row) : null;
  }

  async allGames(): Promise<GameRecord[]> {
    const rows = await this.call<StoredGame[]>('allGames');
    const games: GameRecord[] = [];
    for (const row of rows) {
      try {
        games.push(decodeGameRow(row));
      } catch {
        /* Skip unreadable rows instead of failing a whole export. */
      }
    }
    return games;
  }

  /** Store one game per identical play, returning the surviving record id. */
  async saveGame(record: GameRecord): Promise<{ id: string; merged: boolean }> {
    if (!isStoredGame(record)) return { id: record.id, merged: false };
    return this.call<{ id: string; merged: boolean }>(
      'writeGame',
      encode(record),
    );
  }

  async saveGames(records: GameRecord[]): Promise<void> {
    for (const record of records) await this.saveGame(record);
  }

  async removeGame(id: string): Promise<void> {
    await this.call('deleteGame', id);
  }

  async review(game: GameRecord): Promise<ReviewRecord | null> {
    const row = await this.call<StoredReview | null>('readReview', game.id);
    if (!row) return null;
    try {
      return decodeReview(
        {
          version: 1,
          gameId: row.gameId,
          fingerprint: row.fingerprint,
          engineRevision: row.engineRevision,
          depth: row.depth,
          nodeBudget: row.nodeBudget,
          timeMs: row.timeMs,
          updatedAt: row.updatedAt,
          complete: row.complete === 1,
          points: parse(row.points, 'review positions'),
        },
        game,
      );
    } catch (error) {
      if (error instanceof SavedDataError) throw error;
      throw new SavedDataError('This saved review has invalid data.', error);
    }
  }

  async saveReview(record: ReviewRecord): Promise<void> {
    const row: StoredReview = {
      gameId: record.gameId,
      fingerprint: record.fingerprint,
      engineRevision: record.engineRevision,
      depth: record.depth,
      nodeBudget: record.nodeBudget,
      timeMs: record.timeMs,
      updatedAt: record.updatedAt,
      complete: record.complete ? 1 : 0,
      points: JSON.stringify(record.points),
    };
    await this.call('writeReview', row);
  }

  /** Import one stored review only when it still matches the legal game. */
  async importReview(raw: unknown, game: GameRecord): Promise<boolean> {
    try {
      await this.saveReview(decodeReview(raw, game));
      return true;
    } catch {
      return false;
    }
  }

  async countGames(): Promise<number> {
    return this.call<number>('gameCount');
  }
}

export type { SqlValue };
