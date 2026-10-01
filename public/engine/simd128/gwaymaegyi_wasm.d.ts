/* tslint:disable */
/* eslint-disable */

/**
 * Stateful browser API; hosts decide when to advance each retained continuation.
 */
export class Engine {
    free(): void;
    [Symbol.dispose](): void;
    configure(mode: string, elo: number, hash_mib: number, multi_pv: number, chess960: boolean, seed: string): void;
    configure_skill(mode: string, level: number, hash_mib: number, multi_pv: number, chess960: boolean, seed: string): void;
    evaluate(): number;
    limits_json(): string;
    constructor();
    play_uci(notation: string): void;
    report(): EngineReport;
    reset(): void;
    set_behavior(name: string, enabled: boolean): void;
    set_elo(elo: number): void;
    set_hash_mib(size: number): void;
    /**
     * Running budget changes retain the exact continuation; invalid updates change nothing.
     */
    set_limits(depth: number, nodes: string): EngineReport;
    set_mode(mode: string): void;
    set_multi_pv(count: number): void;
    set_parameter(name: string, value: number): void;
    set_position(fen: string, moves: string[]): void;
    /**
     * Validated preset control; level 21 disables deliberate strength reduction.
     */
    set_skill_level(level: number): void;
    /**
     * Calculate the adaptive worker soft limit while preserving a hard cap.
     */
    soft_time_limit_ms(original_opt_ms: string, max_ms: string, best_move_nodes: string, nodes: string, stability: number, score_delta: number): string;
    start(depth: number, nodes: string): EngineReport;
    /**
     * Maximum supported compute budget; selected approximate strength caps still apply.
     */
    start_full(): EngineReport;
    start_moves(depth: number, nodes: string, roots: string[]): EngineReport;
    step(work: number): EngineReport;
    stop(): EngineReport;
    tuning_json(): string;
    readonly chess960: boolean;
    readonly claims: string[];
    readonly elo: number;
    readonly fen: string;
    readonly hash_mib: number;
    readonly legal_moves: string[];
    readonly mode: string;
    readonly multi_pv: number;
    readonly outcome: string;
    readonly searching: boolean;
    readonly seed: string;
    readonly skill_level: number | undefined;
}

/**
 * An owned view; JavaScript should free it after copying its primitive data.
 */
export class EngineReport {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly best_move: string | undefined;
    readonly best_move_nodes: string;
    readonly depth: number;
    readonly finished: boolean;
    readonly mate: number | undefined;
    readonly nodes: string;
    readonly pv: string[];
    readonly score_cp: number | undefined;
    readonly selective_depth: number;
    readonly status: string;
    readonly tablebase_hits: string;
    readonly variations_json: string;
}

export function capabilities_json(): string;

/**
 * Unpacks a 32-byte binary bullet record into a text training line.
 */
export function decode_bullet_record(bytes: Uint8Array): string;

/**
 * Packs a single text training line into a 32-byte binary bullet record.
 */
export function encode_training_line(line: string): Uint8Array;

/**
 * Evaluates whether a single training line matches one of the 11 position filters.
 */
export function filter_training_line(line: string, filter: string): boolean;

/**
 * Returns UCI moves in the requested convention, or a FEN validation error.
 */
export function legal_moves(fen: string, chess960: boolean): string;

/**
 * Canonicalizes standard and Chess960 FEN; malformed positions return an error.
 */
export function normalize_fen(fen: string): string;

/**
 * Returns a decimal count to preserve integer precision in JavaScript.
 * Invalid FEN, fractional depths, and depths outside zero through six are errors.
 */
export function perft(fen: string, depth: number): string;

/**
 * Returns the resulting FEN or reports a notation or legality failure.
 */
export function play_uci(fen: string, notation: string, chess960: boolean): string;

/**
 * Raw quantized model units; engine reports use normalized centipawns instead.
 */
export function raw_evaluate(fen: string, model: string, perspective: string): number;

/**
 * Runs the portable benchmark suite for `count` positions at `depth` and returns JSON.
 */
export function run_benchmark_json(depth: number, count: number): string;

/**
 * Discover only implemented, validated search controls.
 */
export function search_controls_json(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_engine_free: (a: number, b: number) => void;
    readonly __wbg_enginereport_free: (a: number, b: number) => void;
    readonly capabilities_json: (a: number) => void;
    readonly decode_bullet_record: (a: number, b: number, c: number) => void;
    readonly encode_training_line: (a: number, b: number, c: number) => void;
    readonly engine_chess960: (a: number) => number;
    readonly engine_claims: (a: number, b: number) => void;
    readonly engine_configure: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => void;
    readonly engine_configure_skill: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => void;
    readonly engine_elo: (a: number) => number;
    readonly engine_evaluate: (a: number) => number;
    readonly engine_fen: (a: number, b: number) => void;
    readonly engine_hash_mib: (a: number) => number;
    readonly engine_legal_moves: (a: number, b: number) => void;
    readonly engine_limits_json: (a: number, b: number) => void;
    readonly engine_mode: (a: number, b: number) => void;
    readonly engine_multi_pv: (a: number) => number;
    readonly engine_new: (a: number) => void;
    readonly engine_outcome: (a: number, b: number) => void;
    readonly engine_play_uci: (a: number, b: number, c: number, d: number) => void;
    readonly engine_report: (a: number) => number;
    readonly engine_reset: (a: number, b: number) => void;
    readonly engine_searching: (a: number) => number;
    readonly engine_seed: (a: number, b: number) => void;
    readonly engine_set_behavior: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly engine_set_elo: (a: number, b: number, c: number) => void;
    readonly engine_set_hash_mib: (a: number, b: number, c: number) => void;
    readonly engine_set_limits: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly engine_set_mode: (a: number, b: number, c: number, d: number) => void;
    readonly engine_set_multi_pv: (a: number, b: number, c: number) => void;
    readonly engine_set_parameter: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly engine_set_position: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly engine_set_skill_level: (a: number, b: number, c: number) => void;
    readonly engine_skill_level: (a: number) => number;
    readonly engine_soft_time_limit_ms: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => void;
    readonly engine_start: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly engine_start_full: (a: number, b: number) => void;
    readonly engine_start_moves: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly engine_step: (a: number, b: number, c: number) => void;
    readonly engine_stop: (a: number) => number;
    readonly engine_tuning_json: (a: number, b: number) => void;
    readonly enginereport_best_move: (a: number, b: number) => void;
    readonly enginereport_best_move_nodes: (a: number, b: number) => void;
    readonly enginereport_depth: (a: number) => number;
    readonly enginereport_finished: (a: number) => number;
    readonly enginereport_mate: (a: number) => number;
    readonly enginereport_nodes: (a: number, b: number) => void;
    readonly enginereport_pv: (a: number, b: number) => void;
    readonly enginereport_score_cp: (a: number) => number;
    readonly enginereport_selective_depth: (a: number) => number;
    readonly enginereport_status: (a: number, b: number) => void;
    readonly enginereport_tablebase_hits: (a: number, b: number) => void;
    readonly enginereport_variations_json: (a: number, b: number) => void;
    readonly filter_training_line: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly legal_moves: (a: number, b: number, c: number, d: number) => void;
    readonly normalize_fen: (a: number, b: number, c: number) => void;
    readonly perft: (a: number, b: number, c: number, d: number) => void;
    readonly play_uci: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly raw_evaluate: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly run_benchmark_json: (a: number, b: number, c: number) => void;
    readonly search_controls_json: (a: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
