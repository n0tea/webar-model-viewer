import type { Entity, Scene } from './types';

export function registerPoseSmoothing() {
  if (window.AFRAME.components['smooth-marker-pose']) return;

  window.AFRAME.registerComponent('smooth-marker-pose', {
    init(this: any) {
      const THREE = window.AFRAME.THREE;
      this.targetPosition = new THREE.Vector3();
      this.targetRotation = new THREE.Quaternion();
      this.position = new THREE.Vector3();
      this.rotation = new THREE.Quaternion();
      this.unitScale = new THREE.Vector3(1, 1, 1);
      this.ready = false;
    },

    capturePose(this: any) {
      const object = this.el.components['arjs-anchor']._arAnchor?.controls.object3d;
      if (!object?.visible) {
        this.ready = false;
        return;
      }
      this.targetPosition.copy(object.position);
      this.targetRotation.copy(object.quaternion).normalize();
      if (!this.ready) {
        this.position.copy(this.targetPosition);
        this.rotation.copy(this.targetRotation);
        this.ready = true;
      }
    },

    tick(this: any, _time: number, delta: number) {
      if (!this.ready) return;
      const blend = 1 - Math.exp(-Math.min(delta, 100) / 35);
      this.position.lerp(this.targetPosition, blend);
      this.rotation.slerp(this.targetRotation, blend);
      const object = this.el.object3D;
      object.position.copy(this.position);
      object.quaternion.copy(this.rotation);
      object.scale.copy(this.unitScale);
      object.updateMatrix();
    },
  });
}

function createCameraParameters(width: number, height: number) {
  // ARToolkit v4 calibration format, with square pixels and a centred lens.
  // This is a generic lens estimate, not a calibration for a particular phone.
  const focalLength = 0.95 * Math.max(width, height);
  const values = [
    focalLength, 0, width / 2, 0,
    0, focalLength, height / 2, 0,
    0, 0, 1, 0,
    0, 0, 0, 0, focalLength, focalLength, width / 2, height / 2, 1,
  ];
  const buffer = new ArrayBuffer(8 + values.length * 8);
  const view = new DataView(buffer);
  view.setInt32(0, width);
  view.setInt32(4, height);
  values.forEach((value, index) => view.setFloat64(8 + index * 8, value));
  return URL.createObjectURL(new Blob([buffer], { type: 'application/octet-stream' }));
}

export function fitCameraViewport(scene: Scene) {
  const session = scene.systems.arjs._arSession;
  const source = session.arSource;
  const context = session.arContext;
  const poseSmoothing = (scene.querySelector('a-marker') as Entity).components['smooth-marker-pose'];
  context.addEventListener('sourceProcessed', () => poseSmoothing.capturePose());

  // The tracker must process the same image aspect as the rendered video.
  // AR.js's portrait path crops the frame again, independently of the CSS crop.
  const initializeContext = context.init.bind(context);
  context.init = function (onCompleted?: () => void) {
    const video = source.domElement;
    const initialize = () => {
      const scale = 640 / Math.max(video.videoWidth, video.videoHeight);
      context.parameters.canvasWidth = Math.round(video.videoWidth * scale);
      context.parameters.canvasHeight = Math.round(video.videoHeight * scale);
      const cameraParametersUrl = createCameraParameters(
        context.parameters.canvasWidth, context.parameters.canvasHeight,
      );
      context.parameters.cameraParametersUrl = cameraParametersUrl;
      initializeContext(() => {
        URL.revokeObjectURL(cameraParametersUrl);
        onCompleted?.();
        // Use ARToolkit's direct image copy in both camera orientations.
        context.arController.orientation = 'landscape';
        context.arController.options.orientation = 'landscape';
      });
    };
    if (video.videoWidth && video.videoHeight) initialize();
    else video.addEventListener('loadedmetadata', initialize, { once: true });
    return context;
  };

  // AR.js 3.4.7 forces 4:3 in portrait and copies that size to body.
  // Keep the page at viewport size and apply the same crop to video and canvas.
  source.copyElementSizeTo = function (this: any, element: HTMLElement) {
    if (element === document.body) return;
    for (const property of ['width', 'height', 'marginLeft', 'marginTop'] as const) {
      element.style[property] = this.domElement.style[property];
    }
  };

  // AR.js calls this every render frame. Keep DOM sizing in resize handlers.
  session.onResize = function () {
    if (!context.arController) return;
    scene.camera.projectionMatrix.fromArray(context.arController.getCameraMatrix());
    scene.camera.projectionMatrixInverse.copy(scene.camera.projectionMatrix).invert();
  };

  const renderSize = new window.AFRAME.THREE.Vector2();
  function resize() {
    const video = source.domElement;
    if (!video.videoWidth || !video.videoHeight) return;

    source.onResizeElement();
    const width = parseFloat(video.style.width);
    const height = parseFloat(video.style.height);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5, 1280 / Math.max(width, height));
    if (scene.renderer.getPixelRatio() !== pixelRatio) scene.renderer.setPixelRatio(pixelRatio);
    scene.renderer.getSize(renderSize);
    if (renderSize.x !== width || renderSize.y !== height) {
      scene.renderer.setSize(width, height, false);
    }
    source.copyElementSizeTo(scene.canvas);
  }

  source.domElement.addEventListener('loadedmetadata', resize);
  source.domElement.addEventListener('resize', resize);
  window.addEventListener('resize', resize);
  resize();
}
