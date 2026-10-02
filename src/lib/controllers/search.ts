// Coordinate play, hints, and analysis with generation-checked worker jobs.
import type { AppState } from '../state/app.svelte';
import { EngineClient } from '../engine/client';
import { Cancelled } from '../engine/types';
import { policyForGame } from '../domain/bots';
import type { GameActions } from './game';
import type { ComputeSettings, EngineSettings } from '../domain/types';
export class SearchController {
  readonly engine = new EngineClient();
  private generation = 0;
  onError: (error: Error) => void = () => {};
  /** Called with the engine's answer and the ply the search was started for. */
  onReport: (report: NonNullable<AppState['report']>, ply: number) => void =
    () => {};
  onHint: () => void = () => {};
  constructor(
    private state: AppState,
    private game: GameActions,
  ) {
    this.engine.onFailure = (error) => {
      this.state.ready = false;
      this.state.engineError = error.message;
      this.onError(error);
    };
  }
  async initialize(): Promise<void> {
    const s = this.state;
    s.ready = false;
    s.engineError = '';
    try {
      s.discovery = await this.engine.init(s.preferences.engine.backend);
      s.backend = this.engine.backend;
      s.ready = true;
    } catch (error) {
      s.engineError = error instanceof Error ? error.message : String(error);
    }
  }
  cancel(): void {
    this.generation++;
    this.state.thinking = false;
    void this.engine.stop().catch((error) => {
      if (!(error instanceof Cancelled))
        this.onError(error instanceof Error ? error : new Error(String(error)));
    });
  }
  run(hint = false, override?: ComputeSettings): void {
    const s = this.state;
    if (hint) this.onHint();
    if (!s.ready || s.pos.isEnd() || s.view === 'home') return;
    /**
     * Study is a view, not a pause: when the engine owes a game move it makes one
     * there too. Everything else - a hint, a human turn, an earlier position - is
     * analysis of the position on screen.
     */
    const botTurn =
      s.record.opponent === 'bot' &&
      s.latest &&
      s.record.result === '*' &&
      s.pos.turn !== s.record.human;
    const analysis = !botTurn;
    if (botTurn) this.game.startIfNeeded();
    // File the answer against this position: a bot move can be committed while
    // the final report is still in flight, and the answer is not about that move.
    const position = s.cursor;
    const generation = ++this.generation;
    s.thinking = true;
    const start = s.record.startFen;
    const history = s.record.moves.slice(0, s.cursor).map((m) => m.uci);
    const engine = this.policy();
    // Study arrows come from the engine's own lines, so ask for as many as shown.
    const settings = analysis
      ? {
          ...engine,
          multiPv: Math.max(
            engine.multiPv,
            Math.min(4, Math.max(1, s.preferences.arrowCount)),
          ),
        }
      : engine;
    const compute = { ...(override ?? settings.compute) };
    if (!analysis) {
      if (s.record.clock.initialMs) {
        const left = s.getClock(s.pos.turn);
        const clockBudget = Math.max(
          1,
          Math.min(
            3000,
            Math.floor(left / 25 + s.record.clock.incrementMs / 2),
            Math.floor(left * 0.8),
          ),
        );
        compute.timeMs = Math.min(compute.timeMs ?? clockBudget, clockBudget);
      }
    }
    void (async () => {
      try {
        await this.engine.stop();
        await this.engine.configure(settings, s.record.chess960, analysis);
        if (generation !== this.generation) return;
        await this.engine.position(start, history);
        if (generation !== this.generation) return;
        const update = (report: NonNullable<AppState['report']>) => {
          if (generation !== this.generation) return;
          if (hint) {
            s.hint = report;
            return;
          }
          s.report = report;
          // The opponent can only talk about what the engine has actually found.
          this.onReport(report, position);
        };
        const result = await this.engine.search(compute, update);
        if (generation !== this.generation) return;
        update(result);
        s.thinking = false;
        if (!analysis && result.bestMove && s.record.result === '*')
          this.game.commit(result.bestMove);
        else if (!analysis && !result.bestMove && s.claims.length)
          this.game.finish('1/2-1/2', s.claims.join(' · '));
      } catch (error) {
        if (generation !== this.generation || error instanceof Cancelled)
          return;
        s.thinking = false;
        const e = error instanceof Error ? error : new Error(String(error));
        s.engineError = e.message;
        this.onError(e);
      }
    })();
  }
  /**
   * The policy the loaded game plays with: the opponent bot's own style and
   * strength when it has one, otherwise the settings from the engine dialog.
   */
  private policy(): EngineSettings {
    const s = this.state;
    return policyForGame(s.preferenceSnapshot().engine, s.record, s.bots);
  }
  async updatePerformance(compute: ComputeSettings): Promise<void> {
    if (this.state.thinking) await this.engine.performance(compute);
  }
  async restart(): Promise<void> {
    this.cancel();
    this.engine.dispose();
    await this.initialize();
    this.run();
  }
  dispose(): void {
    this.generation++;
    this.engine.dispose();
  }
}
