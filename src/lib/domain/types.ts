// Define serializable game, preference, and review contracts shared by layers.
import type { Color, Role } from 'chessops/types';
export type { Color, Role } from 'chessops/types';
export type View = 'home' | 'play' | 'study';
/** Who answers the other side: the bundled engine, or a second person. */
export type Opponent = 'bot' | 'human';
export type EngineMode = 'balanced' | 'aggressive' | 'human-like' | 'analysis';
export type Backend = 'auto' | 'portable' | 'simd128';
export type Result = '*' | '1-0' | '0-1' | '1/2-1/2';
export type Grade = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
export type BoardTheme = 'sage' | 'walnut' | 'ocean' | 'slate';
export type PieceSet = 'chessnut' | 'celtic' | 'cburnett';
export interface ComputeSettings {
  profile: 'full' | 'balanced' | 'responsive' | 'custom';
  depth: number;
  nodes: string;
  quantum: number;
  reportIntervalMs: number;
  timeMs: number | null;
}
export interface EngineSettings {
  backend: Backend;
  mode: EngineMode;
  /** 'elo' applies the nominal target; 'full' leaves the engine uncapped. */
  strength: 'elo' | 'full';
  elo: number;
  hashMiB: number;
  multiPv: number;
  seed: string;
  behaviors: Record<string, boolean>;
  parameters: Record<string, number>;
  compute: ComputeSettings;
}
export interface Preferences {
  version: 1;
  appearance: 'light' | 'dark' | 'system';
  board: BoardTheme;
  pieces: PieceSet;
  animations: boolean;
  sound: boolean;
  coordinates: boolean;
  legalMoves: boolean;
  lastMove: boolean;
  check: boolean;
  arrows: boolean;
  /** How many suggestion arrows study mode may draw (1-4). */
  arrowCount: number;
  /** Let a move be queued while the opponent is thinking. */
  premove: boolean;
  evaluation: boolean;
  engine: EngineSettings;
  /** Bot picked on Home; the game itself stores the bot it was played against. */
  botId: string | null;
  lastGameId: string | null;
}
export interface ClockState {
  initialMs: number;
  incrementMs: number;
  whiteMs: number;
  blackMs: number;
  running: Color | null;
  anchor: number | null;
}
export interface MoveEntry {
  uci: string;
  san: string;
  fen: string;
  color: Color;
  from: string;
  to: string;
  captured: Role | null;
  check: boolean;
  whiteMs: number;
  blackMs: number;
}
export interface GameRecord {
  version: 1;
  id: string;
  kind: 'play' | 'import';
  title: string;
  createdAt: number;
  updatedAt: number;
  startFen: string;
  chess960: boolean;
  human: Color;
  white: string;
  black: string;
  result: Result;
  termination: string;
  moves: MoveEntry[];
  clock: ClockState;
  /** Opponent the record was started against. */
  opponent: Opponent;
  /** Nominal Elo the engine played at when this record was created. */
  engineElo: number;
  /** Bot identity this record was started against, when it outlives the library. */
  botId: string | null;
  headers: Record<string, string>;
}
export interface NewGameOptions {
  side: Color | 'random';
  minutes: number;
  increment: number;
  chess960: boolean;
  position: number;
  opponent: Opponent;
  /** Which saved bot answers, when the opponent is a bot. */
  botId: string | null;
}
export interface ReviewPoint {
  ply: number;
  whiteCp: number;
  whiteMate: number | null;
  depth: number;
  nodes: string;
  bestMove: string | null;
  bestSan: string | null;
  pv: string[];
}
export interface ReviewRecord {
  version: 1;
  gameId: string;
  fingerprint: string;
  engineRevision: string;
  depth: number;
  nodeBudget: string;
  timeMs: number;
  updatedAt: number;
  points: ReviewPoint[];
  complete: boolean;
}
export interface MoveGrade {
  ply: number;
  grade: Grade;
  loss: number;
  bestSan: string | null;
}
