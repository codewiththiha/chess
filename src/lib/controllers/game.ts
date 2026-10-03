// Own legal moves, clock transitions, and record changes for the active game.
import { moveEntry, promotionNeeded } from '../domain/chess';
import {
  addTime,
  incrementClock,
  isTimed,
  setTimeControl,
  settleClock,
  startClock,
} from '../domain/clocks';
import {
  createGame,
  DEFAULT_NEW_GAME,
  studyGame,
  terminalResult,
} from '../domain/games';
import { ELO_MAX } from '../domain/strength';
import type { OpponentBot } from '../domain/games';
import type { AppState } from '../state/app.svelte';
import type {
  Color,
  GameRecord,
  NewGameOptions,
  Result,
  View,
} from '../domain/types';

export class GameActions {
  onCancel: () => void = () => {};
  onChange: () => void = () => {};
  onNotice: (text: string) => void = () => {};
  constructor(private readonly state: AppState) {}

  private now(): number {
    return performance.now();
  }

  private stamp(): void {
    this.state.record.updatedAt = Date.now();
  }

  create(options: NewGameOptions, bot: OpponentBot | null = null): void {
    this.onCancel();
    const s = this.state;
    const engine = s.preferences.engine;
    s.record = createGame(
      options,
      bot ??
        (options.opponent === 'human'
          ? null
          : {
              id: '',
              name: 'gwaymaegyi',
              elo: engine.strength === 'full' ? ELO_MAX : engine.elo,
            }),
    );
    s.premove = null;
    s.cursor = 0;
    s.view = 'play';
    s.orientation = s.record.human;
    s.review = null;
    s.reviewError = '';
    s.hint = null;
    s.report = null;
    s.evals = {};
    s.dialog = null;
    this.stamp();
    this.startIfNeeded();
    this.onChange();
  }

  /** Load an existing record without forking it into a second saved game. */
  load(game: GameRecord, view: View): void {
    this.onCancel();
    const s = this.state;
    s.record = game;
    s.premove = null;
    s.cursor = view === 'study' ? 0 : game.moves.length;
    s.view = view;
    s.orientation = game.human;
    s.review = null;
    s.reviewError = '';
    s.report = null;
    s.hint = null;
    s.evals = {};
    this.onChange();
  }

  loadFen(fen: string, chess960: boolean): void {
    const game = studyGame(fen);
    game.chess960 = chess960;
    this.load(game, 'study');
    this.state.dialog = null;
  }

  enter(view: View): void {
    const s = this.state;
    if (view === s.view) return;
    s.view = view;
    s.report = null;
    s.hint = null;
    if (view === 'play') {
      s.cursor = s.record.moves.length;
      s.orientation = s.record.human;
    }
    if (view === 'study') s.cursor = Math.min(s.cursor, s.record.moves.length);
    this.onChange();
  }

  /** Timed games keep running, so a restored clock continues for the side to move. */
  resumeClock(): void {
    const s = this.state;
    // Study is a view, not a pause: a live clock keeps running in either view.
    if (
      s.view === 'home' ||
      !isTimed(s.record.clock) ||
      s.record.result !== '*'
    )
      return;
    startClock(s.record.clock, s.pos.turn, this.now());
  }

  startIfNeeded(): void {
    const s = this.state;
    if (!isTimed(s.record.clock) || s.record.clock.running) return;
    if (s.record.result !== '*') return;
    startClock(s.record.clock, s.pos.turn, this.now());
  }

  setTime(minutes: number, increment: number): void {
    const s = this.state;
    settleClock(s.record.clock, this.now());
    setTimeControl(s.record.clock, minutes, increment);
    if (isTimed(s.record.clock) && s.record.result === '*') this.resumeClock();
    this.stamp();
    this.onChange();
  }

  addTime(color: Color, seconds: number): void {
    const s = this.state;
    settleClock(s.record.clock, this.now());
    addTime(s.record.clock, color, seconds);
    if (isTimed(s.record.clock) && s.record.result === '*') this.resumeClock();
    this.stamp();
    this.onChange();
  }

  attempt(from: string, to: string, promotion = ''): void {
    const s = this.state;
    if (!s.canMove && !promotion) return;
    if (promotion && s.view === 'play' && s.record.result !== '*') {
      s.promotion = null;
      s.dialog = null;
      return;
    }
    if (!promotion && promotionNeeded(s.fen, from, to)) {
      s.promotion = { from, to };
      s.dialog = 'promotion';
      return;
    }
    try {
      this.commit(`${from}${to}${promotion}`);
    } catch (error) {
      this.onNotice(
        error instanceof Error ? error.message : 'That move is not legal.',
      );
    }
  }

  commit(uci: string): void {
    const s = this.state;
    if (s.view === 'play' && (!s.latest || s.record.result !== '*'))
      throw new Error('Return to the latest move to play on.');
    const historyLength = s.view === 'study' ? s.cursor : s.record.moves.length;
    if (historyLength >= 2048)
      throw new Error(
        'The 2,048-ply history limit is reached. Export this game before continuing.',
      );
    if (s.view !== 'home' && isTimed(s.record.clock)) {
      s.now = this.now();
      this.expire();
      if (s.record.result !== '*')
        throw new Error('Time expired before the move.');
    }
    const entry = moveEntry(s.fen, uci, s.record.chess960);
    this.onCancel();
    if (s.view !== 'home' && isTimed(s.record.clock)) {
      settleClock(s.record.clock, this.now());
      incrementClock(s.record.clock, entry.color);
    }
    if (s.view === 'study' && !s.latest) {
      s.record.moves = s.record.moves.slice(0, s.cursor);
      s.trimEvals(s.cursor);
    }
    entry.whiteMs = s.record.clock.whiteMs;
    entry.blackMs = s.record.clock.blackMs;
    s.record.moves.push(entry);
    s.cursor = s.record.moves.length;
    s.record.result = '*';
    s.record.termination = '';
    s.promotion = null;
    // The moved piece answers the promotion question and nothing else: the
    // engine commits its reply through here too, so a panel the reader has open
    // must not be taken away by the opponent's move.
    if (s.dialog === 'promotion') s.dialog = null;
    s.hint = null;
    s.report = null;
    s.review = null;
    s.reviewError = '';
    const terminal = terminalResult(s.record);
    if (terminal) {
      s.record.result = terminal.result;
      s.record.termination = terminal.reason;
      settleClock(s.record.clock, this.now());
    } else if (s.view !== 'home') {
      startClock(s.record.clock, s.pos.turn, this.now());
    }
    this.stamp();
    this.onChange();
    this.playPremove();
  }

  /** Queue a move while the engine is thinking; it is played when it becomes legal. */
  setPremove(from: string, to: string): void {
    this.state.premove = { from, to };
  }

  clearPremove(): void {
    this.state.premove = null;
  }

  private playPremove(): void {
    const s = this.state;
    const pending = s.premove;
    if (!pending) return;
    if (s.record.opponent !== 'bot' || s.record.result !== '*') {
      s.premove = null;
      return;
    }
    // A premove is about the engine's thinking time, so untimed games queue too.
    if (!s.latest || s.pos.turn !== s.record.human) return;
    s.premove = null;
    const uci = `${pending.from}${pending.to}`;
    try {
      this.commit(
        promotionNeeded(s.fen, pending.from, pending.to) ? `${uci}q` : uci,
      );
    } catch (error) {
      this.onNotice(
        error instanceof Error
          ? `Premove dropped: ${error.message}`
          : 'Premove dropped.',
      );
    }
  }

  discard(id: string): void {
    const s = this.state;
    if (s.record.id !== id) return;
    this.onCancel();
    s.record = createGame(DEFAULT_NEW_GAME);
    s.cursor = 0;
    s.orientation = s.record.human;
    s.review = null;
    s.report = null;
    s.hint = null;
    s.evals = {};
    s.reviewError = '';
    this.onChange();
  }

  jump(ply: number): void {
    const s = this.state;
    if (!Number.isInteger(ply)) return;
    this.onCancel();
    s.cursor = Math.max(0, Math.min(ply, s.record.moves.length));
    s.report = null;
    s.hint = null;
    this.onChange();
  }

  takeback(): void {
    const s = this.state;
    if (!s.record.moves.length) return;
    this.onCancel();
    const count =
      s.view === 'play' && s.latest
        ? s.pos.turn === s.record.human
          ? 2
          : 1
        : 1;
    const target = s.latest
      ? Math.max(0, s.record.moves.length - count)
      : s.cursor;
    settleClock(s.record.clock, this.now());
    s.record.moves = s.record.moves.slice(0, target);
    s.cursor = target;
    s.record.result = '*';
    s.record.termination = '';
    const last = s.record.moves.at(-1);
    s.record.clock.whiteMs = last?.whiteMs ?? s.record.clock.initialMs;
    s.record.clock.blackMs = last?.blackMs ?? s.record.clock.initialMs;
    s.premove = null;
    s.review = null;
    s.report = null;
    s.hint = null;
    s.trimEvals(target);
    if (s.view !== 'home') this.resumeClock();
    this.stamp();
    this.onChange();
  }

  finish(result: Result, reason: string): void {
    this.onCancel();
    const s = this.state;
    settleClock(s.record.clock, this.now());
    s.promotion = null;
    if (s.dialog === 'promotion') s.dialog = null;
    s.record.result = result;
    s.record.termination = reason;
    this.stamp();
    this.onChange();
  }

  /** Clock expiry is checked by the tick and again before any move commits. */
  expire(): void {
    const s = this.state;
    const color = s.record.clock.running;
    if (!color || s.record.result !== '*') return;
    if (s.getClock(color) > 0) return;
    const opponent = color === 'white' ? 'black' : 'white';
    if (s.pos.hasInsufficientMaterial(opponent))
      this.finish('1/2-1/2', 'Timeout · insufficient mating material');
    else this.finish(opponent === 'white' ? '1-0' : '0-1', 'Time expired');
  }
}
