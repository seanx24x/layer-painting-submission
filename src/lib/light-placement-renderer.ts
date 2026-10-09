import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { forgetStudio, invalidateStudio } from "./studio-scheduler";
import { lightDirection, PAINT_BANDS, PAINT_THRESHOLDS, type LightStudyState } from "./light-placement";

export type LightPlacementRenderer = { update: (state: LightStudyState) => void; dispose: () => void };

/** A single directional diffuse light plus constant ambient fill. No render loop. */
export function createLightPlacementRenderer(container: HTMLElement, initial: LightStudyState, onContext: (available: boolean) => void): LightPlacementRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-2, 2, 1.65, -1.65, .1, 20);
  camera.position.set(0, 0, 6);
  const uniforms = {
    uLight: { value: new THREE.Vector3(...lightDirection(initial)) },
    uPaint: { value: initial.view === "paint" ? 1 : 0 },
    uBase: { value: new THREE.Color("#aeb8be") },
    uShadow: { value: new THREE.Color(PAINT_BANDS.shadow) },
    uMidtone: { value: new THREE.Color(PAINT_BANDS.midtone) },
    uHighlight: { value: new THREE.Color(PAINT_BANDS.highlight) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec3 vWorldNormal;
      void main() {
        vWorldNormal = mat3(modelMatrix) * normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `uniform vec3 uLight, uBase, uShadow, uMidtone, uHighlight;
      uniform float uPaint;
      varying vec3 vWorldNormal;
      void main() {
        float exposure = max(dot(normalize(vWorldNormal), uLight), 0.0);
        // The lighting and painted-value map use the exact same surface normal.
        vec3 lit = uBase * (0.27 + exposure * 0.88);
        float aa = max(fwidth(exposure), 0.001);
        vec3 mapped = mix(uShadow, uMidtone, smoothstep(${PAINT_THRESHOLDS.midtone} - aa, ${PAINT_THRESHOLDS.midtone} + aa, exposure));
        mapped = mix(mapped, uHighlight, smoothstep(${PAINT_THRESHOLDS.highlight} - aa, ${PAINT_THRESHOLDS.highlight} + aa, exposure));
        gl_FragColor = vec4(mix(lit, mapped, uPaint), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(.91, 72, 48), material);
  const block = new THREE.Mesh(new RoundedBoxGeometry(1.42, 1.42, 1.42, 6, .1), material);
  block.rotation.set(.25, -.52, 0);
  sphere.position.y = block.position.y = -.1;
  scene.add(sphere, block);
  const shadowMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vUv; void main() { float r = length((vUv - 0.5) * 2.0); gl_FragColor = vec4(0.27, 0.31, 0.37, (1.0 - smoothstep(0.0, 1.0, r)) * 0.11); }`,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.1, .22), shadowMaterial);
  shadow.position.set(0, -1.17, -.8);
  scene.add(shadow);
  let disposed = false, inView = true, contextAvailable = true;
  const draw = () => {
    if (disposed || !inView || document.hidden || !contextAvailable || !container.clientWidth || !container.clientHeight) return;
    renderer.render(scene, camera);
    container.dataset.draws = String(Number(container.dataset.draws || 0) + 1);
  };
  const update = (state: LightStudyState) => {
    uniforms.uLight.value.set(...lightDirection(state));
    uniforms.uPaint.value = state.view === "paint" ? 1 : 0;
    sphere.visible = state.surface === "sphere";
    block.visible = state.surface === "block";
    invalidateStudio(draw);
  };
  const resize = () => {
    if (disposed) return;
    const width = container.clientWidth, height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    const aspect = width / height, halfHeight = aspect < 1 ? 1.7 : 1.6;
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
    camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    invalidateStudio(draw);
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const intersectionObserver = new IntersectionObserver(entries => { inView = entries[0]?.isIntersecting ?? true; if (inView) invalidateStudio(draw); else forgetStudio(draw); });
  intersectionObserver.observe(container);
  const visibility = () => { if (document.hidden) forgetStudio(draw); else invalidateStudio(draw); };
  const lost = (event: Event) => { event.preventDefault(); contextAvailable = false; forgetStudio(draw); onContext(false); };
  const restored = () => { contextAvailable = true; onContext(true); resize(); };
  renderer.domElement.addEventListener("webglcontextlost", lost);
  renderer.domElement.addEventListener("webglcontextrestored", restored);
  document.addEventListener("visibilitychange", visibility);
  update(initial); resize();
  return { update, dispose() {
    disposed = true; forgetStudio(draw);
    resizeObserver.disconnect(); intersectionObserver.disconnect();
    document.removeEventListener("visibilitychange", visibility);
    renderer.domElement.removeEventListener("webglcontextlost", lost);
    renderer.domElement.removeEventListener("webglcontextrestored", restored);
    sphere.geometry.dispose(); block.geometry.dispose(); shadow.geometry.dispose();
    material.dispose(); shadowMaterial.dispose(); renderer.dispose(); renderer.domElement.remove();
  } };
}
