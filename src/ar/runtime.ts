import { assetUrl, type ModelEntry } from '../catalog';
import { fitCameraViewport, registerPoseSmoothing } from './camera';
import { ModelLoader, type LoadState } from './model-loader';
import type { Scene } from './types';
import { marker as target } from './marker';

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
  private paused = false;
  private cameraAttempt = 0;
  private selectedModel?: string;
  private firstCamera: Promise<void>;
  private videoInitialized = false;
  private ready: Promise<void>;

  constructor(onLoad: (state: LoadState) => void, onStatus: (status: string) => void) {
    const scene = this.scene = document.createElement('a-scene') as Scene;
    scene.setAttribute('embedded', '');
    scene.setAttribute('xr-mode-ui', 'enabled: false');
    scene.setAttribute('renderer', 'alpha: true; antialias: auto');
    scene.setAttribute('gltf-model', `dracoDecoderPath: ${assetUrl('vendor/draco/')}`);
    scene.setAttribute('arjs', `sourceType: webcam; sourceWidth: 1280; sourceHeight: 960; detectionMode: mono; patternRatio: ${target.patternRatio}; maxDetectionRate: 30; debugUIEnabled: false`);
    scene.innerHTML = `
      <a-entity light="type: ambient; intensity: 1.1"></a-entity>
      <a-entity light="type: directional; intensity: 2" position="1 3 2"></a-entity>
      <a-marker type="pattern" url="${target.patternUrl}" emitevents="true" smooth="false" smooth-marker-pose>
        <a-entity id="model-frame" visible="false"><a-entity id="locomotive-model"></a-entity></a-entity>
      </a-marker>
      <a-entity camera></a-entity>`;
    let cameraSettled!: () => void;
    this.firstCamera = new Promise((resolve) => { cameraSettled = resolve; });
    window.addEventListener('arjs-video-loaded', () => {
      this.videoInitialized = true;
      cameraSettled();
      if (this.paused) {
        this.stopVideo();
        // AR.js sets source.ready after dispatching this event.
        queueMicrotask(() => {
          if (this.paused) this.scene.systems.arjs._arSession.arSource.ready = false;
        });
      } else onStatus('Наведите камеру на QR-метку ТМХ. Держите всю чёрную рамку в кадре.');
    });
    window.addEventListener('camera-error', () => {
      cameraSettled();
      onStatus('Камера недоступна. Разрешите доступ в настройках сайта или закройте приложение, занявшее камеру.');
    });
    const marker = scene.querySelector('a-marker')!;
    marker.addEventListener('markerFound', () => onStatus('Метка найдена. Рассмотрите модель с разных сторон.'));
    marker.addEventListener('markerLost', () => onStatus('Поместите метку в кадр.'));
    this.ready = new Promise((resolve) => {
      scene.addEventListener('renderstart', () => queueMicrotask(() => {
        fitCameraViewport(scene);
        this.loader = new ModelLoader(scene, (state) => {
          if (state.phase === 'error') this.selectedModel = undefined;
          onLoad(state);
        });
        if (this.paused) this.pause(false);
        resolve();
      }), { once: true });
    });
    document.body.classList.add('camera-open');
    document.body.prepend(scene);
  }
  async select(model: ModelEntry) {
    await this.ready;
    const key = `${model.id}:${model.url}`;
    if (this.selectedModel === key) return;
    this.selectedModel = key;
    await this.loader?.load(model);
  }

  private stopVideo() {
    const video = this.scene.systems.arjs?._arSession?.arSource.domElement as HTMLVideoElement | undefined;
    if (!video) return;
    if (video.srcObject instanceof MediaStream) video.srcObject.getTracks().forEach((track) => track.stop());
    video.pause();
    video.srcObject = null;
    video.hidden = true;
  }

  pause(invalidateAttempt = true) {
    this.paused = true;
    if (invalidateAttempt) ++this.cameraAttempt;
    const source = this.scene.systems.arjs?._arSession?.arSource;
    if (source) source.ready = false;
    this.stopVideo();
    this.scene.pause();
    this.scene.renderer?.setAnimationLoop(null);
    this.scene.hidden = true;
    document.body.classList.remove('camera-open');
    // The same scene and model stay in memory; discard the previous camera's pose.
    const marker = this.scene.querySelector('a-marker') as import('./types').Entity;
    if (marker.components['smooth-marker-pose']) marker.components['smooth-marker-pose'].ready = false;
    marker.object3D.visible = false;
    const anchor = marker.components['arjs-anchor']?._arAnchor;
    if (anchor) {
      anchor.object3d.visible = false;
      if (anchor.controls) anchor.controls.object3d.visible = false;
    }
  }

  async resume() {
    const attempt = ++this.cameraAttempt;
    await this.ready;
    // Avoid competing with AR.js's initial getUserMedia request if closed during startup.
    await this.firstCamera;
    if (attempt !== this.cameraAttempt) return false;
    const source = this.scene.systems.arjs._arSession.arSource;
    const video = source.domElement as HTMLVideoElement;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'environment',
          width: { ideal: source.parameters.sourceWidth },
          height: { ideal: source.parameters.sourceHeight },
          ...(source.parameters.deviceId ? { deviceId: { exact: source.parameters.deviceId } } : {}),
        },
      });
    } catch (error) {
      if (attempt !== this.cameraAttempt) return false;
      throw error;
    }
    if (attempt !== this.cameraAttempt) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }
    video.srcObject = stream;
    try { await video.play(); }
    catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      if (attempt !== this.cameraAttempt) return false;
      throw error;
    }
    if (attempt !== this.cameraAttempt) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }
    this.paused = false;
    video.hidden = false;
    this.scene.hidden = false;
    document.body.classList.add('camera-open');
    source.ready = true;
    // The initial request may have failed before AR.js could initialize the tracker.
    if (!this.videoInitialized) window.dispatchEvent(new CustomEvent('arjs-video-loaded', { detail: { component: video } }));
    this.scene.play();
    this.scene.renderer.setAnimationLoop(this.scene.render);
    window.dispatchEvent(new Event('resize'));
    return true;
  }
}
