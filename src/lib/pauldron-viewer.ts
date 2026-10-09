import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { forgetStudio, invalidateStudio } from './studio-scheduler';

type Vec3 = [number, number, number];
export const REGION_NAMES = ['Outer plate', 'Raised rim', 'Lower band', 'Rivets', 'Skull', 'Inner cup', 'Rear surfaces'] as const;
const REGION_COLORS = ['#537cca', '#deaa62', '#9b7bc2', '#dc7c77', '#75a997', '#85959f', '#bdc1cc'];
const SOURCE_HASH = 'a49fd57c0b1f9a5359f29f6ea73148c8f45c50799f42a7f91286c27a95085278';

export type PauldronPalette = {
  plate: string; trim: string; skull: string;
  metalness?: number; trimMetalness?: number; plateMetalness?: number; skullMetalness?: number;
};
export type PauldronView = 'front' | 'back' | 'three-quarter' | 'close';
export type PauldronViewerState = {
  palette: PauldronPalette;
  primerColor?: string;
  finish: 'finished' | 'primer';
  regions: boolean;
  selectedRegion: number | null;
  shading: 'smooth' | 'facet';
};
export type PauldronViewerMetrics = { loadMs: number; triangles: number; compressedBytes: number; pixelRatio: number };
export type PauldronViewerCallbacks = {
  onReady?: (metrics: PauldronViewerMetrics) => void;
  onError?: (message: string) => void;
  onInspect?: (region: number | null) => void;
  onViewChange?: (view: PauldronView | 'free') => void;
};
export type PauldronViewer = {
  setState: (state: Partial<PauldronViewerState>) => void;
  setView: (view: PauldronView) => void;
  zoom: (direction: 'in' | 'out') => void;
  reset: () => void;
  dispose: () => void;
};
type AssetManifest = {
  version: number; sourceSha256: string; triangles: number; center: Vec3;
  displayBasis: { right: Vec3; up: Vec3; front: Vec3 };
  boundary: {
    kind: string; sourceSha256: string; centerX: number; yOrigin: number; yScale: number;
    radiusSquaredCoefficients: [number, number, number, number, number];
    bottomCoefficients: Vec3; topY: number; frontDepthMinimum: number;
  };
  payload: { file: string; sha256: string; byteLength: number; compressedBytes: number };
};

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

/** Centre the projected sculpt, rather than its source-space bounding box.
 * Shifting only the orthographic frustum keeps the orbit pivot and geometry fixed.
 */
export function framePauldronCamera(
  camera: THREE.OrthographicCamera,
  positions: ArrayLike<number>,
  modelMatrix: THREE.Matrix4,
  width: number,
  height: number,
) {
  camera.updateMatrixWorld();
  const transform = new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse, modelMatrix).elements;
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
  // An orthographic projection is linear: triangle extrema occur at their
  // vertices. No hull approximation, mutation or per-corner allocations needed.
  for (let index = 0; index < positions.length; index += 3) {
    const x = positions[index], y = positions[index + 1], z = positions[index + 2];
    const projectedX = transform[0] * x + transform[4] * y + transform[8] * z + transform[12];
    const projectedY = transform[1] * x + transform[5] * y + transform[9] * z + transform[13];
    left = Math.min(left, projectedX); right = Math.max(right, projectedX);
    bottom = Math.min(bottom, projectedY); top = Math.max(top, projectedY);
  }
  const centerX = (left + right) / 2, centerY = (bottom + top) / 2;
  const aspect = Math.max(1, width) / Math.max(1, height);
  const halfHeight = Math.max(8.2, 7.7 / aspect);
  camera.left = centerX - halfHeight * aspect;
  camera.right = centerX + halfHeight * aspect;
  camera.top = centerY + halfHeight;
  camera.bottom = centerY - halfHeight;
  camera.updateProjectionMatrix();
  return { centerX, centerY, left, right, bottom, top };
}

const shaderHeader = `
varying vec3 vSourcePosition;
varying float vSurface;
uniform bool finished;
uniform bool showRegions;
uniform float selectedRegion;
uniform vec3 regionColors[7];
uniform vec3 diagnostics[7];
uniform vec3 primerColor;
uniform vec3 sourceCenter;
uniform vec3 displayRight;
uniform vec3 displayUp;
uniform vec3 displayFront;
uniform vec4 bottomProfile;
uniform vec4 boundaryProfile;
uniform vec4 boundaryLimits;
uniform float topY;
uniform float plateMetalness;
uniform float trimMetalness;
uniform float skullMetalness;
float surfaceMetalness;
// The reviewed continuous contour crosses source triangles without changing them.
float plateMask() {
  if (vSurface > 2.5) return 0.;
  vec3 relative = vSourcePosition - sourceCenter;
  if (dot(relative, displayFront) < bottomProfile.w) return 0.;
  float x = dot(relative, displayRight) - boundaryLimits.y;
  float y = dot(relative, displayUp);
  float u = (y - boundaryLimits.z) / boundaryLimits.w;
  float p = boundaryProfile.x + u * (boundaryProfile.y + u * (boundaryProfile.z + u * (boundaryProfile.w + u * boundaryLimits.x)));
  float derivative = (boundaryProfile.y + u * (2. * boundaryProfile.z + u * (3. * boundaryProfile.w + u * 4. * boundaryLimits.x))) / boundaryLimits.w;
  float bottom = bottomProfile.x + x * x * (bottomProfile.y + x * x * bottomProfile.z);
  float distance = min((p - x * x) / max(length(vec2(2. * x, derivative)), .001), min(y - bottom, topY - y));
  float antialias = max(fwidth(distance) * .7, .00015);
  return smoothstep(-antialias, antialias, distance);
}
`;

async function loadAsset(signal?: AbortSignal) {
  const checked = async (name: string) => {
    const response = await fetch(`/models/pauldron/${name}`, { signal });
    if (!response.ok) throw new Error('The armour model could not be loaded. Please try again.');
    return response;
  };
  const manifest = await (await checked('manifest.json')).json() as AssetManifest;
  if (manifest.version !== 1 || manifest.sourceSha256 !== SOURCE_HASH || manifest.boundary.sourceSha256 !== SOURCE_HASH || manifest.boundary.kind !== 'authored-profile-v1') {
    throw new Error('The armour model does not match its surface map.');
  }
  if (!/^inspection-[a-f0-9]{16}\.bin\.gz$/.test(manifest.payload.file)) throw new Error('The armour asset manifest is invalid.');
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open the 3D model. Try a current browser.');
  const response = await checked(manifest.payload.file);
  if (!response.body) throw new Error('The armour model could not be loaded.');
  const bytes = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  signal?.throwIfAborted();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  const expectedBytes = manifest.triangles * (36 + 12 + 36 + 1);
  if (bytes.byteLength !== expectedBytes || bytes.byteLength !== manifest.payload.byteLength || hash !== manifest.payload.sha256) throw new Error('The armour download is incomplete. Please try again.');
  const values = manifest.triangles * 9;
  const positions = new Float32Array(bytes, 0, values);
  const faceNormals = new Float32Array(bytes, values * 4, manifest.triangles * 3);
  const smooth = new Float32Array(bytes, values * 4 + manifest.triangles * 12, values);
  const regions = new Uint8Array(bytes, values * 8 + manifest.triangles * 12, manifest.triangles);
  const facets = new Float32Array(values);
  for (let face = 0; face < manifest.triangles; face++) for (let corner = 0; corner < 3; corner++) facets.set(faceNormals.subarray(face * 3, face * 3 + 3), face * 9 + corner * 3);
  return { manifest, positions, smooth, facets, regions };
}

/** Inspection only: unchanged source corner order, one canvas, render on demand. */
export async function createPauldronViewer(
  container: HTMLElement,
  initial: PauldronViewerState,
  callbacks: PauldronViewerCallbacks = {},
  options: { signal?: AbortSignal } = {},
): Promise<PauldronViewer> {
  const started = performance.now();
  const { manifest, positions, smooth, facets, regions } = await loadAsset(options.signal);
  options.signal?.throwIfAborted();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .95;
  renderer.setClearColor('#eef0f3', 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
  container.append(renderer.domElement);
  let disposed = false, lost = false, inView = true;
  const state = { ...initial };
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-12, 12, 9, -9, .1, 150);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.minZoom = .65;
  controls.maxZoom = 2.5;
  controls.minPolarAngle = .12;
  controls.maxPolarAngle = Math.PI - .12;
  function createEnvironment() {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    try {
      return pmrem.fromScene(room, .05);
    } finally {
      room.dispose();
      pmrem.dispose();
    }
  }
  let environment = createEnvironment();
  scene.environment = environment.texture;
  scene.environmentIntensity = .35;
  scene.add(new THREE.HemisphereLight('#eef3ff', '#a4a3a1', .5));
  const key = new THREE.DirectionalLight('#fff4e3', 2.4);
  key.position.set(-8, 14, 18);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#dce7ff', .7);
  fill.position.set(12, 3, 9);
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#ffffff', 1.2);
  rim.position.set(2, 8, -9);
  scene.add(rim);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(state.shading === 'facet' ? facets : smooth, 3));
  const labels = new Float32Array(manifest.triangles * 3);
  regions.forEach((region, face) => labels.fill(region, face * 3, face * 3 + 3));
  geometry.setAttribute('surfaceId', new THREE.BufferAttribute(labels, 1));
  geometry.computeBoundingSphere();
  const { boundary, displayBasis: basis } = manifest;
  const uniforms = {
    sourceCenter: { value: new THREE.Vector3(...manifest.center) },
    displayRight: { value: new THREE.Vector3(...basis.right) },
    displayUp: { value: new THREE.Vector3(...basis.up) },
    displayFront: { value: new THREE.Vector3(...basis.front) },
    bottomProfile: { value: new THREE.Vector4(...boundary.bottomCoefficients, boundary.frontDepthMinimum) },
    boundaryProfile: { value: new THREE.Vector4(...boundary.radiusSquaredCoefficients.slice(0, 4) as [number, number, number, number]) },
    boundaryLimits: { value: new THREE.Vector4(boundary.radiusSquaredCoefficients[4], boundary.centerX, boundary.yOrigin, boundary.yScale) },
    topY: { value: boundary.topY },
    finished: { value: true },
    showRegions: { value: false },
    selectedRegion: { value: -1 },
    regionColors: { value: Array.from({ length: 7 }, () => new THREE.Color()) },
    diagnostics: { value: REGION_COLORS.map(color => new THREE.Color(color)) },
    primerColor: { value: new THREE.Color(state.primerColor ?? '#a5a7a4') },
    plateMetalness: { value: 0 },
    trimMetalness: { value: 0 },
    skullMetalness: { value: 0 },
  };
  const material = new THREE.MeshStandardMaterial({ color: 'white', roughness: .72, metalness: 0 });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'attribute float surfaceId; varying float vSurface; varying vec3 vSourcePosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSourcePosition = position; vSurface = surfaceId;');
    shader.fragmentShader = shaderHeader + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      int part = int(floor(vSurface + .5));
      float plateWeight = plateMask();
      vec3 pigment = part <= 2 ? mix(regionColors[1], regionColors[0], plateWeight) : regionColors[part];
      surfaceMetalness = part <= 2 ? mix(trimMetalness, plateMetalness, plateWeight) : part == 3 ? trimMetalness : part == 4 ? skullMetalness : plateMetalness;
      if (!finished) { pigment = primerColor; surfaceMetalness = 0.; }
      if (showRegions) { pigment = diagnostics[part]; surfaceMetalness = 0.; }
      if (selectedRegion >= 0. && abs(selectedRegion - vSurface) > .1) pigment = mix(pigment, vec3(.55), .73);
      float tooth = sin(vSourcePosition.y * 183.) * sin(vSourcePosition.z * 169.) * sin(vSourcePosition.x * 177.);
      diffuseColor.rgb = pigment * (1. + tooth * .003);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(.73, .58, surfaceMetalness);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>', 'float metalnessFactor = surfaceMetalness;');
  };
  material.customProgramCacheKey = () => 'layer-guide-pauldron-inspection-v1';
  const assembly = new THREE.Group();
  assembly.matrixAutoUpdate = false;
  const rotation = new THREE.Matrix4().set(...basis.right, 0, ...basis.up, 0, ...basis.front, 0, 0, 0, 0, 1);
  assembly.matrix.copy(rotation.multiply(new THREE.Matrix4().makeTranslation(-manifest.center[0], -manifest.center[1], -manifest.center[2])));
  scene.add(assembly);
  const mesh = new THREE.Mesh(geometry, material);
  assembly.add(mesh);

  function frameCamera() {
    if (disposed || !container.clientWidth || !container.clientHeight) return;
    framePauldronCamera(camera, positions, assembly.matrix, container.clientWidth, container.clientHeight);
  }
  function draw() {
    if (disposed || lost || !inView || document.hidden || !container.clientWidth || !container.clientHeight) return;
    renderer.render(scene, camera);
    container.dataset.draws = String(Number(container.dataset.draws || 0) + 1);
  }
  function update() {
    const { palette } = state;
    [palette.plate, palette.trim, palette.trim, palette.trim, palette.skull, palette.plate, palette.plate].forEach((color, index) => uniforms.regionColors.value[index].set(color));
    uniforms.plateMetalness.value = clamp(palette.plateMetalness ?? 0, 0, 1);
    uniforms.trimMetalness.value = clamp(palette.trimMetalness ?? palette.metalness ?? 0, 0, 1);
    uniforms.skullMetalness.value = clamp(palette.skullMetalness ?? 0, 0, 1);
    uniforms.primerColor.value.set(state.primerColor ?? '#a5a7a4');
    uniforms.finished.value = state.finish === 'finished';
    uniforms.showRegions.value = state.regions;
    uniforms.selectedRegion.value = state.selectedRegion ?? -1;
    invalidateStudio(draw);
  }
  function resize() {
    if (disposed) return;
    const width = container.clientWidth, height = container.clientHeight;
    if (!width || !height) return;
    frameCamera();
    renderer.setSize(width, height, false);
    invalidateStudio(draw);
  }
  function setView(view: PauldronView) {
    if (disposed) return;
    const positions = { front: [0, 1, 30], back: [0, 1, -30], 'three-quarter': [13, 6, 27], close: [9, 4, 28] } as const;
    camera.position.fromArray(positions[view]);
    controls.target.set(0, 0, 0);
    camera.zoom = view === 'close' ? 1.65 : 1;
    camera.updateProjectionMatrix();
    controls.update();
    frameCamera();
    callbacks.onViewChange?.(view);
    invalidateStudio(draw);
  }
  function zoom(direction: 'in' | 'out') {
    if (disposed) return;
    camera.zoom = clamp(camera.zoom * (direction === 'in' ? 1.16 : 1 / 1.16), .65, 2.5);
    camera.updateProjectionMatrix();
    controls.update();
    frameCamera();
    callbacks.onViewChange?.('free');
    invalidateStudio(draw);
  }
  const changed = () => { frameCamera(); invalidateStudio(draw); };
  const manual = () => callbacks.onViewChange?.('free');
  controls.addEventListener('start', manual);
  controls.addEventListener('change', changed);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const intersectionObserver = new IntersectionObserver(entries => {
    inView = entries[0]?.isIntersecting ?? true;
    if (inView) invalidateStudio(draw); else forgetStudio(draw);
  });
  intersectionObserver.observe(container);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerStart: { x: number; y: number; id: number } | null = null;
  const down = (event: PointerEvent) => { pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId }; };
  const up = (event: PointerEvent) => {
    const start = pointerStart;
    pointerStart = null;
    if (!start || start.id !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(mesh)[0];
    state.selectedRegion = hit?.faceIndex != null ? regions[hit.faceIndex] : null;
    callbacks.onInspect?.(state.selectedRegion);
    update();
  };
  const cancelPointer = () => { pointerStart = null; };
  const keyboard = (event: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Escape', 'Home', '1', '2', '3', '4'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Escape') { state.selectedRegion = null; callbacks.onInspect?.(null); update(); return; }
    if (event.key === 'Home' || event.key === '1') { setView('three-quarter'); return; }
    if (event.key === '2') { setView('front'); return; }
    if (event.key === '3') { setView('back'); return; }
    if (event.key === '4') { setView('close'); return; }
    if (event.key === '+' || event.key === '=' || event.key === '-') { zoom(event.key === '-' ? 'out' : 'in'); return; }
    const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    spherical.theta += event.key === 'ArrowLeft' ? .15 : event.key === 'ArrowRight' ? -.15 : 0;
    spherical.phi = clamp(spherical.phi + (event.key === 'ArrowUp' ? -.15 : event.key === 'ArrowDown' ? .15 : 0), .12, Math.PI - .12);
    camera.position.copy(new THREE.Vector3().setFromSpherical(spherical).add(controls.target));
    controls.update();
    callbacks.onViewChange?.('free');
    invalidateStudio(draw);
  };
  const metrics = (): PauldronViewerMetrics => ({ loadMs: Math.round(performance.now() - started), triangles: manifest.triangles, compressedBytes: manifest.payload.compressedBytes, pixelRatio: renderer.getPixelRatio() });
  const visibility = () => { if (document.hidden) forgetStudio(draw); else invalidateStudio(draw); };
  const contextLost = (event: Event) => { event.preventDefault(); lost = true; forgetStudio(draw); callbacks.onError?.('The 3D view was interrupted. Waiting for it to return.'); };
  const contextRestored = () => {
    if (disposed) return;
    try {
      // PMREM is GPU-generated, so its render-target contents cannot be restored
      // from a CPU image after context loss. Rebuild before showing metal paint.
      const restoredEnvironment = createEnvironment();
      environment.dispose();
      environment = restoredEnvironment;
      scene.environment = environment.texture;
      lost = false;
      material.needsUpdate = true;
      resize();
      update();
      callbacks.onReady?.(metrics());
    } catch {
      lost = true;
      callbacks.onError?.('The 3D view could not be restored. Please try again.');
    }
  };
  renderer.domElement.addEventListener('pointerdown', down);
  renderer.domElement.addEventListener('pointerup', up);
  renderer.domElement.addEventListener('pointercancel', cancelPointer);
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  renderer.domElement.addEventListener('webglcontextrestored', contextRestored);
  container.addEventListener('keydown', keyboard);
  document.addEventListener('visibilitychange', visibility);
  function dispose() {
    if (disposed) return;
    disposed = true;
    forgetStudio(draw);
    options.signal?.removeEventListener('abort', dispose);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    controls.removeEventListener('start', manual);
    controls.removeEventListener('change', changed);
    controls.dispose();
    renderer.domElement.removeEventListener('pointerdown', down);
    renderer.domElement.removeEventListener('pointerup', up);
    renderer.domElement.removeEventListener('pointercancel', cancelPointer);
    renderer.domElement.removeEventListener('webglcontextlost', contextLost);
    renderer.domElement.removeEventListener('webglcontextrestored', contextRestored);
    container.removeEventListener('keydown', keyboard);
    document.removeEventListener('visibilitychange', visibility);
    geometry.dispose();
    material.dispose();
    environment.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }
  options.signal?.addEventListener('abort', dispose, { once: true });
  try {
    resize();
    setView('three-quarter');
    update();
    await renderer.compileAsync(scene, camera);
    options.signal?.throwIfAborted();
    draw();
    container.dataset.triangles = String(manifest.triangles);
    container.dataset.sourceHash = manifest.sourceSha256;
    callbacks.onReady?.(metrics());
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    setState(next) {
      if (disposed) return;
      const changeShading = next.shading && next.shading !== state.shading;
      Object.assign(state, next);
      if (changeShading) geometry.setAttribute('normal', new THREE.BufferAttribute(state.shading === 'smooth' ? smooth : facets, 3));
      update();
    },
    setView,
    zoom,
    reset: () => setView('three-quarter'),
    dispose,
  };
}
