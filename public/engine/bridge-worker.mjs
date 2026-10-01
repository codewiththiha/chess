// Add discovery metadata to the unchanged, verified cooperative engine runtime.
const backend = new URL(self.location.href).searchParams.get('backend');
let runtime = null;
let failure = null;
let pending = [];
const send = self.postMessage.bind(self);
self.addEventListener('message', ({ data }) => {
  if (runtime) runtime.handle(data);
  else if (failure) send({ type: 'error', id: data?.id, error: failure });
  else if (pending.length < 128) pending.push(data);
  else send({ type: 'error', id: data?.id, error: 'startup queue is full' });
});
async function boot() {
  if (!['portable', 'simd128'].includes(backend))
    throw new Error('Unknown WASM backend.');
  const bindings = await import(`./${backend}/gwaymaegyi_wasm.js`);
  const { createRuntime } = await import(`./${backend}/worker-runtime.mjs`);
  await bindings.default();
  const engine = new bindings.Engine();
  runtime = createRuntime(
    () => engine,
    (message) => send(message),
  );
  send({
    type: 'ready',
    capabilities: JSON.parse(bindings.capabilities_json()),
    controls: JSON.parse(bindings.search_controls_json()),
    tuning: JSON.parse(engine.tuning_json()),
  });
  for (const message of pending) runtime.handle(message);
  pending = [];
}
boot().catch((error) => {
  failure = String(error);
  send({ type: 'init-error', error: failure });
  for (const message of pending)
    send({ type: 'error', id: message?.id, error: failure });
  pending = [];
});
