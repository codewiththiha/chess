// Apply legal game actions, account clocks, and preserve play when entering analysis.
import type { AppState } from '../state/app.svelte';
import {
  createGame,
  analysisGame,
  DEFAULT_NEW_GAME,
  terminalResult,
} from '../domain/games';
import { moveEntry, promotionNeeded } from '../domain/chess';
import { settleClock, startClock, incrementClock } from '../domain/clocks';
import type { NewGameOptions, GameRecord, View, Result } from '../domain/types';
export class GameActions {
  private backup: GameRecord | null = null;
  onChange: () => void = () => {};
  onCancel: () => void = () => {};
  onNotice: (message: string) => void = () => {};
  constructor(private state: AppState) {}
  private now(): number {
    return performance.now();
  }
  pause(): void {
    settleClock(this.state.record.clock, this.now());
    this.state.paused = true;
    this.onCancel();
    this.onChange();
  }
  resume(): void {
    const s = this.state;
    if (s.view !== 'play' || s.record.result !== '*') return;
    s.paused = false;
    s.cursor = s.record.moves.length;
    startClock(s.record.clock, s.pos.turn, this.now());
    this.onChange();
  }
  start(): void {
    const s = this.state;
    if (s.record.clock.running === null && s.record.result === '*')
      startClock(s.record.clock, s.pos.turn, this.now());
  }
  create(options: NewGameOptions): void {
    this.onCancel();
    this.backup = null;
    const s = this.state;
    s.record = createGame(options, s.preferences.engine.skillLevel);
    s.cursor = 0;
    s.view = 'play';
    s.orientation = s.record.human;
    s.paused = false;
    s.review = null;
    s.hint = null;
    s.report = null;
    s.dialog = null;
    this.onChange();
  }
  enter(view: View): void {
    const s = this.state;
    if (view === s.view) return;
    this.pause();
    if (
      view === 'analyze' &&
      (s.record.kind === 'play' || s.view === 'review')
    ) {
      if (s.record.kind === 'play') this.backup = s.snapshot();
      const copy = s.snapshot();
      copy.id = crypto.randomUUID();
      copy.kind = 'analysis';
      copy.result = '*';
      copy.termination = '';
      copy.title = `${copy.title} · analysis`.slice(0, 120);
      copy.createdAt = Date.now();
      s.record = copy;
      s.review = null;
    }
    if (view === 'play' && s.record.kind === 'analysis') {
      s.record =
        this.backup ??
        createGame(DEFAULT_NEW_GAME, s.preferences.engine.skillLevel);
      this.backup = null;
      s.cursor = s.record.moves.length;
    }
    s.view = view;
    s.report = null;
    s.hint = null;
    if (view === 'play') {
      s.cursor = s.record.moves.length;
      s.orientation = s.record.human;
    }
    this.onChange();
  }
  load(game: GameRecord, view: View): void {
    this.onCancel();
    const s = this.state;
    if (s.record.kind === 'play' && s.record.id !== game.id)
      this.backup = s.snapshot();
    s.record = game;
    s.cursor = view === 'review' ? 0 : game.moves.length;
    s.view = view;
    s.orientation = game.human;
    s.paused = true;
    s.review = null;
    s.report = null;
    s.hint = null;
    this.onChange();
  }
  loadFen(fen: string, chess960: boolean): void {
    const game = analysisGame(fen);
    game.chess960 = chess960;
    this.load(game, 'analyze');
    this.state.dialog = null;
  }
  jump(ply: number): void {
    const s = this.state;
    if (!Number.isInteger(ply)) return;
    if (s.view === 'play') this.pause();
    this.onCancel();
    s.cursor = Math.max(0, Math.min(ply, s.record.moves.length));
    s.report = null;
    s.hint = null;
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
    if (s.view === 'play' && (s.paused || !s.latest || s.record.result !== '*'))
      throw new Error('Resume the latest position before moving.');
    const historyLength =
      s.view === 'analyze' ? s.cursor : s.record.moves.length;
    if (historyLength >= 2048)
      throw new Error(
        'The 2,048-ply history limit is reached. Export this game before continuing.',
      );
    if (s.view === 'play') {
      s.now = this.now();
      this.expire();
      if (s.record.result !== '*')
        throw new Error('Time expired before the move.');
    }
    const entry = moveEntry(s.fen, uci, s.record.chess960);
    this.onCancel();
    settleClock(s.record.clock, this.now());
    if (s.view === 'analyze' && !s.latest)
      s.record.moves = s.record.moves.slice(0, s.cursor);
    incrementClock(s.record.clock, entry.color);
    entry.whiteMs = s.record.clock.whiteMs;
    entry.blackMs = s.record.clock.blackMs;
    s.record.moves.push(entry);
    s.cursor = s.record.moves.length;
    s.record.updatedAt = Date.now();
    s.record.result = '*';
    s.record.termination = '';
    s.promotion = null;
    s.dialog = null;
    s.hint = null;
    s.report = null;
    s.review = null;
    const terminal = terminalResult(s.record);
    if (terminal) {
      s.record.result = terminal.result;
      s.record.termination = terminal.reason;
      s.paused = true;
    } else if (s.view === 'play')
      startClock(s.record.clock, s.pos.turn, this.now());
    this.onChange();
  }
  discard(id: string): void {
    if (this.backup?.id === id) this.backup = null;
    const s = this.state;
    if (s.record.id !== id) return;
    this.onCancel();
    s.record =
      this.backup ??
      createGame(DEFAULT_NEW_GAME, s.preferences.engine.skillLevel);
    this.backup = null;
    s.cursor = s.view === 'review' ? 0 : s.record.moves.length;
    s.orientation = s.record.human;
    s.paused = true;
    s.review = null;
    s.report = null;
    s.hint = null;
    s.reviewError = '';
    this.onChange();
  }
  takeback(): void {
    const s = this.state;
    if (!s.record.moves.length) return;
    this.onCancel();
    settleClock(s.record.clock, this.now());
    const count =
      s.view === 'play' && s.latest
        ? s.pos.turn === s.record.human
          ? 2
          : 1
        : 1;
    const target = s.latest
      ? Math.max(0, s.record.moves.length - count)
      : s.cursor;
    s.record.moves = s.record.moves.slice(0, target);
    s.cursor = target;
    s.record.result = '*';
    s.record.termination = '';
    const last = s.record.moves.at(-1);
    s.record.clock.whiteMs = last?.whiteMs ?? s.record.clock.initialMs;
    s.record.clock.blackMs = last?.blackMs ?? s.record.clock.initialMs;
    s.review = null;
    s.report = null;
    s.hint = null;
    s.paused = s.view === 'play';
    s.record.updatedAt = Date.now();
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
    s.paused = true;
    s.record.updatedAt = Date.now();
    this.onChange();
  }
  expire(): void {
    const s = this.state;
    const color = s.record.clock.running;
    if (!color || s.view !== 'play' || s.record.result !== '*') return;
    if (s.getClock(color) > 0) return;
    const opponent = color === 'white' ? 'black' : 'white';
    if (s.pos.hasInsufficientMaterial(opponent))
      this.finish('1/2-1/2', 'Timeout · insufficient mating material');
    else this.finish(opponent === 'white' ? '1-0' : '0-1', 'Time expired');
  }
}
