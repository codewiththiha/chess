// Hold reactive application state while rules, storage, and worker actions stay separate.
import { createGame, DEFAULT_NEW_GAME } from '../domain/games';
import { botById, devBots } from '../domain/bots';
import { defaultPreferences } from '../domain/preferences';
import { fenAt, position, drawClaims } from '../domain/chess';
import { isTimed, remaining } from '../domain/clocks';
import type {
  Color,
  GameRecord,
  Preferences,
  ReviewRecord,
  View,
} from '../domain/types';
import type { BotProfile } from '../domain/bots';
import type { Discovery, Report } from '../engine/types';
import type { GameSummary } from '../data/database';

export type Dialog =
  | 'settings'
  | 'appearance'
  | 'import'
  | 'fen'
  | 'help'
  | 'promotion'
  | 'confirm'
  | 'bot'
  | null;

export type StudyTab = 'analyze' | 'review';

export class AppState {
  preferences = $state<Preferences>(defaultPreferences());
  record = $state<GameRecord>(createGame(DEFAULT_NEW_GAME));
  view = $state<View>('home');
  studyTab = $state<StudyTab>('analyze');
  cursor = $state(0);
  orientation = $state<Color>('white');
  now = $state(0);
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
  /** Shipped bots plus the reader's own, loaded from the local database. */
  bots = $state<BotProfile[]>(devBots());
  /** Bot being edited or created in the bot dialog. */
  draftBot = $state<BotProfile | null>(null);
  review = $state<ReviewRecord | null>(null);
  reviewRunning = $state(false);
  reviewError = $state('');
  dialog = $state<Dialog>(null);
  promotion = $state<{ from: string; to: string } | null>(null);
  /** Move queued while the opponent is thinking; played as soon as it is legal. */
  premove = $state<{ from: string; to: string } | null>(null);
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
  timed = $derived(isTimed(this.record.clock));
  reviewed = $derived(this.review?.complete === true);
  canMove = $derived(
    this.promotion === null &&
      (this.view === 'study'
        ? !this.pos.isEnd()
        : this.view === 'play' &&
          this.ready &&
          this.latest &&
          this.record.result === '*' &&
          (this.record.opponent === 'human' ||
            this.pos.turn === this.record.human)),
  );
  lastMove = $derived(this.record.moves[this.cursor - 1] ?? null);
  /** The bot picked on Home, falling back to the shipped default. */
  get selectedBot(): BotProfile | null {
    return (
      botById(this.bots, this.preferences.botId) ??
      this.bots.find((bot) => bot.category === 'dev') ??
      null
    );
  }
  /** The bot the loaded record is played against, if any. */
  get gameBot(): BotProfile | null {
    return this.record.opponent === 'bot'
      ? botById(this.bots, this.record.botId)
      : null;
  }
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
