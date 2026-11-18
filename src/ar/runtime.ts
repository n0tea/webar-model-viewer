import { assetUrl, type ModelEntry } from '../catalog';
import { fitCameraViewport, registerPoseSmoothing } from './camera';
import { ModelLoader, type LoadState } from './model-loader';
import type { Scene } from './types';

let scripts: Promise<void> | undefined;
function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => { script.remove(); reject(new Error(`Не удалось загрузить ${src}`)); };
    document.head.append(script);
  });
}
export async function prepareAR() {
  if (!window.isSecureContext || location.protocol === 'file:') throw new Error('Откройте сайт по HTTPS или через localhost.');
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Камера недоступна. Откройте сайт в отдельной вкладке браузера.');
  scripts ??= (async () => {
    if (!window.AFRAME) await loadScript(assetUrl('vendor/aframe/aframe.min.js'));
    if (!window.AFRAME.systems.arjs) await loadScript(assetUrl('vendor/arjs/aframe-ar.js'));
    if (!window.AFRAME.systems.arjs) throw new Error('Не удалось запустить AR.js.');
    registerPoseSmoothing();
  })().catch((error) => { scripts = undefined; throw error; });
  return scripts;
}
export class ARRuntime {
  readonly scene: Scene;
  private loader?: ModelLoader;
  private stopped = false;
  private listeners = new AbortController();
  private ready: Promise<void>;

  constructor(onLoad: (state: LoadState) => void, onStatus: (status: string) => void) {
    const scene = this.scene = document.createElement('a-scene') as Scene;
    scene.setAttribute('embedded', '');
    scene.setAttribute('xr-mode-ui', 'enabled: false');
    scene.setAttribute('renderer', 'alpha: true; antialias: auto');
    scene.setAttribute('gltf-model', `dracoDecoderPath: ${assetUrl('vendor/draco/')}`);
    scene.setAttribute('arjs', 'sourceType: webcam; sourceWidth: 1280; sourceHeight: 960; detectionMode: mono; maxDetectionRate: 30; debugUIEnabled: false');
    scene.innerHTML = `
      <a-entity light="type: ambient; intensity: 1.1"></a-entity>
      <a-entity light="type: directional; intensity: 2" position="1 3 2"></a-entity>
      <a-marker type="pattern" url="${assetUrl('markers/hiro.patt')}" emitevents="true" smooth="false" smooth-marker-pose>
        <a-entity id="model-frame" visible="false"><a-entity id="locomotive-model"></a-entity></a-entity>
      </a-marker>
      <a-entity camera></a-entity>`;
    const options = { signal: this.listeners.signal };
    window.addEventListener('arjs-video-loaded', () => onStatus('Наведите камеру на метку Hiro. Держите всю рамку в кадре.'), options);
    window.addEventListener('camera-error', () => onStatus('Камера недоступна. Разрешите доступ в настройках сайта или закройте приложение, занявшее камеру.'), options);
    const marker = scene.querySelector('a-marker')!;
    marker.addEventListener('markerFound', () => onStatus('Метка найдена. Рассмотрите модель с разных сторон.'), options);
    marker.addEventListener('markerLost', () => onStatus('Верните метку целиком в кадр.'), options);
    this.ready = new Promise((resolve) => {
      scene.addEventListener('renderstart', () => queueMicrotask(() => {
        if (this.stopped) return;
        fitCameraViewport(scene);
        this.loader = new ModelLoader(scene, onLoad);
        resolve();
      }), { once: true });
    });
    document.body.classList.add('camera-open');
    document.body.prepend(scene);
  }
  async select(model: ModelEntry) {
    await this.ready;
    if (!this.stopped) await this.loader?.load(model);
  }
  close() {
    if (this.stopped) return;
    this.stopped = true;
    this.listeners.abort();
    this.loader?.dispose();
    const video = document.querySelector<HTMLVideoElement>('#arjs-video');
    if (video?.srcObject instanceof MediaStream) video.srcObject.getTracks().forEach((track) => track.stop());
    // Preserve the tested full-session reset: AR.js owns window listeners and camera startup.
    // Reload also terminates outstanding Draco workers and pending camera requests.
    location.reload();
  }
}
