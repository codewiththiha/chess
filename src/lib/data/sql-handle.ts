// Define the SQLite schema and synchronous record operations over a SQL handle.
import { SavedDataError } from './errors';

export type SqlValue = string | number | null;

export interface SqlHandle {
  selectObjects(sql: string, params?: SqlValue[]): Record<string, unknown>[];
  exec(sql: string, params?: SqlValue[]): void;
  close(): void;
}

export interface StoredGame {
  id: string;
  dedupe: string;
  title: string;
  kind: string;
  opponent: string;
  createdAt: number;
  updatedAt: number;
  startFen: string;
  chess960: number;
  human: string;
  white: string;
  black: string;
  result: string;
  termination: string;
  moves: string;
  clock: string;
  engineElo: number;
  botId: string | null;
  headers: string;
}

export interface StoredBot {
  id: string;
  name: string;
  category: string;
  elo: number;
  strength: string;
  mode: string;
  blurb: string;
  avatar: string | null;
  behaviors: string;
  parameters: string;
  createdAt: number;
  updatedAt: number;
}

export interface StoredReview {
  gameId: string;
  fingerprint: string;
  engineRevision: string;
  depth: number;
  nodeBudget: string;
  timeMs: number;
  updatedAt: number;
  complete: number;
  points: string;
}

export interface StoredSummary {
  id: string;
  title: string;
  white: string;
  black: string;
  kind: string;
  createdAt: number;
  updatedAt: number;
  result: string;
  plies: number;
  fen: string;
  chess960: number;
  reviewed: number;
  reviewComplete: number;
}

export interface WriteResult {
  id: string;
  merged: boolean;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS games (
     id TEXT PRIMARY KEY,
     dedupe TEXT NOT NULL,
     title TEXT NOT NULL,
     kind TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     start_fen TEXT NOT NULL,
     chess960 INTEGER NOT NULL,
     human TEXT NOT NULL,
     white TEXT NOT NULL,
     black TEXT NOT NULL,
     result TEXT NOT NULL,
     termination TEXT NOT NULL,
     moves TEXT NOT NULL,
     clock TEXT NOT NULL,
     engine_elo INTEGER NOT NULL,
     headers TEXT NOT NULL,
     bot_id TEXT,
     reviewed INTEGER NOT NULL DEFAULT 0
   )`,
  `CREATE INDEX IF NOT EXISTS games_dedupe ON games (dedupe)`,
  `CREATE INDEX IF NOT EXISTS games_updated ON games (updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS reviews (
     game_id TEXT PRIMARY KEY,
     fingerprint TEXT NOT NULL,
     engine_revision TEXT NOT NULL,
     depth INTEGER NOT NULL,
     node_budget TEXT NOT NULL,
     time_ms INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     complete INTEGER NOT NULL,
     points TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS bots (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     category TEXT NOT NULL,
     elo INTEGER NOT NULL,
     strength TEXT NOT NULL,
     mode TEXT NOT NULL,
     blurb TEXT NOT NULL,
     avatar TEXT,
     behaviors TEXT NOT NULL,
     parameters TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS bots_category ON bots (category, elo DESC)`,
  `CREATE TABLE IF NOT EXISTS settings (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL
   )`,
];

const GAME_FIELDS = [
  'id',
  'dedupe',
  'title',
  'kind',
  'created_at',
  'updated_at',
  'start_fen',
  'chess960',
  'human',
  'white',
  'black',
  'result',
  'termination',
  'moves',
  'clock',
  'engine_elo',
  'headers',
  'opponent',
  'bot_id',
];
const GAME_COLUMNS = `${GAME_FIELDS.join(', ')}, reviewed`;
const GAME_WRITE_COLUMNS = GAME_FIELDS.join(', ');
const GAME_PLACEHOLDERS = GAME_FIELDS.map(() => '?').join(', ');

function integer(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new SavedDataError(`Stored ${field} is not a number.`);
  return Math.trunc(value);
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string')
    throw new SavedDataError(`Stored ${field} is not text.`);
  return value;
}

export class SqlStore {
  constructor(private readonly handle: SqlHandle) {}

  migrate(): void {
    for (const statement of SCHEMA) this.handle.exec(statement);
    this.upgradeLegacyColumns();
  }

  /** Databases written before the Elo/opponent model are upgraded in place. */
  private upgradeLegacyColumns(): void {
    const columns = new Set(
      this.handle
        .selectObjects('PRAGMA table_info(games)')
        .map((row) => String(row.name)),
    );
    if (columns.has('engine_level') && !columns.has('engine_elo'))
      this.handle.exec(
        'ALTER TABLE games RENAME COLUMN engine_level TO engine_elo',
      );
    if (!columns.has('opponent'))
      this.handle.exec(
        "ALTER TABLE games ADD COLUMN opponent TEXT NOT NULL DEFAULT 'bot'",
      );
    if (!columns.has('bot_id'))
      this.handle.exec('ALTER TABLE games ADD COLUMN bot_id TEXT');
  }

  setting(key: string): string | null {
    const value = this.handle.selectObjects(
      'SELECT value FROM settings WHERE key = ?',
      [key],
    )[0]?.value;
    return typeof value === 'string' ? value : null;
  }

  setSetting(key: string, value: string): void {
    this.handle.exec(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    );
  }

  gameCount(): number {
    return integer(
      this.handle.selectObjects('SELECT COUNT(*) AS total FROM games')[0]
        ?.total,
      'game count',
    );
  }

  readGame(id: string): StoredGame | null {
    const row = this.handle.selectObjects(
      `SELECT ${GAME_COLUMNS} FROM games WHERE id = ?`,
      [id],
    )[0];
    return row ? SqlStore.decodeGame(row) : null;
  }

  private static decodeGame(row: Record<string, unknown>): StoredGame {
    return {
      id: text(row.id, 'game id'),
      dedupe: text(row.dedupe, 'game identity'),
      title: text(row.title, 'game title'),
      kind: text(row.kind, 'game kind'),
      createdAt: integer(row.created_at, 'creation time'),
      updatedAt: integer(row.updated_at, 'update time'),
      startFen: text(row.start_fen, 'starting position'),
      chess960: integer(row.chess960, 'Chess960 flag'),
      human: text(row.human, 'human color'),
      white: text(row.white, 'White name'),
      black: text(row.black, 'Black name'),
      result: text(row.result, 'result'),
      termination: text(row.termination, 'termination'),
      moves: text(row.moves, 'move list'),
      clock: text(row.clock, 'clock'),
      engineElo: integer(row.engine_elo, 'engine Elo'),
      headers: text(row.headers, 'headers'),
      opponent: text(row.opponent, 'opponent'),
      botId: typeof row.bot_id === 'string' ? row.bot_id : null,
    };
  }

  listSummaries(): StoredSummary[] {
    const rows = this.handle.selectObjects(`
      SELECT g.id AS id, g.title AS title, g.white AS white, g.black AS black,
             g.kind AS kind, g.created_at AS created_at, g.updated_at AS updated_at,
             g.result AS result, g.chess960 AS chess960, g.moves AS moves,
             g.reviewed AS reviewed, r.complete AS review_complete
      FROM games g LEFT JOIN reviews r ON r.game_id = g.id
      ORDER BY g.updated_at DESC
    `);
    return rows.map((row) => {
      const encoded = text(row.moves, 'move list');
      let plies = 0;
      let fen = '';
      try {
        const parsed: unknown = JSON.parse(encoded);
        if (Array.isArray(parsed)) {
          plies = parsed.length;
          const last: unknown = parsed.at(-1);
          const candidate =
            last && typeof last === 'object'
              ? (last as { fen?: unknown }).fen
              : undefined;
          if (typeof candidate === 'string') fen = candidate;
        }
      } catch {
        plies = 0;
      }
      return {
        id: text(row.id, 'game id'),
        title: text(row.title, 'game title'),
        white: text(row.white, 'White name'),
        black: text(row.black, 'Black name'),
        kind: text(row.kind, 'game kind'),
        createdAt: integer(row.created_at, 'creation time'),
        updatedAt: integer(row.updated_at, 'update time'),
        result: text(row.result, 'result'),
        plies,
        fen,
        chess960: integer(row.chess960, 'Chess960 flag'),
        reviewed: integer(row.reviewed ?? 0, 'reviewed flag'),
        reviewComplete: integer(row.review_complete ?? 0, 'review completion'),
      };
    });
  }

  allGames(): StoredGame[] {
    return this.handle
      .selectObjects(
        `SELECT ${GAME_COLUMNS} FROM games ORDER BY updated_at DESC`,
      )
      .map((row) => SqlStore.decodeGame(row));
  }

  /** Write game fields without touching `reviewed`, which only reviews own. */
  private write(row: StoredGame, id: string): void {
    this.handle.exec(
      `INSERT INTO games (${GAME_WRITE_COLUMNS})
       VALUES (${GAME_PLACEHOLDERS})
       ON CONFLICT(id) DO UPDATE SET
         dedupe = excluded.dedupe, title = excluded.title, kind = excluded.kind,
         created_at = excluded.created_at, updated_at = excluded.updated_at,
         start_fen = excluded.start_fen, chess960 = excluded.chess960, human = excluded.human,
         white = excluded.white, black = excluded.black, result = excluded.result,
         termination = excluded.termination, moves = excluded.moves, clock = excluded.clock,
         engine_elo = excluded.engine_elo, headers = excluded.headers,
         opponent = excluded.opponent, bot_id = excluded.bot_id`,
      [
        id,
        row.dedupe,
        row.title,
        row.kind,
        row.createdAt,
        row.updatedAt,
        row.startFen,
        row.chess960,
        row.human,
        row.white,
        row.black,
        row.result,
        row.termination,
        row.moves,
        row.clock,
        row.engineElo,
        row.headers,
        row.opponent,
        row.botId,
      ],
    );
  }

  /** The reader's own bots, newest Elo first; shipped bots live in the code. */
  listBots(): StoredBot[] {
    return this.handle
      .selectObjects(
        `SELECT id, name, category, elo, strength, mode, blurb, avatar,
                behaviors, parameters, created_at, updated_at
         FROM bots ORDER BY elo DESC, name ASC`,
      )
      .map((row) => SqlStore.decodeBot(row));
  }

  private static decodeBot(row: Record<string, unknown>): StoredBot {
    return {
      id: text(row.id, 'bot id'),
      name: text(row.name, 'bot name'),
      category: text(row.category, 'bot category'),
      elo: integer(row.elo, 'bot Elo'),
      strength: text(row.strength, 'bot strength'),
      mode: text(row.mode, 'bot style'),
      blurb: text(row.blurb, 'bot description'),
      avatar: typeof row.avatar === 'string' ? row.avatar : null,
      behaviors: text(row.behaviors, 'bot behaviors'),
      parameters: text(row.parameters, 'bot parameters'),
      createdAt: integer(row.created_at, 'bot creation time'),
      updatedAt: integer(row.updated_at, 'bot update time'),
    };
  }

  writeBot(row: StoredBot): void {
    this.handle.exec(
      `INSERT INTO bots (id, name, category, elo, strength, mode, blurb, avatar,
                         behaviors, parameters, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, category = excluded.category, elo = excluded.elo,
         strength = excluded.strength, mode = excluded.mode, blurb = excluded.blurb,
         avatar = excluded.avatar, behaviors = excluded.behaviors,
         parameters = excluded.parameters, updated_at = excluded.updated_at`,
      [
        row.id,
        row.name,
        row.category,
        row.elo,
        row.strength,
        row.mode,
        row.blurb,
        row.avatar,
        row.behaviors,
        row.parameters,
        row.createdAt,
        row.updatedAt,
      ],
    );
  }

  deleteBot(id: string): void {
    this.handle.exec('DELETE FROM bots WHERE id = ?', [id]);
  }

  private hasReview(id: string): boolean {
    return (
      this.handle.selectObjects(
        'SELECT 1 AS present FROM reviews WHERE game_id = ?',
        [id],
      ).length > 0
    );
  }

  private reviewedFlag(id: string): number {
    const value = this.handle.selectObjects(
      'SELECT reviewed FROM games WHERE id = ?',
      [id],
    )[0]?.reviewed;
    return value === 1 ? 1 : 0;
  }

  /**
   * Store a game, merging any record with identical play so one game stays one row.
   * A reviewed duplicate outranks an unreviewed one; otherwise the oldest creation
   * time survives, so repeated imports and mode switches never fork a game.
   */
  writeGame(row: StoredGame): WriteResult {
    const candidates = [
      {
        id: row.id,
        createdAt: row.createdAt,
        reviewed: this.reviewedFlag(row.id) === 1,
      },
      ...this.handle
        .selectObjects(
          'SELECT id, reviewed, created_at FROM games WHERE dedupe = ? AND id <> ?',
          [row.dedupe, row.id],
        )
        .map((value) => ({
          id: text(value.id, 'game id'),
          createdAt: integer(value.created_at, 'creation time'),
          reviewed: value.reviewed === 1,
        })),
    ];
    const survivor = candidates.reduce((best, candidate) => {
      if (candidate.reviewed !== best.reviewed)
        return candidate.reviewed ? candidate : best;
      if (candidate.createdAt !== best.createdAt)
        return candidate.createdAt < best.createdAt ? candidate : best;
      return best.id <= candidate.id ? best : candidate;
    });
    // A review may only live on the surviving record, so move it before deleting.
    for (const candidate of candidates) {
      if (candidate.id === survivor.id) continue;
      const hasReview = this.hasReview(candidate.id);
      if (hasReview && !this.hasReview(survivor.id))
        this.handle.exec(
          'UPDATE OR REPLACE reviews SET game_id = ? WHERE game_id = ?',
          [survivor.id, candidate.id],
        );
      else
        this.handle.exec('DELETE FROM reviews WHERE game_id = ?', [
          candidate.id,
        ]);
      this.handle.exec('DELETE FROM games WHERE id = ?', [candidate.id]);
    }
    this.write(row, survivor.id);
    // `merged` reports that identical play was already stored, not which id survived.
    return { id: survivor.id, merged: candidates.length > 1 };
  }

  deleteGame(id: string): void {
    this.handle.exec('DELETE FROM reviews WHERE game_id = ?', [id]);
    this.handle.exec('DELETE FROM games WHERE id = ?', [id]);
  }

  readReview(gameId: string): StoredReview | null {
    const row = this.handle.selectObjects(
      `SELECT game_id, fingerprint, engine_revision, depth, node_budget, time_ms,
              updated_at, complete, points
       FROM reviews WHERE game_id = ?`,
      [gameId],
    )[0];
    if (!row) return null;
    return {
      gameId: text(row.game_id, 'review game'),
      fingerprint: text(row.fingerprint, 'review fingerprint'),
      engineRevision: text(row.engine_revision, 'engine revision'),
      depth: integer(row.depth, 'review depth'),
      nodeBudget: text(row.node_budget, 'review node budget'),
      timeMs: integer(row.time_ms, 'review time'),
      updatedAt: integer(row.updated_at, 'review update time'),
      complete: integer(row.complete, 'review completion'),
      points: text(row.points, 'review points'),
    };
  }

  writeReview(row: StoredReview): void {
    this.handle.exec(
      `INSERT INTO reviews (game_id, fingerprint, engine_revision, depth, node_budget, time_ms, updated_at, complete, points)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(game_id) DO UPDATE SET
         fingerprint = excluded.fingerprint, engine_revision = excluded.engine_revision,
         depth = excluded.depth, node_budget = excluded.node_budget, time_ms = excluded.time_ms,
         updated_at = excluded.updated_at, complete = excluded.complete, points = excluded.points`,
      [
        row.gameId,
        row.fingerprint,
        row.engineRevision,
        row.depth,
        row.nodeBudget,
        row.timeMs,
        row.updatedAt,
        row.complete,
        row.points,
      ],
    );
    this.handle.exec('UPDATE games SET reviewed = ? WHERE id = ?', [
      row.complete === 1 ? 1 : 0,
      row.gameId,
    ]);
  }

  deleteReview(gameId: string): void {
    this.handle.exec('DELETE FROM reviews WHERE game_id = ?', [gameId]);
    this.handle.exec('UPDATE games SET reviewed = 0 WHERE id = ?', [gameId]);
  }
}
