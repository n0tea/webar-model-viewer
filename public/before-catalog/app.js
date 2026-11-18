const start = document.querySelector('#start');
const intro = document.querySelector('#intro');
const introStatus = document.querySelector('#intro-status');
const cameraControls = document.querySelector('#camera-controls');
const cameraStatus = document.querySelector('#camera-status');
const modelCaption = document.querySelector('#model-caption');
const exit = document.querySelector('#exit');

const aframeUrl = 'https://aframe.io/releases/1.6.0/aframe.min.js';
const arjsUrl = 'https://raw.githack.com/AR-js-org/AR.js/3.4.7/aframe/build/aframe-ar.js';
const modelUrl = './ep20-mobile.glb';

function registerPoseSmoothing() {
  if (AFRAME.components['smooth-marker-pose']) return;

  AFRAME.registerComponent('smooth-marker-pose', {
    init() {
      const THREE = AFRAME.THREE;
      this.targetPosition = new THREE.Vector3();
      this.targetRotation = new THREE.Quaternion();
      this.position = new THREE.Vector3();
      this.rotation = new THREE.Quaternion();
      this.unitScale = new THREE.Vector3(1, 1, 1);
      this.ready = false;
    },

    capturePose() {
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

    tick(time, delta) {
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

function createCameraParameters(width, height) {
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

function fitCameraViewport(scene) {
  const session = scene.systems.arjs._arSession;
  const source = session.arSource;
  const context = session.arContext;
  const poseSmoothing = scene.querySelector('a-marker').components['smooth-marker-pose'];
  context.addEventListener('sourceProcessed', () => poseSmoothing.capturePose());

  // The tracker must process the same image aspect as the rendered video.
  // AR.js's portrait path crops the frame again, independently of the CSS crop.
  const initializeContext = context.init.bind(context);
  context.init = function (onCompleted) {
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
  source.copyElementSizeTo = function (element) {
    if (element === document.body) return;
    for (const property of ['width', 'height', 'marginLeft', 'marginTop']) {
      element.style[property] = this.domElement.style[property];
    }
  };

  // AR.js calls this every render frame. Keep DOM sizing in resize handlers.
  session.onResize = function () {
    if (!context.arController) return;
    scene.camera.projectionMatrix.fromArray(context.arController.getCameraMatrix());
    scene.camera.projectionMatrixInverse.copy(scene.camera.projectionMatrix).invert();
  };

  const renderSize = new AFRAME.THREE.Vector2();
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

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => {
      script.remove();
      reject(new Error('Не удалось загрузить ' + src));
    };
    document.head.append(script);
  });
}

function loadLocomotive(scene) {
  const model = scene.querySelector('#locomotive-model');
  const frame = scene.querySelector('#model-frame');

  model.addEventListener('model-loaded', ({ detail }) => {
    const THREE = AFRAME.THREE;
    // Measure a detached copy so the tracked marker pose cannot affect the bounds.
    const bounds = new THREE.Box3().setFromObject(detail.model.clone());
    const size = bounds.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(span) || span <= 0) return;

    const center = bounds.getCenter(new THREE.Vector3());
    model.object3D.position.set(-center.x, -bounds.min.y, -center.z);
    frame.object3D.scale.setScalar(2.2 / span);
    frame.setAttribute('visible', true);
    modelCaption.textContent = 'Модель загружена';
  }, { once: true });

  model.addEventListener('model-error', () => {
    modelCaption.textContent = 'Не удалось загрузить модель. Обновите страницу и попробуйте снова.';
  }, { once: true });
  model.setAttribute('gltf-model', modelUrl);
}

start.addEventListener('click', async () => {
  if (!window.isSecureContext || location.protocol === 'file:') {
    introStatus.textContent = 'Откройте сайт по HTTPS. При проверке с компьютера можно использовать localhost.';
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    introStatus.textContent = 'Браузер не предоставил доступ к камере. Откройте сайт в отдельной вкладке браузера.';
    return;
  }

  start.disabled = true;
  introStatus.textContent = 'Загружаем режим AR…';

  try {
    if (!window.AFRAME) await loadScript(aframeUrl);
    if (!window.AFRAME.systems.arjs) await loadScript(arjsUrl);
    if (!window.AFRAME.systems.arjs) throw new Error('AR.js не запустился');
  } catch (error) {
    console.error(error);
    introStatus.textContent = 'Режим AR не загрузился. Проверьте подключение к интернету и попробуйте ещё раз.';
    start.disabled = false;
    return;
  }

  registerPoseSmoothing();
  const scene = document.querySelector('#ar-scene').content
    .querySelector('a-scene').cloneNode(true);
  const marker = scene.querySelector('a-marker');
  scene.addEventListener('renderstart', () => {
    // AR.js creates its session in another listener for the same event.
    queueMicrotask(() => fitCameraViewport(scene));
  }, { once: true });

  window.addEventListener('arjs-video-loaded', () => {
    cameraStatus.textContent = 'Наведите камеру на метку Hiro. Держите всю рамку в кадре.';
  }, { once: true });
  window.addEventListener('camera-error', () => {
    cameraStatus.textContent = 'Камера недоступна. Разрешите доступ в настройках сайта или закройте приложение, занявшее камеру.';
  }, { once: true });
  marker.addEventListener('markerFound', () => {
    cameraStatus.textContent = 'Метка найдена. Рассмотрите модель с разных сторон.';
  });
  marker.addEventListener('markerLost', () => {
    cameraStatus.textContent = 'Верните метку целиком в кадр.';
  });

  intro.hidden = true;
  cameraControls.hidden = false;
  document.body.classList.add('camera-open');
  document.body.prepend(scene);
  loadLocomotive(scene);
  exit.focus();
});

// Closing the page session also releases the webcam and resets the tracker.
exit.addEventListener('click', () => location.reload());
