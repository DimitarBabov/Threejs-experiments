import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

// ── Scene ──
const scene = new THREE.Scene();
const defaultBackground = new THREE.Color(0x1a1a2e);
scene.background = defaultBackground;

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

// ── Renderer with XR ──
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

document.body.appendChild(VRButton.createButton(renderer));
document.body.appendChild(ARButton.createButton(renderer, {
  requiredFeatures: ['local-floor'],
  optionalFeatures: ['hand-tracking'],
}));

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ── Lights ──
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
fillLight.position.set(-5, 5, -5);
scene.add(fillLight);

// ── Grid ──
const grid = new THREE.GridHelper(10, 20, 0x444466, 0x333355);
scene.add(grid);

// ── Textures ──
const base = import.meta.env.BASE_URL;
const textureBasePath = `${base}60kw Generator Ver 2/`;
const textureLoader = new THREE.TextureLoader();

function fixMaterials(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    materials.forEach((mat) => {
      if (mat.map) {
        const originalName = mat.map.name || mat.map.sourceFile || '';
        const texFiles = [
          'lambert1_2D_View_1001.png',
          'lambert1_2D_View_1002.png',
          'lambert1_2D_View_1003.png',
        ];
        const match = texFiles.find(
          (f) => originalName.includes(f) || originalName.includes(f.replace('.png', ''))
        );
        if (match) {
          mat.map = textureLoader.load(textureBasePath + match);
          mat.map.colorSpace = THREE.SRGBColorSpace;
          mat.needsUpdate = true;
        }
      }
    });
  });
}

// ── Animation data ──
const clock = new THREE.Clock();
let mixer = null;
let currentAction = null;
let currentAnimIndex = -1;
const actions = [];

const FPS = 30;

const ANIM_CLIPS = [
  { name: 'Lf Door',                    start: 1,    end: 200  },
  { name: 'Rt Door',                    start: 200,  end: 400  },
  { name: 'Fuel Tank Door',             start: 400,  end: 600  },
  { name: 'Output Terminal Door',       start: 600,  end: 800  },
  { name: 'Control Cover',              start: 800,  end: 900  },
  { name: 'Back Door',                  start: 900,  end: 1000 },
  { name: 'Air Filter 01',              start: 1000, end: 1150 },
  { name: 'Air Filter 02',              start: 1150, end: 1230 },
  { name: 'Air Filter 03',              start: 1230, end: 1300 },
  { name: 'Air Filter 04',              start: 1300, end: 1450 },
  { name: 'Oil Change 01',              start: 1500, end: 1960 },
  { name: 'Oil Change 02',              start: 1960, end: 2180 },
  { name: 'Oil Change 03',              start: 2180, end: 2500 },
  { name: 'Oil Change 04',              start: 2480, end: 2560 },
  { name: 'Oil Change 05',              start: 2560, end: 2650 },
  { name: 'Serpentine Belt Removal 01', start: 2700, end: 2880 },
  { name: 'Serpentine Belt Removal 03', start: 2880, end: 3050 },
  { name: 'Serpentine Belt Removal 04', start: 3060, end: 3320 },
  { name: 'Coolant Flush 01',           start: 3360, end: 3401 },
];

function playAnimation(index) {
  if (index < 0 || index >= actions.length) return;
  const nextAction = actions[index];
  if (nextAction === currentAction) return;

  document.querySelectorAll('.anim-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
  });

  updateVRPanelHighlight(index);

  actions.forEach((a) => a.stop());
  nextAction.reset().play();
  currentAction = nextAction;
  currentAnimIndex = index;
}

// ── VR Controllers ──
const controller0 = renderer.xr.getController(0);
const controller1 = renderer.xr.getController(1);
scene.add(controller0);
scene.add(controller1);

const controllerModelFactory = new XRControllerModelFactory();

const grip0 = renderer.xr.getControllerGrip(0);
grip0.add(controllerModelFactory.createControllerModel(grip0));
scene.add(grip0);

const grip1 = renderer.xr.getControllerGrip(1);
grip1.add(controllerModelFactory.createControllerModel(grip1));
scene.add(grip1);

function createRayLine() {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -5),
  ]);
  const mat = new THREE.LineBasicMaterial({ color: 0x6c63ff, linewidth: 2 });
  return new THREE.Line(geo, mat);
}

const ray0 = createRayLine();
const ray1 = createRayLine();
controller0.add(ray0);
controller1.add(ray1);

// ── In-world VR menu panel ──
const vrMenuGroup = new THREE.Group();
vrMenuGroup.visible = false;
scene.add(vrMenuGroup);

const vrButtons = [];
const BUTTON_WIDTH = 0.5;
const BUTTON_HEIGHT = 0.06;
const BUTTON_GAP = 0.01;
const PANEL_PADDING = 0.03;
const COLUMNS = 2;

const normalColor = new THREE.Color(0x2a2a4a);
const hoverColor = new THREE.Color(0x4a3a8a);
const activeColor = new THREE.Color(0x6c63ff);

function createVRMenuPanel() {
  const rows = Math.ceil(ANIM_CLIPS.length / COLUMNS);
  const totalW = COLUMNS * BUTTON_WIDTH + (COLUMNS - 1) * BUTTON_GAP + 2 * PANEL_PADDING;
  const totalH = rows * BUTTON_HEIGHT + (rows - 1) * BUTTON_GAP + 2 * PANEL_PADDING + 0.08;

  const bgGeo = new THREE.PlaneGeometry(totalW, totalH);
  const bgMat = new THREE.MeshBasicMaterial({
    color: 0x0e0e1e,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });
  const bg = new THREE.Mesh(bgGeo, bgMat);
  vrMenuGroup.add(bg);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ANIMATIONS', 256, 42);
  const titleTex = new THREE.CanvasTexture(canvas);
  const titleGeo = new THREE.PlaneGeometry(0.4, 0.05);
  const titleMat = new THREE.MeshBasicMaterial({ map: titleTex, transparent: true });
  const titleMesh = new THREE.Mesh(titleGeo, titleMat);
  titleMesh.position.set(0, totalH / 2 - 0.06, 0.001);
  vrMenuGroup.add(titleMesh);

  ANIM_CLIPS.forEach((clip, i) => {
    const col = i % COLUMNS;
    const row = Math.floor(i / COLUMNS);

    const x = -totalW / 2 + PANEL_PADDING + BUTTON_WIDTH / 2 + col * (BUTTON_WIDTH + BUTTON_GAP);
    const y = totalH / 2 - 0.1 - PANEL_PADDING - BUTTON_HEIGHT / 2 - row * (BUTTON_HEIGHT + BUTTON_GAP);

    const btnGeo = new THREE.PlaneGeometry(BUTTON_WIDTH, BUTTON_HEIGHT);
    const btnMat = new THREE.MeshBasicMaterial({ color: normalColor.clone(), side: THREE.DoubleSide });
    const btnMesh = new THREE.Mesh(btnGeo, btnMat);
    btnMesh.position.set(x, y, 0.002);
    btnMesh.userData.animIndex = i;
    vrMenuGroup.add(btnMesh);
    vrButtons.push(btnMesh);

    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 512;
    labelCanvas.height = 64;
    const lCtx = labelCanvas.getContext('2d');
    lCtx.fillStyle = '#cccccc';
    lCtx.font = '28px system-ui, sans-serif';
    lCtx.textAlign = 'center';
    lCtx.textBaseline = 'middle';
    lCtx.fillText(clip.name, 256, 32);
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelGeo = new THREE.PlaneGeometry(BUTTON_WIDTH * 0.9, BUTTON_HEIGHT * 0.8);
    const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.set(x, y, 0.003);
    vrMenuGroup.add(labelMesh);
  });

  vrMenuGroup.position.set(0, 1.5, -2);
}

createVRMenuPanel();

function updateVRPanelHighlight(activeIndex) {
  vrButtons.forEach((btn) => {
    const isActive = btn.userData.animIndex === activeIndex;
    btn.material.color.copy(isActive ? activeColor : normalColor);
  });
}

// ── VR Raycasting ──
const raycaster = new THREE.Raycaster();
const tempMatrix = new THREE.Matrix4();
let hoveredButton = null;

function getControllerIntersections(controller) {
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  return raycaster.intersectObjects(vrButtons, false);
}

function handleControllerHover() {
  let newHover = null;

  for (const controller of [controller0, controller1]) {
    const hits = getControllerIntersections(controller);
    if (hits.length > 0) {
      newHover = hits[0].object;
      break;
    }
  }

  if (hoveredButton && hoveredButton !== newHover) {
    const isActive = hoveredButton.userData.animIndex === currentAnimIndex;
    hoveredButton.material.color.copy(isActive ? activeColor : normalColor);
  }

  if (newHover && newHover !== hoveredButton) {
    const isActive = newHover.userData.animIndex === currentAnimIndex;
    if (!isActive) newHover.material.color.copy(hoverColor);
  }

  hoveredButton = newHover;
}

function onSelectStart() {
  if (hoveredButton) {
    playAnimation(hoveredButton.userData.animIndex);
  }
}

controller0.addEventListener('selectstart', onSelectStart);
controller1.addEventListener('selectstart', onSelectStart);

// Save/restore camera between XR sessions
const savedCameraState = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };

renderer.xr.addEventListener('sessionstart', () => {
  // Save non-XR camera state before XR takes over
  savedCameraState.position.copy(camera.position);
  savedCameraState.quaternion.copy(camera.quaternion);

  // Reset camera so XR tracking starts clean from the origin
  camera.position.set(0, 0, 0);
  camera.quaternion.identity();

  vrMenuGroup.visible = true;

  const session = renderer.xr.getSession();
  if (session && session.environmentBlendMode !== 'opaque') {
    scene.background = null;
    grid.visible = false;
  }
});

renderer.xr.addEventListener('sessionend', () => {
  // Restore non-XR camera state
  camera.position.copy(savedCameraState.position);
  camera.quaternion.copy(savedCameraState.quaternion);

  vrMenuGroup.visible = false;
  scene.background = defaultBackground;
  grid.visible = true;
});

// ── Load FBX model ──
const loader = new FBXLoader();
loader.setResourcePath(textureBasePath);
loader.load(
  `${base}60kw Generator Ver 1.fbx`,
  (object) => {
    fixMaterials(object);

    // FBX is in centimeters, WebXR uses meters
    const CM_TO_M = 0.01;
    object.scale.setScalar(CM_TO_M);

    scene.add(object);

    const container = document.getElementById('anim-buttons');
    container.innerHTML = '';

    if (object.animations && object.animations.length > 0) {
      mixer = new THREE.AnimationMixer(object);
      const fullClip = object.animations[0];
      console.log(`Full clip: "${fullClip.name}" — ${fullClip.duration.toFixed(2)}s, ${fullClip.tracks.length} tracks`);

      ANIM_CLIPS.forEach((def, i) => {
        const startTime = def.start / FPS;
        const endTime = def.end / FPS;
        const subClip = THREE.AnimationUtils.subclip(fullClip, def.name, def.start, def.end, FPS);
        console.log(`  [${i}] "${def.name}" — ${startTime.toFixed(2)}s to ${endTime.toFixed(2)}s`);

        const action = mixer.clipAction(subClip);
        action.setLoop(THREE.LoopOnce);
        action.clampWhenFinished = true;
        actions.push(action);

        const btn = document.createElement('button');
        btn.className = 'anim-btn';
        btn.textContent = def.name;
        btn.addEventListener('click', () => playAnimation(i));
        container.appendChild(btn);
      });
    } else {
      container.innerHTML = '<span class="no-anims">No animations found</span>';
    }

    let box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());

    // Center horizontally, place bottom at y=0
    object.position.set(-center.x, -box.min.y, -center.z);

    // Recompute after repositioning
    box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 2;
    camera.position.set(distance, distance * 0.6, distance);
    camera.far = maxDim * 20;
    camera.updateProjectionMatrix();

    controls.target.set(0, size.y / 2, 0);
    controls.update();

    // Position VR menu relative to model size
    vrMenuGroup.position.set(-maxDim * 0.8, size.y * 0.6, -maxDim * 0.5);
    console.log(`Model size (meters): ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
  },
  (progress) => {
    if (progress.total) {
      const pct = ((progress.loaded / progress.total) * 100).toFixed(0);
      console.log(`Loading: ${pct}%`);
    }
  },
  (error) => {
    console.error('Error loading FBX:', error);
  }
);

// ── Resize ──
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Animation loop (setAnimationLoop for WebXR compatibility) ──
renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);

  if (renderer.xr.isPresenting) {
    handleControllerHover();
  } else {
    controls.update();
  }

  renderer.render(scene, camera);
});
