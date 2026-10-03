// Connect application actions and lifecycle without embedding rules or worker internals.
import { AppState } from '../state/app.svelte';
import type { Dialog, StudyTab } from '../state/app.svelte';
import { GameActions } from './game';
import { SearchController } from './search';
import { ReviewController } from './review';
import { CoachController } from './coach';
import { BotChatController } from './botchat';
import { SpeechController } from './speech';
import { PersistenceController } from './persistence';
import { moveSound } from './sound';
import { validatePreferences } from '../domain/preferences';
import { supportsSimd } from '../engine/protocol';
import { exportPgn, EXAMPLE_PGN } from '../domain/pgn';
import { copyText, download } from '../data/files';
import { categoryLabel, describeTime } from '../domain/time-controls';
import { botById, newBot, validateBot } from '../domain/bots';
import type { BotProfile } from '../domain/bots';
import type { Color, NewGameOptions, Preferences, View } from '../domain/types';

function policyFingerprint(p: Preferences): string {
  return JSON.stringify({ ...p.engine, compute: undefined });
}

export class Session {
  readonly state = new AppState();
  readonly game = new GameActions(this.state);
  readonly storage = new PersistenceController(this.state);
  readonly search = new SearchController(this.state, this.game);
  readonly review = new ReviewController(this.state, this.storage.db);
  readonly coach = new CoachController(this.state);
  readonly chat = new BotChatController(this.state);
  readonly speech = new SpeechController(this.state);
  private tick: ReturnType<typeof setInterval> | null = null;
  private saveTick: ReturnType<typeof setInterval> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private marker = '';
  private disposed = false;
  private count = 0;
  private recordId = '';
  private mounting: Promise<void> | null = null;
  /** Set once the reader picks a view, so the restore cannot undo that choice. */
  private viewChosen = false;
  /** Set once the reader picks a game, so the restore cannot replace it. */
  private gameChosen = false;
  constructor() {
    this.game.onCancel = () => this.search.cancel();
    this.game.onChange = () => this.changed();
    this.game.onNotice = (text) => this.notify(text, true);
    this.search.onError = (error) => this.notify(error.message, true);
    this.search.onReport = (report) => this.chat.observeReport(report);
    this.search.onHint = () => this.chat.heardHint();
    this.storage.onMerged = () =>
      this.notify('That game was already saved, so it was kept as one game.');
    this.review.onStored = () => void this.storage.refresh();
    // The board's review line and the study card read the same walkthrough, and
    // both must follow a review that finishes while the card is closed.
    this.review.onPoints = () => this.coach.open();
  }

  mount(): Promise<void> {
    this.mounting ??= this.startUp();
    return this.mounting;
  }

  private async startUp(): Promise<void> {
    const saved = await this.storage.initialize();
    if (this.disposed) return;
    if (saved && !this.gameChosen) {
      const finished = saved.result !== '*';
      // A view picked while the database opened outranks the stored default.
      const view = this.viewChosen
        ? this.state.view
        : finished
          ? 'home'
          : 'play';
      this.game.load(saved, view);
      if (!finished) this.game.resumeClock();
    }
    this.state.loaded = true;
    this.state.now = performance.now();
    await this.search.initialize();
    if (this.disposed) return;
    this.search.run();
    if (this.state.view === 'study') await this.review.restore();
    if (this.disposed) return;
    this.tick = setInterval(() => {
      this.state.now = performance.now();
      this.game.expire();
    }, 100);
    this.saveTick = setInterval(() => {
      if (this.state.record.clock.running) void this.storage.save();
    }, 10000);
  }

  private changed(): void {
    const s = this.state;
    this.chat.observe();
    const said = s.bubble;
    if (said) this.speech.speak(said.text);
    const marker = `${s.record.id}:${s.record.moves.map((m) => m.uci).join(',')}`;
    if (marker !== this.marker) {
      this.review.cancel();
      this.marker = marker;
    }
    if (
      this.recordId === s.record.id &&
      s.record.moves.length === this.count + 1 &&
      s.preferences.sound
    )
      moveSound(Boolean(s.record.moves.at(-1)?.captured));
    this.count = s.record.moves.length;
    this.recordId = s.record.id;
    s.now = performance.now();
    this.search.cancel();
    if (s.loaded) void this.storage.save();
    if (!s.dialog) this.search.run();
  }

  notify(text: string, error = false): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.state.notice = { text, error };
    this.toastTimer = setTimeout(
      () => {
        this.state.notice = null;
      },
      error ? 7000 : 3500,
    );
  }

  navigate(view: View): void {
    const s = this.state;
    this.viewChosen = true;
    // Am I moving the board to the side of the panel the reader just left open?
    if (s.sheet) s.sheet = null;
    if (view === s.view) return;
    if (view !== 'study') this.review.cancel();
    this.game.enter(view);
    if (view === 'study') {
      void this.review.restore();
      this.state.studyTab = this.state.review ? 'review' : 'analyze';
      // The board carries the review's line in this view, so the walkthrough is
      // built on the way in rather than when the card is first opened.
      this.coach.open();
    }
  }

  openStudy(tab: StudyTab): void {
    this.state.studyTab = tab;
    this.navigate('study');
  }

  startGame(options: NewGameOptions): void {
    this.gameChosen = true;
    this.coach.reset();
    const bot =
      options.opponent === 'bot'
        ? botById(this.state.bots, options.botId)
        : null;
    this.game.create(options, bot);
    this.speech.cancel();
    this.chat.greet();
    const greeting = this.state.bubble;
    if (greeting) this.speech.speak(greeting.text);
    this.notify(
      `${bot ? `${bot.name} · ` : ''}${categoryLabel(options.minutes)} · ${describeTime(options.minutes, options.increment)}`,
    );
  }

  /** The reader turned the characters' speech on or off, from the rail. */
  toggleSpeech(): void {
    const next = {
      ...this.state.preferenceSnapshot(),
      speech: !this.state.preferences.speech,
    };
    if (!next.speech) this.speech.cancel();
    void this.applyPreferences(
      next,
      next.speech ? 'Opponent speech on.' : 'Opponent speech off.',
    );
  }

  /** Remember the bot Home will start the next game against. */
  selectBot(id: string): void {
    this.state.preferences.botId = id;
    void this.storage.preferences();
  }

  openBotDialog(bot: BotProfile | null): void {
    this.state.draftBot = bot ? { ...bot } : newBot('');
    this.openDialog('bot');
  }

  async saveBot(bot: BotProfile): Promise<void> {
    const clean: BotProfile = {
      ...bot,
      name: bot.name.trim(),
      blurb: bot.blurb.trim(),
    };
    validateBot(clean);
    if (clean.category === 'dev') clean.category = 'custom';
    await this.storage.saveBot(clean);
    this.state.dialog = null;
    this.state.draftBot = null;
    this.notify(`${clean.name} saved.`);
  }

  async deleteBot(id: string): Promise<void> {
    await this.storage.deleteBot(id);
    this.state.dialog = null;
    this.state.draftBot = null;
    this.notify('Bot deleted.');
  }

  setTimeControl(minutes: number, increment: number): void {
    this.game.setTime(minutes, increment);
    void this.storage.save();
    this.notify(`Clock set to ${describeTime(minutes, increment)}.`);
  }

  addTime(color: Color, seconds: number): void {
    this.game.addTime(color, seconds);
    void this.storage.save();
    this.notify(`${seconds > 0 ? 'Added' : 'Removed'} ${Math.abs(seconds)}s.`);
  }

  /** Dialogs snapshot restored state on mount, so never open one before then. */
  openDialog(dialog: Dialog): void {
    const show = () => {
      // One modal at a time: a sheet is dismissed before a dialog opens.
      this.state.sheet = null;
      this.state.dialog = dialog;
    };
    if (this.mounting && !this.state.loaded)
      void this.mounting.then(show, show);
    else show();
  }

  closeDialog(): void {
    this.state.dialog = null;
    this.state.promotion = null;
    if (this.state.view === 'study') this.search.run();
  }

  confirm(
    title: string,
    detail: string,
    label: string,
    action: () => void,
  ): void {
    this.state.confirmation = { title, detail, label, action };
    this.openDialog('confirm');
  }

  async applyPreferences(
    prefs: Preferences,
    notice = 'Settings saved.',
  ): Promise<void> {
    // Startup restores stored preferences once; never let those two write races.
    if (this.mounting) await this.mounting;
    if (!prefs.speech) this.speech.cancel();
    validatePreferences(prefs);
    if (prefs.engine.backend === 'simd128' && !supportsSimd())
      throw new Error(
        'SIMD128 is unavailable in this browser. Choose Automatic or Portable.',
      );
    const old = this.state.preferenceSnapshot();
    const backendChanged = old.engine.backend !== prefs.engine.backend;
    const computeChanged =
      JSON.stringify(old.engine.compute) !==
      JSON.stringify(prefs.engine.compute);
    if (
      policyFingerprint(old) === policyFingerprint(prefs) &&
      computeChanged &&
      this.state.thinking
    ) {
      await this.search.updatePerformance(prefs.engine.compute);
    } else if (
      policyFingerprint(old) !== policyFingerprint(prefs) ||
      computeChanged
    ) {
      this.review.cancel();
      if (!backendChanged && this.state.ready)
        await this.search.engine.configure(
          prefs.engine,
          this.state.record.chess960,
          this.state.view === 'study',
        );
    }
    this.state.preferences = prefs;
    if (backendChanged) {
      await this.search.restart();
      if (!this.state.ready) {
        this.state.preferences = old;
        await this.search.restart();
        throw new Error(
          'Selected backend could not start. Previous settings restored.',
        );
      }
    }
    await this.storage.preferences();
    this.state.dialog = null;
    if (!this.state.thinking) this.search.run();
    this.notify(notice);
  }

  async openSaved(id: string, view: View = 'play'): Promise<void> {
    this.gameChosen = true;
    this.coach.reset();
    this.chat.reset();
    try {
      const record = await this.storage.db.game(id);
      if (!record) throw new Error('Game is no longer saved.');
      this.review.cancel();
      this.game.load(record, view);
      if (view === 'study') {
        await this.review.restore();
        this.state.studyTab = this.state.review ? 'review' : 'analyze';
        this.coach.open();
      } else this.game.resumeClock();
    } catch (error) {
      this.notify(error instanceof Error ? error.message : String(error), true);
    }
  }

  async removeSaved(id: string): Promise<void> {
    // Forget the active record first so a later autosave cannot resurrect it.
    this.game.discard(id);
    await this.storage.remove(id);
  }

  async importGames(text: string): Promise<void> {
    this.gameChosen = true;
    this.coach.reset();
    this.chat.reset();
    const records = await this.storage.import(text);
    const first = records[0];
    if (!first) return;
    this.state.dialog = null;
    this.review.cancel();
    this.game.load(first, 'study');
    await this.review.restore();
    this.state.studyTab = this.state.review ? 'review' : 'analyze';
    this.notify(
      `Imported ${records.length} ${records.length === 1 ? 'game' : 'games'}.`,
    );
  }

  example(): void {
    void this.importGames(EXAMPLE_PGN).catch((error) =>
      this.notify(String(error), true),
    );
  }

  exportCurrent(): void {
    download(
      exportPgn(this.state.snapshot()),
      `${this.state.record.title}.pgn`,
    );
    this.notify('PGN downloaded.');
  }

  async exportAll(): Promise<void> {
    download(await this.storage.exportAll(), 'gwaymaegyi-games.pgn');
    this.notify('Games exported.');
  }

  async copyFen(): Promise<void> {
    await copyText(this.state.fen);
    this.notify('FEN copied.');
  }

  flip(): void {
    const s = this.state;
    s.orientation = s.orientation === 'white' ? 'black' : 'white';
  }

  dispose(): void {
    this.disposed = true;
    if (this.tick) clearInterval(this.tick);
    if (this.saveTick) clearInterval(this.saveTick);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.search.dispose();
    this.review.cancel();
    this.storage.db.close();
  }
}
