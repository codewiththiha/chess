// Simulate worker faults and races; discovery fixtures still come from the actual Rust WASM.
import {
  beforeAll,
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { WorkerTransport } from '../../src/lib/engine/transport';
import { Cancelled } from '../../src/lib/engine/types';
import { TestWorker, worker, engineReadyMessage } from './worker-fixture';
import { EngineClient } from '../../src/lib/engine/client';
import { defaultPreferences } from '../../src/lib/domain/preferences';
let ready: Record<string, unknown>;
const opened: WorkerTransport[] = [];
const clients: EngineClient[] = [];
function transport(): WorkerTransport {
  const t = new WorkerTransport();
  opened.push(t);
  return t;
}
beforeAll(async () => {
  ready = await engineReadyMessage();
});
beforeEach(() => {
  vi.useFakeTimers();
  TestWorker.instances = [];
  vi.stubGlobal('Worker', TestWorker);
  vi.stubGlobal('window', { location: { href: 'http://127.0.0.1:5173/' } });
});
afterEach(() => {
  for (const t of opened.splice(0)) t.dispose();
  for (const client of clients.splice(0)) client.dispose();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe('worker lifecycle', () => {
  it('shares a startup and validates complete discovery once', async () => {
    const t = transport();
    const first = t.init('portable');
    const second = t.init('portable');
    expect(TestWorker.instances).toHaveLength(1);
    worker().emit(ready);
    const [a, b] = await Promise.all([first, second]);
    expect(a).toBe(b);
    expect(a.controls.behaviors).toHaveLength(11);
    expect(a.controls.parameters).toHaveLength(38);
    expect(await t.init('portable')).toBe(a);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels startup immediately without terminating a newer initialization', async () => {
    const t = transport();
    const old = t.init('portable');
    const canceled = expect(old).rejects.toBeInstanceOf(Cancelled);
    t.dispose();
    const fresh = t.init('portable');
    worker().emit(ready);
    worker().crash();
    worker(1).emit(ready);
    await fresh;
    await canceled;
    await vi.advanceTimersByTimeAsync(30000);
    expect(worker().terminated).toBe(true);
    expect(worker(1).terminated).toBe(false);
    expect(t.metadata).not.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('automatically falls back after a SIMD startup failure', async () => {
    vi.spyOn(WebAssembly, 'validate').mockReturnValue(true);
    const t = transport();
    const start = t.init('auto');
    expect(worker().url.searchParams.get('backend')).toBe('simd128');
    worker().emit({ type: 'init-error', error: 'unsupported SIMD' });
    await vi.waitFor(() => expect(TestWorker.instances).toHaveLength(2));
    expect(worker(1).url.searchParams.get('backend')).toBe('portable');
    worker(1).emit(ready);
    await start;
    expect(t.backend).toBe('portable');
    expect(worker().terminated).toBe(true);
  });
  it('rejects malformed startup metadata and releases its timer', async () => {
    const t = transport();
    const start = t.init('portable');
    const rejected = expect(start).rejects.toThrow();
    worker().emit({ type: 'ready', capabilities: {} });
    await rejected;
    expect(t.metadata).toBeNull();
    expect(worker().terminated).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('suppresses late progress after cancellation while accepting the stop acknowledgement', async () => {
    const t = transport();
    const start = t.init('portable');
    worker().emit(ready);
    await start;
    const progress = vi.fn();
    const search = t.send('start', {}, progress);
    const searchId = worker().messages.at(-1)?.id;
    const canceled = expect(search).rejects.toBeInstanceOf(Cancelled);
    const stop = t.stop();
    const stopId = worker().messages.at(-1)?.id;
    worker().emit({
      type: 'progress',
      id: searchId,
      report: 'stale malformed payload',
    });
    worker().emit({ type: 'stopped', id: stopId });
    await stop;
    await canceled;
    expect(progress).not.toHaveBeenCalled();
  });
  it('cleans pending state when a structured-clone failure occurs', async () => {
    const t = transport();
    const start = t.init('portable');
    worker().emit(ready);
    await start;
    worker().refuseSend = true;
    await expect(t.send('configure')).rejects.toThrow('Cannot clone input');
    expect(vi.getTimerCount()).toBe(0);
    worker().refuseSend = false;
    const next = t.send('configure');
    worker().emit({ type: 'configured', id: worker().messages.at(-1)?.id });
    await next;
  });
  it('rejects jobs on worker death and can restart without stale error callbacks', async () => {
    const t = transport();
    const failure = vi.fn();
    t.onFailure = failure;
    const start = t.init('portable');
    worker().emit(ready);
    await start;
    const job = t.send('start');
    const rejected = expect(job).rejects.toThrow('worker crashed');
    worker().crash();
    await rejected;
    expect(failure).toHaveBeenCalledOnce();
    expect(t.metadata).toBeNull();
    const fresh = t.init('portable');
    worker().crash();
    worker(1).emit(ready);
    await fresh;
    expect(failure).toHaveBeenCalledOnce();
  });
});

it('does not apply an old queued policy to a reinitialized engine client', async () => {
  const client = new EngineClient();
  clients.push(client);
  const init = client.init('portable');
  worker().emit(ready);
  await init;
  const settings = defaultPreferences().engine;
  const first = client.configure(settings, false);
  const queued = client.configure({ ...settings, mode: 'aggressive' }, false);
  const canceledFirst = expect(first).rejects.toBeInstanceOf(Cancelled);
  const canceledQueued = expect(queued).rejects.toBeInstanceOf(Cancelled);
  await vi.waitFor(() => expect(worker().messages).toHaveLength(1));
  client.dispose();
  const fresh = client.init('portable');
  worker(1).automaticReplies = true;
  worker(1).emit(ready);
  await fresh;
  await client.configure({ ...settings, hashMiB: 16 }, false);
  await canceledFirst;
  await canceledQueued;
  const configs = worker(1).messages.filter((m) => m.type === 'configure');
  expect(configs).toHaveLength(1);
  expect(configs[0]?.options).toMatchObject({ mode: 'balanced', hashMiB: 16 });
});
