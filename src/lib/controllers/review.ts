// Review positions in an independent cancellable worker and persist resumable evidence.
import { EngineClient } from '../engine/client';
import { Cancelled } from '../engine/types';
import { ENGINE_REVISION, whiteScore } from '../domain/review';
import { fenAt, position, bestSan } from '../domain/chess';
import type { AppState } from '../state/app.svelte';
import type { ChessDatabase } from '../data/database';
import { SavedDataError } from '../data/errors';
import type { ReviewPoint } from '../domain/types';
export const REVIEW_PRESETS = {
  quick: { depth: 5, nodes: '10000', timeMs: 300 },
  balanced: { depth: 7, nodes: '25000', timeMs: 750 },
  thorough: { depth: 10, nodes: '100000', timeMs: 2000 },
};
export class ReviewController {
  onStored: () => void = () => {};
  /** Called when the review's own points change, so the walkthrough follows. */
  onPoints: () => void = () => {};
  private engine: EngineClient | null = null;
  private generation = 0;
  constructor(
    private state: AppState,
    private db: ChessDatabase,
  ) {}
  async restore(): Promise<void> {
    const game = this.state.snapshot();
    const token = this.generation;
    if (this.state.reviewRunning) return;
    try {
      const review = await this.db.review(game);
      if (
        this.state.record.id === game.id &&
        token === this.generation &&
        !this.state.reviewRunning
      )
        this.state.review = review;
    } catch (error) {
      if (this.state.record.id !== game.id || token !== this.generation) return;
      if (error instanceof SavedDataError)
        this.state.reviewError =
          'Saved review was rejected. Run a fresh review to replace it.';
      else
        this.state.storageError =
          'Saved reviews could not be read from local storage. Export important games before leaving.';
    }
  }
  async run(preset: keyof typeof REVIEW_PRESETS): Promise<void> {
    this.cancel();
    const token = ++this.generation;
    const s = this.state;
    const game = s.snapshot();
    if (!game.moves.length) return;
    s.reviewRunning = true;
    s.reviewError = '';
    const settings = s.preferenceSnapshot().engine;
    settings.multiPv = 1;
    const budget = REVIEW_PRESETS[preset];
    const fingerprint = JSON.stringify({
      revision: ENGINE_REVISION,
      start: game.startFen,
      chess960: game.chess960,
      moves: game.moves.map((m) => m.uci),
      settings: { ...settings, compute: undefined },
      budget,
    });
    if (s.review?.fingerprint !== fingerprint)
      s.review = {
        version: 1,
        gameId: game.id,
        fingerprint,
        engineRevision: ENGINE_REVISION,
        depth: budget.depth,
        nodeBudget: budget.nodes,
        timeMs: budget.timeMs,
        updatedAt: Date.now(),
        points: [],
        complete: false,
      };
    const engine = new EngineClient();
    this.engine = engine;
    try {
      await engine.init(settings.backend);
      await engine.configure(settings, game.chess960, true);
      for (let ply = 0; ply <= game.moves.length; ply++) {
        if (token !== this.generation) return;
        if (s.review.points.some((p) => p.ply === ply)) continue;
        const fen = fenAt(game, ply);
        const pos = position(fen);
        let point: ReviewPoint;
        if (pos.isEnd()) {
          const outcome = pos.outcome();
          const winner = outcome?.winner;
          point = {
            ply,
            whiteCp: winner ? (winner === 'white' ? 30000 : -30000) : 0,
            whiteMate: winner ? 0 : null,
            depth: 0,
            nodes: '0',
            bestMove: null,
            bestSan: null,
            pv: [],
          };
        } else {
          await engine.position(
            game.startFen,
            game.moves.slice(0, ply).map((m) => m.uci),
          );
          const r = await engine.search({
            ...settings.compute,
            ...budget,
            profile: 'custom',
            quantum: 256,
            reportIntervalMs: 100,
          });
          const cp = whiteScore(r.scoreCp, r.mate, pos.turn);
          if (cp === null)
            throw new Error(
              `No evaluation returned for ply ${ply}. Resume the review to retry.`,
            );
          point = {
            ply,
            whiteCp: cp,
            whiteMate:
              r.mate === null ? null : r.mate * (pos.turn === 'white' ? 1 : -1),
            depth: r.depth,
            nodes: r.nodes,
            bestMove: r.bestMove,
            bestSan: bestSan(fen, r.bestMove),
            pv: r.pv,
          };
        }
        if (token !== this.generation || s.record.id !== game.id) return;
        s.review.points.push(point);
        s.review.updatedAt = Date.now();
        try {
          await this.save();
        } catch {
          s.storageError =
            'Review results could not be saved. Export your game before leaving this device.';
        }
      }
      if (token === this.generation) {
        s.review.complete = true;
        await this.save();
        this.onPoints();
      }
    } catch (error) {
      if (token === this.generation && !(error instanceof Cancelled))
        s.reviewError = error instanceof Error ? error.message : String(error);
    } finally {
      engine.dispose();
      if (token === this.generation) {
        s.reviewRunning = false;
        this.engine = null;
      }
    }
  }
  private async save(): Promise<void> {
    const snapshot = this.state.reviewSnapshot();
    if (!snapshot) return;
    await this.db.saveReview(snapshot);
    this.onStored();
  }
  cancel(): void {
    this.generation++;
    this.engine?.dispose();
    this.engine = null;
    this.state.reviewRunning = false;
  }
}
