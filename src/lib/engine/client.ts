// Serialize policy changes and expose retained search operations to controllers.
import { WorkerTransport } from './transport';
import { report } from './protocol';
import { Cancelled } from './types';
import { object } from '../data/validation';
import { integer } from '../domain/preferences';
import type { Discovery, Report } from './types';
import type { Backend, ComputeSettings, EngineSettings } from '../domain/types';
export class EngineClient {
  private transport = new WorkerTransport();
  private configured = '';
  private generation = 0;
  private queue: Promise<void> = Promise.resolve();
  get metadata(): Discovery | null {
    return this.transport.metadata;
  }
  get backend(): 'portable' | 'simd128' {
    return this.transport.backend;
  }
  set onFailure(handler: (error: Error) => void) {
    this.transport.onFailure = handler;
  }
  init(backend: Backend): Promise<Discovery> {
    return this.transport.init(backend);
  }
  configure(
    settings: EngineSettings,
    chess960: boolean,
    analysis = false,
  ): Promise<void> {
    const generation = this.generation;
    const result = this.queue
      .catch(() => {})
      .then(() => {
        if (generation !== this.generation) throw new Cancelled();
        return this.apply(settings, chess960, analysis, generation);
      });
    this.queue = result;
    return result;
  }
  private async apply(
    settings: EngineSettings,
    chess960: boolean,
    analysis: boolean,
    generation: number,
  ): Promise<void> {
    const d = this.transport.metadata;
    if (!d) throw new Error('Engine discovery is unavailable.');
    const options = {
      mode: analysis ? 'analysis' : settings.mode,
      ...(analysis
        ? { skillLevel: 21 }
        : settings.strength === 'skill'
          ? { skillLevel: settings.skillLevel }
          : { elo: settings.elo }),
      hashMiB: settings.hashMiB,
      multiPv: settings.multiPv,
      chess960,
      seed: settings.seed,
    };
    const behaviors = { ...d.defaults.behaviors, ...settings.behaviors };
    const parameters = { ...d.defaults.parameters, ...settings.parameters };
    for (const spec of d.controls.parameters)
      integer(
        parameters[spec.name] ?? spec.default,
        spec.min,
        spec.max,
        spec.name,
      );
    for (const name of Object.keys(settings.behaviors))
      if (!d.controls.behaviors.includes(name))
        throw new Error(`Unknown behavior: ${name}.`);
    for (const name of Object.keys(settings.parameters))
      if (!d.controls.parameters.some((p) => p.name === name))
        throw new Error(`Unknown parameter: ${name}.`);
    const key = JSON.stringify({ options, behaviors, parameters });
    if (key === this.configured) return;
    await this.transport.send('configure', { options });
    for (const name of d.controls.behaviors) {
      if (generation !== this.generation) throw new Cancelled();
      await this.transport.send('behavior', {
        name,
        enabled: behaviors[name] ?? true,
      });
    }
    for (const spec of d.controls.parameters) {
      if (generation !== this.generation) throw new Cancelled();
      await this.transport.send('parameter', {
        name: spec.name,
        value: parameters[spec.name] ?? spec.default,
      });
    }
    if (generation !== this.generation) throw new Cancelled();
    this.configured = key;
  }
  async position(fen: string, moves: string[]): Promise<void> {
    await this.transport.send('position', { fen, moves });
  }
  async search(
    compute: ComputeSettings,
    progress?: (r: Report) => void,
    roots: string[] = [],
  ): Promise<Report> {
    const { profile: _profile, ...options } = compute;
    const result = object(
      await this.transport.send('start', { ...options, roots }, progress),
    );
    return report(result.report);
  }
  async performance(compute: ComputeSettings): Promise<void> {
    const { profile: _profile, ...options } = compute;
    await this.transport.send('performance', { options });
  }
  stop(): Promise<void> {
    return this.transport.stop();
  }
  dispose(): void {
    this.generation++;
    this.transport.dispose();
    this.configured = '';
    this.queue = Promise.resolve();
  }
}
