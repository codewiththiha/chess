// Read the retired IndexedDB library once so existing games can move into SQLite.
import { decodeGame, decodePreferences } from './validation';
import { SavedDataError } from './errors';
import type { GameRecord, Preferences, ReviewRecord } from '../domain/types';

export interface LegacyLibrary {
  games: GameRecord[];
  reviews: unknown[];
  preferences: Preferences | null;
}

const LEGACY_NAME = 'gwaymaegyi-chess';

async function openExisting(): Promise<IDBDatabase | null> {
  if (!globalThis.indexedDB) return null;
  const databases = await indexedDB.databases?.().catch(() => []);
  if (databases && !databases.some((entry) => entry.name === LEGACY_NAME))
    return null;
  return new Promise<IDBDatabase | null>((resolve) => {
    let created = false;
    const opening = indexedDB.open(LEGACY_NAME);
    opening.addEventListener('upgradeneeded', () => {
      created = true;
      opening.transaction?.abort();
    });
    opening.addEventListener('error', () => {
      resolve(null);
    });
    opening.addEventListener('blocked', () => {
      resolve(null);
    });
    opening.addEventListener('success', () => {
      const database = opening.result;
      if (created) {
        database.close();
        resolve(null);
        return;
      }
      resolve(database);
    });
  });
}

function readAll<T>(database: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve) => {
    if (!database.objectStoreNames.contains(store)) {
      resolve([]);
      return;
    }
    try {
      const transaction = database.transaction(store, 'readonly');
      const source = transaction.objectStore(store).getAll();
      source.addEventListener('success', () => {
        resolve(Array.isArray(source.result) ? (source.result as T[]) : []);
      });
      source.addEventListener('error', () => {
        resolve([]);
      });
    } catch {
      resolve([]);
    }
  });
}

/** Returns null when there is no earlier library to import. */
export async function readLegacyLibrary(): Promise<LegacyLibrary | null> {
  const database = await openExisting();
  if (!database) return null;
  try {
    const [gameRows, reviewRows, settingRows] = await Promise.all([
      readAll<unknown>(database, 'games'),
      readAll<unknown>(database, 'reviews'),
      readAll<{ key?: unknown; value?: unknown }>(database, 'settings'),
    ]);
    const games: GameRecord[] = [];
    for (const row of gameRows) {
      try {
        games.push(decodeGame(row));
      } catch (error) {
        if (!(error instanceof SavedDataError)) continue;
      }
    }
    let preferences: Preferences | null = null;
    const stored = settingRows.find((row) => row?.key === 'preferences')?.value;
    if (stored !== undefined) {
      try {
        preferences = decodePreferences(stored);
      } catch {
        preferences = null;
      }
    }
    const reviews: unknown[] = [];
    for (const row of reviewRows) reviews.push(row);
    return { games, reviews, preferences };
  } finally {
    database.close();
  }
}

export function reviewGameId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const id = (value as { gameId?: unknown }).gameId;
  return typeof id === 'string' ? id : null;
}

export type { ReviewRecord };
