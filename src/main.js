import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
fillLight.position.set(-5, 5, -5);
scene.add(fillLight);

// Grid helper
const grid = new THREE.GridHelper(20, 40, 0x444466, 0x333355);
scene.add(grid);

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

// Animation
const clock = new THREE.Clock();
let mixer = null;
let currentAction = null;
const actions = [];

const FPS = 30;

// Frame ranges extracted from the FBX notes field
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

  actions.forEach((a) => a.stop());
  nextAction.reset().play();
  currentAction = nextAction;
}

// Load FBX model
const loader = new FBXLoader();
loader.setResourcePath(textureBasePath);
loader.load(
  `${base}60kw Generator Ver 1.fbx`,
  (object) => {
    fixMaterials(object);
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

    // Auto-fit camera to model
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    object.position.sub(center);
    object.position.y += size.y / 2;

    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 2;
    camera.position.set(distance, distance * 0.6, distance);
    camera.far = maxDim * 20;
    camera.updateProjectionMatrix();

    controls.target.set(0, size.y / 2, 0);
    controls.update();
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

// Resize handling
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);
  controls.update();
  renderer.render(scene, camera);
}

animate();
