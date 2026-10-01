// Hold reactive application state while rules, storage, and worker actions stay separate.
import { createGame, DEFAULT_NEW_GAME } from '../domain/games';
import { defaultPreferences } from '../domain/preferences';
import { fenAt, position, drawClaims } from '../domain/chess';
import { remaining } from '../domain/clocks';
import type {
  Color,
  GameRecord,
  Preferences,
  ReviewRecord,
  View,
} from '../domain/types';
import type { Discovery, Report } from '../engine/types';
import type { GameSummary } from '../data/database';
export type Dialog =
  | 'new'
  | 'settings'
  | 'appearance'
  | 'import'
  | 'fen'
  | 'help'
  | 'promotion'
  | 'confirm'
  | null;
export class AppState {
  preferences = $state<Preferences>(defaultPreferences());
  record = $state<GameRecord>(createGame(DEFAULT_NEW_GAME));
  view = $state<View>('play');
  cursor = $state(0);
  orientation = $state<Color>('white');
  now = $state(0);
  paused = $state(false);
  thinking = $state(false);
  ready = $state(false);
  report = $state<Report | null>(null);
  hint = $state<Report | null>(null);
  discovery = $state<Discovery | null>(null);
  backend = $state('');
  engineError = $state('');
  storageError = $state('');
  saving = $state(false);
  saved = $state(false);
  loaded = $state(false);
  library = $state<GameSummary[]>([]);
  review = $state<ReviewRecord | null>(null);
  reviewRunning = $state(false);
  reviewError = $state('');
  dialog = $state<Dialog>(null);
  promotion = $state<{ from: string; to: string } | null>(null);
  confirmation = $state<{
    title: string;
    detail: string;
    label: string;
    action: () => void;
  } | null>(null);
  notice = $state<{ text: string; error: boolean } | null>(null);
  fen = $derived(fenAt(this.record, this.cursor));
  pos = $derived(position(this.fen));
  claims = $derived(drawClaims(this.record));
  latest = $derived(this.cursor === this.record.moves.length);
  canMove = $derived(
    this.promotion === null &&
      (this.view === 'analyze'
        ? !this.pos.isEnd()
        : this.view === 'play' &&
          this.ready &&
          !this.paused &&
          this.latest &&
          this.record.result === '*' &&
          this.pos.turn === this.record.human),
  );
  lastMove = $derived(this.record.moves[this.cursor - 1] ?? null);
  getClock(color: Color): number {
    return remaining(this.record.clock, color, this.now);
  }
  snapshot(): GameRecord {
    return $state.snapshot(this.record);
  }
  reviewSnapshot(): ReviewRecord | null {
    return $state.snapshot(this.review);
  }
  preferenceSnapshot(): Preferences {
    return $state.snapshot(this.preferences);
  }
}
