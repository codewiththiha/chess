// Provide isolated worker fault simulation with discovery obtained from the real portable WASM.
import { readFile } from 'node:fs/promises';
import * as wasm from '../../public/engine/portable/gwaymaegyi_wasm.js';
import { object } from '../../src/lib/data/validation';
export class TestWorker extends EventTarget {
  static instances: TestWorker[] = [];
  messages: Record<string, unknown>[] = [];
  terminated = false;
  refuseSend = false;
  automaticReplies = false;
  constructor(readonly url: URL) {
    super();
    TestWorker.instances.push(this);
  }
  postMessage(value: unknown): void {
    if (this.refuseSend)
      throw new DOMException('Cannot clone input', 'DataCloneError');
    const message = object(value);
    this.messages.push(message);
    if (this.automaticReplies)
      queueMicrotask(() => this.emit({ type: 'ack', id: message.id }));
  }
  terminate(): void {
    this.terminated = true;
  }
  emit(value: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data: value }));
  }
  crash(): void {
    const event = new Event('error');
    Object.defineProperty(event, 'message', { value: 'worker crashed' });
    this.dispatchEvent(event);
  }
}
export function worker(index = 0): TestWorker {
  const value = TestWorker.instances[index];
  if (!value) throw new Error('Expected worker was not created');
  return value;
}
export async function engineReadyMessage(): Promise<Record<string, unknown>> {
  await wasm.default({
    module_or_path: await readFile(
      new URL(
        '../../public/engine/portable/gwaymaegyi_wasm_bg.wasm',
        import.meta.url,
      ),
    ),
  });
  const engine = new wasm.Engine();
  try {
    return {
      type: 'ready',
      capabilities: JSON.parse(wasm.capabilities_json()),
      controls: JSON.parse(wasm.search_controls_json()),
      tuning: JSON.parse(engine.tuning_json()),
    };
  } finally {
    engine.free();
  }
}
