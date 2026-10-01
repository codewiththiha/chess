// Connect application actions and lifecycle without embedding rules or worker internals.
import { AppState } from '../state/app.svelte';
import type { Dialog } from '../state/app.svelte';
import { GameActions } from './game';
import { SearchController } from './search';
import { ReviewController } from './review';
import { PersistenceController } from './persistence';
import { moveSound } from './sound';
import { validatePreferences } from '../domain/preferences';
import { supportsSimd } from '../engine/protocol';
import { exportPgn, EXAMPLE_PGN } from '../domain/pgn';
import { copyText, download } from '../data/files';
import type { Preferences, View } from '../domain/types';
function policyFingerprint(p: Preferences): string {
  return JSON.stringify({ ...p.engine, compute: undefined });
}
export class Session {
  readonly state = new AppState();
  readonly game = new GameActions(this.state);
  readonly storage = new PersistenceController(this.state);
  readonly search = new SearchController(this.state, this.game);
  readonly review = new ReviewController(this.state, this.storage.db);
  private tick: ReturnType<typeof setInterval> | null = null;
  private saveTick: ReturnType<typeof setInterval> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private marker = '';
  private disposed = false;
  private count = 0;
  private recordId = '';
  constructor() {
    this.game.onCancel = () => this.search.cancel();
    this.game.onChange = () => this.changed();
    this.game.onNotice = (text) => this.notify(text, true);
    this.search.onError = (error) => this.notify(error.message, true);
  }
  async mount(): Promise<void> {
    const saved = await this.storage.initialize();
    if (this.disposed) return;
    if (saved)
      this.game.load(
        saved,
        saved.kind === 'analysis'
          ? 'analyze'
          : saved.result === '*'
            ? 'play'
            : 'review',
      );
    this.state.loaded = true;
    this.state.now = performance.now();
    await this.search.initialize();
    if (this.disposed) return;
    this.search.run();
    if (this.state.view === 'review') await this.review.restore();
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
    if (view === this.state.view) return;
    if (view !== 'review') this.review.cancel();
    this.game.enter(view);
    if (view === 'review') void this.review.restore();
  }
  openDialog(dialog: Dialog): void {
    this.state.dialog = dialog;
    if (
      dialog !== 'appearance' &&
      dialog !== 'promotion' &&
      !(dialog === 'settings' && this.state.view === 'analyze')
    )
      this.game.pause();
  }
  closeDialog(): void {
    this.state.dialog = null;
    this.state.promotion = null;
    if (this.state.view === 'analyze') this.search.run();
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
      this.game.pause();
      this.review.cancel();
      if (!backendChanged && this.state.ready)
        await this.search.engine.configure(
          prefs.engine,
          this.state.record.chess960,
          this.state.view === 'analyze',
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
  async openSaved(id: string, view: View = 'review'): Promise<void> {
    try {
      const g = await this.storage.db.game(id);
      if (!g) throw new Error('Game is no longer saved.');
      this.review.cancel();
      if (view === 'analyze') {
        g.id = crypto.randomUUID();
        g.kind = 'analysis';
        g.result = '*';
        g.termination = '';
        g.title = `${g.title} · analysis`.slice(0, 120);
        g.createdAt = Date.now();
      }
      this.game.load(g, view);
      if (view === 'review') await this.review.restore();
    } catch (error) {
      this.notify(error instanceof Error ? error.message : String(error), true);
    }
  }
  async removeSaved(id: string): Promise<void> {
    // Forget active/backup snapshots first so later autosaves cannot resurrect the row.
    this.game.discard(id);
    await this.storage.remove(id);
  }
  async importGames(text: string): Promise<void> {
    const records = await this.storage.import(text);
    const first = records[0];
    if (!first) return;
    this.state.dialog = null;
    this.review.cancel();
    this.game.load(first, 'review');
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
    this.notify('PGN exported.');
  }
  async copyFen(): Promise<void> {
    try {
      await copyText(this.state.fen);
      this.notify('FEN copied.');
    } catch (error) {
      this.notify(String(error), true);
    }
  }
  flip(): void {
    this.state.orientation =
      this.state.orientation === 'white' ? 'black' : 'white';
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
