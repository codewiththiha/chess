// Define serializable game, preference, and review contracts shared by layers.
import type { Color, Role } from 'chessops/types';
export type { Color, Role } from 'chessops/types';
export type View = 'play' | 'analyze' | 'review' | 'library';
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
  strength: 'skill' | 'elo';
  skillLevel: number;
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
  evaluation: boolean;
  engine: EngineSettings;
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
  kind: 'play' | 'analysis';
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
  engineLevel: number;
  headers: Record<string, string>;
}
export interface NewGameOptions {
  side: Color | 'random';
  minutes: number;
  increment: number;
  chess960: boolean;
  position: number;
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
