// Own the SQLite WASM instance and serve SQL operations for the application thread.
/// <reference lib="webworker" />
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import wasmUrl from '@sqlite.org/sqlite-wasm/sqlite3.wasm?url';
import { SqlStore } from './sql-handle';
import type {
  SqlHandle,
  SqlValue,
  StoredBot,
  StoredGame,
  StoredReview,
} from './sql-handle';

type Sqlite3 = Awaited<ReturnType<typeof sqlite3InitModule>>;
type Oo1Database = InstanceType<Sqlite3['oo1']['DB']>;

interface Request {
  id?: number;
  method?: string;
  args?: unknown[];
}

const scope = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<Request>) => void,
  ): void;
};

const DATABASE = '/gwaymaegyi-chess.sqlite3';
let store: SqlStore | null = null;

function handleFor(database: Oo1Database): SqlHandle {
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

export interface OpenResult {
  persistent: boolean;
  version: string;
  notes: string;
}

const init = sqlite3InitModule as unknown as (options?: {
  locateFile?: (path: string) => string;
}) => Promise<Sqlite3Static>;

async function open(): Promise<OpenResult> {
  const sqlite3 = await init({ locateFile: () => wasmUrl });
  const version = sqlite3.version.libVersion;
  try {
    // The shared-access-handle pool VFS persists to the origin private file system
    // without requiring cross-origin isolation headers.
    const pool = await sqlite3.installOpfsSAHPoolVfs({
      name: 'gwaymaegyi-chess',
      directory: '/gwaymaegyi-chess',
    });
    store = new SqlStore(handleFor(new pool.OpfsSAHPoolDb(DATABASE)));
    store.migrate();
    return { persistent: true, version, notes: '' };
  } catch (error) {
    // Without persistent storage the session still works, but the app must say so.
    store = new SqlStore(handleFor(new sqlite3.oo1.DB(':memory:', 'ct')));
    store.migrate();
    return {
      persistent: false,
      version,
      notes: error instanceof Error ? error.message : String(error),
    };
  }
}

function asText(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be text.`);
  return value;
}

function asNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error(`${field} must be a number.`);
  return value;
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${field} must be an object.`);
  return value as Record<string, unknown>;
}

function asGame(value: unknown): StoredGame {
  const row = asRecord(value, 'game');
  return {
    id: asText(row.id, 'game id'),
    dedupe: asText(row.dedupe, 'game identity'),
    title: asText(row.title, 'game title'),
    kind: asText(row.kind, 'game kind'),
    opponent: asText(row.opponent, 'opponent'),
    createdAt: asNumber(row.createdAt, 'creation time'),
    updatedAt: asNumber(row.updatedAt, 'update time'),
    startFen: asText(row.startFen, 'starting position'),
    chess960: asNumber(row.chess960, 'Chess960 flag'),
    human: asText(row.human, 'human color'),
    white: asText(row.white, 'White name'),
    black: asText(row.black, 'Black name'),
    result: asText(row.result, 'result'),
    termination: asText(row.termination, 'termination'),
    moves: asText(row.moves, 'move list'),
    clock: asText(row.clock, 'clock'),
    engineElo: asNumber(row.engineElo, 'engine Elo'),
    botId: typeof row.botId === 'string' ? row.botId : null,
    headers: asText(row.headers, 'headers'),
  };
}

function asBot(value: unknown): StoredBot {
  const row = asRecord(value, 'bot');
  return {
    id: asText(row.id, 'bot id'),
    name: asText(row.name, 'bot name'),
    category: asText(row.category, 'bot category'),
    elo: asNumber(row.elo, 'bot Elo'),
    strength: asText(row.strength, 'bot strength'),
    mode: asText(row.mode, 'bot style'),
    blurb: asText(row.blurb, 'bot description'),
    voice: asText(row.voice, 'bot voice'),
    avatar: typeof row.avatar === 'string' ? row.avatar : null,
    behaviors: asText(row.behaviors, 'bot behaviors'),
    parameters: asText(row.parameters, 'bot parameters'),
    createdAt: asNumber(row.createdAt, 'bot creation time'),
    updatedAt: asNumber(row.updatedAt, 'bot update time'),
  };
}

function asReview(value: unknown): StoredReview {
  const row = asRecord(value, 'review');
  return {
    gameId: asText(row.gameId, 'review game'),
    fingerprint: asText(row.fingerprint, 'review fingerprint'),
    engineRevision: asText(row.engineRevision, 'engine revision'),
    depth: asNumber(row.depth, 'review depth'),
    nodeBudget: asText(row.nodeBudget, 'review node budget'),
    timeMs: asNumber(row.timeMs, 'review time'),
    updatedAt: asNumber(row.updatedAt, 'review update time'),
    complete: asNumber(row.complete, 'review completion'),
    points: asText(row.points, 'review points'),
  };
}

function dispatch(method: string, args: unknown[]): unknown {
  if (!store) throw new Error('The local database is not open yet.');
  switch (method) {
    case 'setting':
      return store.setting(asText(args[0], 'setting key'));
    case 'setSetting':
      return store.setSetting(
        asText(args[0], 'setting key'),
        asText(args[1], 'setting value'),
      );
    case 'gameCount':
      return store.gameCount();
    case 'readGame':
      return store.readGame(asText(args[0], 'game id'));
    case 'listSummaries':
      return store.listSummaries();
    case 'allGames':
      return store.allGames();
    case 'writeGame':
      return store.writeGame(asGame(args[0]));
    case 'deleteGame':
      return store.deleteGame(asText(args[0], 'game id'));
    case 'readReview':
      return store.readReview(asText(args[0], 'game id'));
    case 'writeReview':
      return store.writeReview(asReview(args[0]));
    case 'deleteReview':
      return store.deleteReview(asText(args[0], 'game id'));
    case 'listBots':
      return store.listBots();
    case 'writeBot':
      return store.writeBot(asBot(args[0]));
    case 'deleteBot':
      return store.deleteBot(asText(args[0], 'bot id'));
    default:
      throw new Error(`Unsupported database operation: ${method}.`);
  }
}

scope.addEventListener('message', (event) => {
  const request = event.data;
  if (!request || typeof request.id !== 'number') return;
  const id = request.id;
  if (typeof request.method !== 'string') {
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- Worker messages take transferables, not Window targetOrigin.
    scope.postMessage({ type: 'failure', id, message: 'Invalid request.' });
    return;
  }
  try {
    const value = dispatch(request.method, request.args ?? []);
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- Worker messages take transferables, not Window targetOrigin.
    scope.postMessage({ type: 'result', id, value: value ?? null });
  } catch (error) {
    const failure = {
      type: 'failure',
      id,
      message: error instanceof Error ? error.message : String(error),
    };
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- Worker messages take transferables, not Window targetOrigin.
    scope.postMessage(failure);
  }
});

void open()
  .then((result) => {
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- Worker messages take transferables, not Window targetOrigin.
    scope.postMessage({ ...result, type: 'ready' });
  })
  .catch((error: unknown) => {
    const failure = {
      type: 'failed',
      message: error instanceof Error ? error.message : String(error),
    };
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- Worker messages take transferables, not Window targetOrigin.
    scope.postMessage(failure);
  });
