import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ModelLoader, disposeModel } from '../src/ar/model-loader.ts';

const entry = { id: 'one', name: 'One', description: '', url: '/one.glb', preview: '', bytes: 4, markerSpan: 2.2 };
const response = () => new Response(new Uint8Array([1, 2, 3, 4]), { headers: { 'Content-Length': '4' } });
function resource() {
  let disposed = 0;
  return { dispose() { ++disposed; }, get disposed() { return disposed; } };
}
function model() {
  const geometry = resource(), texture = Object.assign(resource(), { isTexture: true });
  const material = Object.assign(resource(), { map: texture });
  const children = [{ geometry, material }, { geometry, material }];
  return { geometry, material, texture, root: { traverse: (visit: (o: unknown) => void) => children.forEach(visit), updateMatrixWorld() {} } };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
function setup(parse: () => Promise<any>) {
  const entity = { mesh: undefined as unknown, object3D: { position: { set() {} } }, removeObject3D() { this.mesh = undefined; }, setObject3D(_: string, object: unknown) { this.mesh = object; } };
  const frame = { object3D: { visible: false, scale: { setScalar() {} } }, setAttribute() {} };
  const scene = { querySelector: (selector: string) => selector === '#model-frame' ? frame : entity, renderer: { renderLists: { dispose() {} } }, systems: { 'gltf-model': { getDRACOLoader() {} } } };
  class Vector3 {}
  class Box3 {
    min = { y: 0 };
    setFromObject() { return this; }
    getSize() { return { x: 10, y: 2, z: 3 }; }
    getCenter() { return { x: 0, z: 0 }; }
  }
  Object.assign(globalThis, { location: { href: 'https://example.com/demo/' }, window: { AFRAME: { THREE: { Vector3, Box3, GLTFLoader: class { setDRACOLoader() {} parseAsync() { return parse(); } } } } } });
  return { scene, entity, frame };
}

test('shared geometry, materials and textures are disposed once', () => {
  const counts = { geometry: 0, material: 0, texture: 0 };
  const geometry = { dispose: () => counts.geometry++ };
  const texture = { isTexture: true, dispose: () => counts.texture++ };
  const material = { map: texture, dispose: () => counts.material++ };
  const root = { traverse: (visit: (o: unknown) => void) => [{ geometry, material }, { geometry, material: [material] }].forEach(visit) };
  disposeModel(root as any);
  assert.deepEqual(counts, { geometry: 1, material: 1, texture: 1 });
});

test('switching aborts a download and reports indeterminate progress without a length', async () => {
  const original = globalThis.fetch;
  try {
    const calls: AbortSignal[] = [];
    globalThis.fetch = async (_url, options) => {
      calls.push(options!.signal!);
      if (calls.length === 1) return new Promise((_resolve, reject) => options!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
      return new Response(new Uint8Array([1, 2, 3, 4]));
    };
    const current = model();
    const { scene, entity } = setup(async () => ({ scene: current.root }));
    const states: any[] = [];
    const loader = new ModelLoader(scene as any, (s) => states.push(s));
    const first = loader.load(entry);
    const second = loader.load({ ...entry, id: 'two' });
    await Promise.all([first, second]);
    assert(calls[0].aborted);
    assert.equal(entity.mesh, current.root);
    assert.equal(states.at(-1).phase, 'ready');
    assert(!states.some((s) => s.phase === 'error'));
    assert(states.some((s) => s.phase === 'downloading' && s.total === undefined));
    loader.dispose();
    assert.equal(entity.mesh, undefined);
  } finally { globalThis.fetch = original; }
});

test('late decode is discarded; current model is disposed on switch and shutdown', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => response();
    const stale = model(), current = model(), next = model();
    const pending = deferred<any>(), entered = deferred<void>();
    let parseCount = 0;
    const { scene, entity } = setup(() => {
      if (++parseCount === 1) { entered.resolve(); return pending.promise; }
      return Promise.resolve({ scene: parseCount === 2 ? current.root : next.root });
    });
    const loader = new ModelLoader(scene as any, () => {});
    const first = loader.load(entry);
    await entered.promise;
    await loader.load({ ...entry, id: 'two' });
    pending.resolve({ scene: stale.root });
    await first;
    assert.equal(stale.geometry.disposed, 1);
    assert.equal(entity.mesh, current.root);
    assert.equal(current.geometry.disposed, 0);
    await loader.load(entry);
    assert.equal(current.geometry.disposed, 1);
    assert.equal(entity.mesh, next.root);
    loader.dispose();
    assert.equal(next.geometry.disposed, 1);
  } finally { globalThis.fetch = original; }
});

test('HTTP failure can be retried', async () => {
  const original = globalThis.fetch;
  const originalError = console.error;
  try {
    console.error = () => {};
    let calls = 0;
    globalThis.fetch = async () => ++calls === 1 ? new Response('', { status: 503 }) : response();
    const { scene, entity } = setup(async () => ({ scene: model().root }));
    const states: any[] = [];
    const loader = new ModelLoader(scene as any, (s) => states.push(s));
    await loader.load(entry);
    assert.equal(states.at(-1).phase, 'error');
    assert.equal(entity.mesh, undefined);
    await loader.load(entry);
    assert.equal(states.at(-1).phase, 'ready');
    loader.dispose();
  } finally { globalThis.fetch = original; console.error = originalError; }
});
