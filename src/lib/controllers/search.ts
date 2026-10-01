// Coordinate play, hints, and analysis with generation-checked worker jobs.
import type { AppState } from '../state/app.svelte';
import { EngineClient } from '../engine/client';
import { Cancelled } from '../engine/types';
import type { GameActions } from './game';
import type { ComputeSettings } from '../domain/types';
export class SearchController {
  readonly engine = new EngineClient();
  private generation = 0;
  onError: (error: Error) => void = () => {};
  constructor(
    private state: AppState,
    private game: GameActions,
  ) {
    this.engine.onFailure = (error) => {
      this.state.ready = false;
      this.state.engineError = error.message;
      this.game.pause();
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
    const analysis = s.view === 'analyze' || hint;
    if (
      !s.ready ||
      s.pos.isEnd() ||
      s.view === 'library' ||
      s.view === 'review'
    )
      return;
    if (!analysis && (s.paused || !s.latest || s.record.result !== '*')) return;
    if (!analysis) {
      this.game.start();
      if (s.pos.turn === s.record.human) return;
    }
    const generation = ++this.generation;
    s.thinking = true;
    const start = s.record.startFen;
    const history = s.record.moves.slice(0, s.cursor).map((m) => m.uci);
    const settings = s.preferenceSnapshot().engine;
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
          if (generation === this.generation) {
            if (hint) s.hint = report;
            else s.report = report;
          }
        };
        const result = await this.engine.search(compute, update);
        if (generation !== this.generation) return;
        update(result);
        s.thinking = false;
        if (
          !analysis &&
          result.bestMove &&
          !s.paused &&
          s.record.result === '*'
        )
          this.game.commit(result.bestMove);
        else if (!analysis && !result.bestMove && s.claims.length)
          this.game.finish('1/2-1/2', s.claims.join(' · '));
      } catch (error) {
        if (generation !== this.generation || error instanceof Cancelled)
          return;
        s.thinking = false;
        const e = error instanceof Error ? error : new Error(String(error));
        s.engineError = e.message;
        this.game.pause();
        this.onError(e);
      }
    })();
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
