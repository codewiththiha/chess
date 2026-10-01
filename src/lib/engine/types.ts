// Describe discovery and search messages emitted by the verified engine SDK.
import type { EngineMode } from '../domain/types';
export interface ParameterSpec {
  name: string;
  default: number;
  min: number;
  max: number;
}
export interface Capabilities {
  version: string;
  modes: EngineMode[];
  eloMin: number;
  eloMax: number;
  eloCalibrated: boolean;
  maxDepth: number;
  maxMultiPv: number;
  maxHashMiB: number;
  maxWork: number;
  simd128: boolean;
  liveLimits: boolean;
  cooperativeSearch: boolean;
  chess960: boolean;
  nativeSyzygy: boolean;
}
export interface Discovery {
  capabilities: Capabilities;
  controls: { behaviors: string[]; parameters: ParameterSpec[] };
  defaults: {
    behaviors: Record<string, boolean>;
    parameters: Record<string, number>;
  };
}
export interface Report {
  status: string;
  finished: boolean;
  depth: number;
  selectiveDepth: number;
  nodes: string;
  bestMove: string | null;
  scoreCp: number | null;
  mate: number | null;
  pv: string[];
  variations: { scoreCp: number; pv: string[] }[];
}
export class Cancelled extends Error {
  constructor() {
    super('Search cancelled.');
    this.name = 'AbortError';
  }
}
