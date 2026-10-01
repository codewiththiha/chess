// Own worker startup, typed requests, cancellation, and compatible backend fallback.
import { discovery, report, supportsSimd } from './protocol';
import { object, text } from '../data/validation';
import { Cancelled } from './types';
import type { Discovery, Report } from './types';
import type { Backend } from '../domain/types';
interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
  progress?: (report: Report) => void;
}
export class WorkerTransport {
  private worker: Worker | null = null;
  private sequence = 0;
  private generation = 0;
  private pending = new Map<number, Pending>();
  private active: number | null = null;
  private startup: Promise<Discovery> | null = null;
  private abortBoot: ((error: Error) => void) | null = null;
  metadata: Discovery | null = null;
  backend: 'portable' | 'simd128' = 'portable';
  onFailure: (error: Error) => void = () => {};
  async init(choice: Backend): Promise<Discovery> {
    if (this.metadata) return this.metadata;
    if (this.startup) return this.startup;
    const generation = this.generation;
    const startup = this.start(choice, generation);
    this.startup = startup;
    try {
      return await startup;
    } finally {
      if (this.startup === startup) {
        this.startup = null;
        if (!this.metadata && generation === this.generation) this.release();
      }
    }
  }
  private async start(choice: Backend, generation: number): Promise<Discovery> {
    const preferred =
      choice === 'portable' || (choice === 'auto' && !supportsSimd())
        ? 'portable'
        : 'simd128';
    if (choice === 'simd128' && !supportsSimd())
      throw new Error(
        'This browser cannot run SIMD128. Choose Automatic or Portable.',
      );
    try {
      return await this.boot(preferred);
    } catch (error) {
      // A disposed startup must never clean up a newer worker or retry itself.
      if (generation !== this.generation || error instanceof Cancelled)
        throw new Cancelled();
      this.release();
      if (choice === 'auto' && preferred === 'simd128')
        return this.boot('portable');
      throw error;
    }
  }
  private boot(backend: 'portable' | 'simd128'): Promise<Discovery> {
    this.backend = backend;
    const url = new URL(
      `${import.meta.env.BASE_URL}engine/bridge-worker.mjs`,
      window.location.href,
    );
    url.searchParams.set('backend', backend);
    const worker = new Worker(url, { type: 'module', name: 'gwaymaegyi' });
    this.worker = worker;
    return new Promise((resolve, reject) => {
      let initializing = true;
      const timer = setTimeout(
        () =>
          abort(
            new Error('Engine startup timed out. Reload or choose Portable.'),
          ),
        30000,
      );
      const finish = () => {
        clearTimeout(timer);
        initializing = false;
        if (this.abortBoot === abort) this.abortBoot = null;
      };
      const abort = (error: Error) => {
        if (!initializing) return;
        finish();
        reject(error);
      };
      const error = (cause: Error) => {
        if (this.worker !== worker) return;
        if (initializing) abort(cause);
        else this.fail(cause);
      };
      this.abortBoot = abort;
      worker.addEventListener('message', (event: MessageEvent<unknown>) => {
        if (this.worker !== worker) return;
        try {
          const message = object(event.data);
          if (message.type === 'ready') {
            const metadata = discovery(message);
            finish();
            this.metadata = metadata;
            resolve(metadata);
          } else if (message.type === 'init-error')
            abort(new Error(text(message.error)));
          else this.receive(message);
        } catch (cause) {
          error(cause instanceof Error ? cause : new Error(String(cause)));
        }
      });
      worker.addEventListener('error', (event) =>
        error(new Error(event.message || 'The engine worker stopped.')),
      );
      worker.addEventListener('messageerror', () =>
        error(new Error('The browser could not read an engine reply.')),
      );
    });
  }
  private release(error: Error = new Cancelled()): void {
    this.abortBoot?.(error);
    this.abortBoot = null;
    for (const p of this.pending.values()) {
      if (p.timer) clearTimeout(p.timer);
      p.reject(error);
    }
    this.pending.clear();
    this.active = null;
    this.worker?.terminate();
    this.worker = null;
    this.metadata = null;
  }
  private fail(error: Error): void {
    this.release(error);
    this.onFailure(error);
  }
  private receive(message: Record<string, unknown>): void {
    if (typeof message.id !== 'number') return;
    const p = this.pending.get(message.id);
    if (!p) return;
    if (message.type === 'progress') {
      if (this.active === message.id) p.progress?.(report(message.report));
      return;
    }
    if (p.timer) clearTimeout(p.timer);
    this.pending.delete(message.id);
    if (this.active === message.id) this.active = null;
    if (message.type === 'error') p.reject(new Error(text(message.error)));
    else if (message.reason === 'replaced') p.reject(new Cancelled());
    else p.resolve(message);
  }
  send(
    type: string,
    payload: Record<string, unknown> = {},
    progress?: (r: Report) => void,
  ): Promise<unknown> {
    const worker = this.worker;
    if (!worker || !this.metadata)
      return Promise.reject(new Error('The engine is not ready.'));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer =
        type === 'start'
          ? null
          : setTimeout(() => {
              this.pending.delete(id);
              reject(
                new Error(`Engine ${type} timed out. Restart the engine.`),
              );
            }, 15000);
      this.pending.set(id, { resolve, reject, timer, progress });
      if (type === 'start') this.active = id;
      try {
        // oxlint-disable-next-line unicorn/require-post-message-target-origin -- Worker messages take transferables, not Window targetOrigin.
        worker.postMessage({ ...payload, id, type });
      } catch (cause) {
        if (timer) clearTimeout(timer);
        this.pending.delete(id);
        if (this.active === id) this.active = null;
        reject(cause instanceof Error ? cause : new Error(String(cause)));
      }
    });
  }
  async stop(): Promise<void> {
    if (!this.worker || !this.metadata) return;
    const old = this.active;
    this.active = null;
    if (old !== null) {
      const p = this.pending.get(old);
      if (p) {
        p.reject(new Cancelled());
        this.pending.delete(old);
      }
    }
    await this.send('stop');
  }
  dispose(): void {
    this.generation++;
    this.release();
    this.startup = null;
  }
}
