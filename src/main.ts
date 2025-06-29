import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { Timer } from "three/examples/jsm/Addons.js";
// import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import GUI from "lil-gui";
import CustomShaderMaterial from "three-custom-shader-material/vanilla";
import slicedVertexShader from "./shaders/sliced/vertex.glsl";
import slicedFragmentShader from "./shaders/sliced/fragment.glsl";

/**
 * Set up Gui
 */

const gui = new GUI({ width: 340 });

const debugObject = {};

/**
 * Set up scene
 */

const scene = new THREE.Scene();

/**
 * Set up loaders
 */

const rgbeLoader = new RGBELoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

/**
 * Environment map
 */
const environmentMap = await rgbeLoader.loadAsync("/aerodynamics_workshop.hdr");

environmentMap.mapping = THREE.EquirectangularReflectionMapping;

// Increase environment lightness by adjusting intensity and exposure
scene.background = environmentMap;
scene.backgroundBlurriness = 0.5;
scene.environment = environmentMap;

/**
 * Sliced model
 */

// Material

const materialParams = {
  metalness: 1.0,
  roughness: 0.25,
  envMapIntensity: 0.5,
  color: "#858080",
};

const materialUniforms = {
  uSliceStart: new THREE.Uniform(1.0),
  uSliceArc: new THREE.Uniform(1.5),
};

const material = new THREE.MeshStandardMaterial({
  ...materialParams,
});

const patchMap = {
  csm_Slice: {
    "#include <colorspace_fragment>": `
    #include <colorspace_fragment>
    
    if(!gl_FrontFacing) 
        gl_FragColor = vec4(0.75, 0.15, 0.3, 1.0);
    

    `,
  },
};

const slicedMaterial = new CustomShaderMaterial<
  typeof THREE.MeshStandardMaterial
>({
  // CSM
  baseMaterial: THREE.MeshStandardMaterial,
  vertexShader: slicedVertexShader,
  fragmentShader: slicedFragmentShader,
  uniforms: materialUniforms,

  patchMap,

  // MeshStandardMaterial
  ...materialParams,

  side: THREE.DoubleSide,
});

const slicedDepthMaterial = new CustomShaderMaterial<
  typeof THREE.MeshDepthMaterial
>({
  // CSM
  baseMaterial: THREE.MeshDepthMaterial,
  vertexShader: slicedVertexShader,
  fragmentShader: slicedFragmentShader,
  uniforms: materialUniforms,

  patchMap,

  depthPacking: THREE.RGBADepthPacking,
});

// Model
const gltf = await gltfLoader.loadAsync("/gears.glb");
const model = gltf.scene;

model.traverse((child) => {
  if (child instanceof THREE.Mesh) {
    if (child.name === "outerHull") {
      child.material = slicedMaterial;
      child.customDepthMaterial = slicedDepthMaterial;
    } else {
      child.material = material;
    }

    child.castShadow = true;
    child.receiveShadow = true;
  }
});

scene.add(model);

/**
 * Plane
 */
const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10, 10),
  new THREE.MeshStandardMaterial({ color: "#aaaaaa" })
);
plane.receiveShadow = true;
plane.position.x = -4;
plane.position.y = -3;
plane.position.z = -4;
plane.lookAt(new THREE.Vector3(0, 0, 0));
scene.add(plane);

/**
 * Lights
 */
const directionalLight = new THREE.DirectionalLight("#ffffff", 4);
directionalLight.position.set(6.25, 3, 4);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(1024, 1024);
directionalLight.shadow.camera.near = 0.1;
directionalLight.shadow.camera.far = 30;
directionalLight.shadow.normalBias = 0.05;
directionalLight.shadow.camera.top = 8;
directionalLight.shadow.camera.right = 8;
directionalLight.shadow.camera.bottom = -8;
directionalLight.shadow.camera.left = -8;
scene.add(directionalLight);

/**
 * Set up canvas
 */

const canvas = document.getElementById("canvas") as HTMLCanvasElement;

/**
 * Sizes
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
  pixelRatio: Math.min(window.devicePixelRatio, 2),
};

/**
 * Camera
 */

// Base camera
const camera = new THREE.PerspectiveCamera(
  35,
  sizes.width / sizes.height,
  0.1,
  100
);
camera.position.set(4.5, 4, 16);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;

/**
 * Renderer
 */

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(sizes.pixelRatio);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 2;

/**
 * Tweaks
 */

gui
  .add(materialUniforms.uSliceStart, "value", -Math.PI, Math.PI, 0.001)
  .name("Slice Start");
gui
  .add(materialUniforms.uSliceArc, "value", 0, Math.PI * 2, 0.001)
  .name("Slice Arc");

/**
 * Animation loop
 */

const timer = new Timer();

const tick = () => {
  timer.update();
  const elapsedTime = timer.getElapsed();
  // const deltaTime = timer.getDelta();

  // update controls to enable damping
  controls.update();

  // animations
  model.rotation.y = elapsedTime * 0.1;

  // update uniforms

  // render
  renderer.render(scene, camera);

  // request next frame
  window.requestAnimationFrame(tick);
};

tick();

/**
 * Handle window resize
 */

function handleResize() {
  // Update sizes
  const visualViewport = window.visualViewport!;
  const width = visualViewport.width;
  const height = visualViewport.height;

  canvas.width = width;
  canvas.height = height;

  sizes.width = width;
  sizes.height = height;
  sizes.pixelRatio = Math.min(window.devicePixelRatio, 2);

  // Update camera
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

/**
 * Usar el evento 'resize' de visualViewport para móviles
 */

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", handleResize);
} else {
  window.addEventListener("resize", handleResize);
}
