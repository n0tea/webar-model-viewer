import type { ModelEntry } from '../catalog';
import type { GLTF, ModelObject, Scene } from './types';
import type { Material, Texture, BufferGeometry, SkinnedMesh } from 'three';

export type LoadState =
  | { phase: 'idle' }
  | { phase: 'downloading'; loaded: number; total?: number }
  | { phase: 'decoding' }
  | { phase: 'ready' }
  | { phase: 'error'; message: string };

/** Resources can be shared between meshes: dispose each exactly once. */
export function disposeModel(root: ModelObject) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const bitmaps = new Set<ImageBitmap>();
  const skeletons = new Set<SkinnedMesh['skeleton']>();
  root.traverse((object) => {
    const mesh = object as SkinnedMesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.skeleton) skeletons.add(mesh.skeleton);
    if (mesh.material) {
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value?.isTexture) textures.add(value);
        }
      }
    }
  });
  for (const texture of textures) {
    const images = Array.isArray(texture.source?.data) ? texture.source.data : [texture.source?.data];
    for (const image of images) if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) bitmaps.add(image);
    texture.dispose();
  }
  bitmaps.forEach((bitmap) => bitmap.close());
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  skeletons.forEach((skeleton) => skeleton.dispose());
}

export class ModelLoader {
  private request = 0;
  private abort?: AbortController;
  private current?: ModelObject;
  private stopped = false;

  private scene: Scene;
  private notify: (state: LoadState) => void;

  constructor(scene: Scene, notify: (state: LoadState) => void) {
    this.scene = scene;
    this.notify = notify;
  }

  private release() {
    const entity = this.scene.querySelector('#locomotive-model') as import('./types').Entity;
    const frame = this.scene.querySelector('#model-frame') as import('./types').Entity;
    frame.object3D.visible = false;
    frame.setAttribute('visible', 'false');
    entity.removeObject3D('mesh');
    if (this.current) disposeModel(this.current);
    this.current = undefined;
    // Drop renderer references to objects removed since the previous frame.
    this.scene.renderer.renderLists.dispose();
  }

  async load(entry: ModelEntry) {
    if (this.stopped) return;
    const request = ++this.request;
    this.abort?.abort();
    const abort = this.abort = new AbortController();
    this.release();
    const active = () => !this.stopped && request === this.request;
    let decoded: GLTF | undefined;
    try {
      this.notify({ phase: 'downloading', loaded: 0 });
      const response = await fetch(entry.url, { signal: abort.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const length = Number(response.headers.get('Content-Length'));
      // Content-Length can describe the encoded HTTP body; use it only without transport compression.
      const total = length > 0 && !response.headers.get('Content-Encoding') ? length : undefined;
      let buffer: ArrayBuffer;
      if (response.body) {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let loaded = 0;
        let reported = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.byteLength;
          if (active() && performance.now() - reported > 100) {
            this.notify({ phase: 'downloading', loaded, total });
            reported = performance.now();
          }
        }
        buffer = new ArrayBuffer(loaded);
        const merged = new Uint8Array(buffer);
        let offset = 0;
        for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
        chunks.length = 0;
      } else buffer = await response.arrayBuffer();
      if (!active()) return;
      this.notify({ phase: 'decoding' });
      // Share the Three.js instance and Draco decoder owned by A-Frame.
      const loader = new window.AFRAME.THREE.GLTFLoader();
      loader.setDRACOLoader(this.scene.systems['gltf-model'].getDRACOLoader());
      decoded = await loader.parseAsync(buffer, new URL('.', new URL(entry.url, location.href)).href);
      // Draco parsing cannot be aborted; dispose late results instead of displaying them.
      if (!active()) { disposeModel(decoded.scene); return; }
      const THREE = window.AFRAME.THREE;
      const model = decoded.scene;
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const span = Math.max(size.x, size.y, size.z);
      if (!Number.isFinite(span) || span <= 0) throw new Error('Пустая геометрия');
      const center = bounds.getCenter(new THREE.Vector3());
      const entity = this.scene.querySelector('#locomotive-model') as import('./types').Entity;
      const frame = this.scene.querySelector('#model-frame') as import('./types').Entity;
      entity.object3D.position.set(-center.x, -bounds.min.y, -center.z);
      frame.object3D.scale.setScalar(entry.markerSpan / span);
      this.current = model;
      entity.setObject3D('mesh', model);
      frame.object3D.visible = true;
      frame.setAttribute('visible', 'true');
      this.notify({ phase: 'ready' });
    } catch (error) {
      if (decoded && decoded.scene !== this.current) disposeModel(decoded.scene);
      if (!active() || abort.signal.aborted) return;
      console.error('Model load failed', error);
      this.notify({ phase: 'error', message: 'Не удалось загрузить модель. Проверьте подключение и попробуйте снова.' });
    }
  }

  dispose() {
    this.stopped = true;
    ++this.request;
    this.abort?.abort();
    this.release();
  }
}
