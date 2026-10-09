import { WORKSHOPS } from "./workshop";
import { studioQuality } from "./studio-quality";
import { requestStudioFrame, cancelStudioFrame, invalidateStudio, forgetStudio } from "./studio-scheduler";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { ShapePaintSceneProps } from "@/components/ShapePaintScene";
import { createCubeStudy } from "./cube-paint-study";
import { createTileStudy } from "./tile-paint-study";
import { smooth } from "./shape-paint-motion";
import type { StudyPalette } from "./study-palette";

const cubeArtworkPalette: StudyPalette = {
  base: { id: "artwork-ivory", name: "Ivory", hex: "#fafaf7" },
  coats: [
    { id: "artwork-lilac", name: "Lilac", hex: "#b3a9d4" },
    { id: "artwork-blue", name: "Powder blue", hex: "#94b4db" },
    { id: "artwork-mint", name: "Pale mint", hex: "#a5cfc1" },
  ],
};

/** Shared lighting, framing and inspection for the two additional teaching surfaces. */
export function createTechniqueStudio(container: HTMLDivElement, initial: ShapePaintSceneProps) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = initial.artwork ? 1.12 : .95;
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.style.cssText = "display:block;width:100%;height:100%;outline:none;";
  container.appendChild(renderer.domElement);

  const quality = studioQuality(renderer,container);
  const scene = new THREE.Scene();
  // Match the sphere player and let the shared CSS backdrop show through.
  scene.background = null;
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 40);
  const overview = new THREE.PerspectiveCamera(36,1,.1,40);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture;
  scene.environmentIntensity = .3;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight("#e9f1ff", initial.artwork ? "#dce2eb" : "#aa9a7f", initial.artwork ? 1.1 : .85));
  const key = new THREE.DirectionalLight(initial.artwork ? "#ffffff" : "#fff8eb", 2.2);
  key.position.set(-3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -3 });
  key.shadow.normalBias = .018;
  key.shadow.bias = -.0002;
  key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight("#d9e9ff", 1.1);
  rim.position.set(3, 1.5, -2);
  scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: .10 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.031;
  floor.receiveShadow = true;
  scene.add(floor);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(.75, .79, .11, 96), new THREE.MeshStandardMaterial({ color: "#dad6cd", roughness: .84 }));
  plinth.position.set(-.12, -.976, 0);
  plinth.visible = false;
  scene.add(plinth);

  const cube = initial.technique === "edges";
  const surface = cube ? createCubeStudy(initial.artwork ? cubeArtworkPalette : initial.palette, initial.artwork) : createTileStudy(initial.technique === "drybrush" ? "drybrush" : "recess", initial.palette, initial.artwork);
  const assembly = new THREE.Group();
  assembly.position.set(-.12, cube ? -.12 : -.09, 0);
  assembly.add(surface.group);
  scene.add(assembly);
  const artworkBrush = surface.group.getObjectByName(cube ? "Miniature painting brush" : initial.technique === "drybrush" ? "Soft domed drybrush" : "Miniature painting brush");
  let current = initial;
  let disposed = false;
  let viewFrame = 0;
  let viewOffset = initial.view === "turn" ? .78 : 0;

  let closeOffset = initial.view === "close" ? 1 : 0;

  function render() { invalidateStudio(draw); }
  function draw() {
    if (disposed) return;
    const drawStart = quality.begin(current.playing);
    surface.group.userData.compareEdges = current.artwork && cube ? 1 : current.comparison === "light" ? (current.before ? 2 : 1) : 0;
    surface.group.userData.comparison = current.comparison;
    surface.group.userData.before = current.before;
    surface.update(current.time, current.experiment);
    // A thumbnail studies the painted surface. The live lesson retains the
    // brush, its contact animation and its original inspection camera.
    if ((current.artwork || (current.experiment && !current.playing && current.time >= WORKSHOPS[current.technique].result)) && artworkBrush) artworkBrush.visible = false;
    const lightAngle = current.experiment?.lighting ? current.experiment.light * Math.PI / 180 : -.54;
    key.position.set(Math.sin(lightAngle)*5.8,5,Math.cos(lightAngle)*5.8);
    key.intensity = current.neutral ? 1 : 2.2;
    rim.intensity = current.neutral ? .25 : 1.1;
    scene.environmentIntensity = current.neutral ? .55 : .3;
    const frameTime = current.comparison ? 24 : current.time;
    // Move closer between coats, then hold the camera still while paint lands.
    // A fixed finished frame keeps before/after comparisons spatially identical.
    const settle = smooth(frameTime / 1.6);
    const detail = .16 * smooth((frameTime - 10) / 1.2) + .12 * smooth((frameTime - 17) / .8);
    const reveal = smooth((frameTime - 22) / 2);
    const zoom = (settle * .46 + detail) * (1 - reveal);
    const wide = container.clientWidth / Math.max(1, container.clientHeight);
    if (current.artwork) {
      // Fixed editorial crops make the top corner and the relief readable at
      // card size. The subject extends below the frame rather than floating
      // as a small, complete object in the centre.
      assembly.position.set(0, cube ? -.12 : -.03, 0);
      assembly.rotation.set(cube ? 0 : -.24, cube ? -Math.PI / 4 : 0, 0);
      camera.position.set(0, cube ? 1.80 : .50, cube ? 3.05 : 2.65);
      camera.lookAt(0, cube ? .30 : .22, 0);
    } else {
      const distance = wide < 1 ? 5.2 : cube ? 4.2 : 3.8;
      camera.position.set(.08, cube ? 1.62 : .78, distance - zoom - .7 * closeOffset);
      camera.lookAt(.08, cube ? -.18 : .10, 0);
      assembly.rotation.y = (cube ? -.42 : -.16) + viewOffset + .12 * smooth((frameTime - 21.8) / 2.2);
    }
    if (current.macro && !current.artwork) {
      assembly.updateWorldMatrix(true,true);
      const target = new THREE.Vector3(cube ? .55 : 0,cube ? .65 : .15,cube ? .65 : .25).applyMatrix4(assembly.matrixWorld);
      camera.position.copy(target).add(new THREE.Vector3(.2,cube ? .65 : .28,2.15)); camera.lookAt(target);
    }
    renderer.render(scene, camera);
    if (current.macro && !current.artwork) {
      overview.position.set(.08,cube ? 1.62 : .78,5); overview.lookAt(.08,0,0);
      const side = Math.min(112,container.clientWidth*.22);
      renderer.setScissorTest(true);renderer.setScissor(12,12,side,side);renderer.setViewport(12,12,side,side);
      renderer.setClearColor(0xedeff2,1);renderer.clear();renderer.render(scene,overview);renderer.setClearColor(0x000000,0);
      renderer.setScissorTest(false);renderer.setViewport(0,0,container.clientWidth,container.clientHeight);
    }
    container.dataset.experiment = String(current.experiment?.reference ? .4 : current.experiment?.amount ?? .4);
    container.dataset.time = current.time.toFixed(3);
    container.dataset.angle = assembly.rotation.y.toFixed(4);
    quality.end(drawStart);
    container.dataset.renderer = "ready";
    container.dataset.technique = initial.technique;
    container.dataset.contact = String(surface.group.userData.contact ?? false);
    container.dataset.brushPoint = JSON.stringify(surface.group.userData.brushPoint ?? null);
    container.dataset.paintState = JSON.stringify(surface.group.userData.paintState ?? null);
  }
  function resize() {
    if (disposed) return;
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    render();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  function contextLost(event: Event) { event.preventDefault(); current.onError(); }
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  resize();

  return {
    update(props: ShapePaintSceneProps) {
      const changedView = props.view !== current.view;
      const startingPlayback = props.playing && !current.playing;
      if (!props.playing && current.playing && !changedView) cancelStudioFrame(viewFrame);
      current = props;
      const targetOffset = props.view === "turn" ? .78 : 0;
      const targetClose = props.view === "close" ? 1 : 0;
      if (changedView || (startingPlayback && (Math.abs(viewOffset - targetOffset) > .0001 || Math.abs(closeOffset-targetClose) > .0001))) {
        cancelStudioFrame(viewFrame);
        const from = viewOffset, to = targetOffset, fromClose = closeOffset;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {viewOffset = to;closeOffset = targetClose;}
        else {
          const start = performance.now();
          const turn = (now: number) => {
            if (disposed) return;
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
              viewOffset = to; closeOffset = targetClose; render(); return;
            }
            const t = Math.min(1, (now - start) / 560);
            viewOffset = THREE.MathUtils.lerp(from, to, smooth(t));
            closeOffset = THREE.MathUtils.lerp(fromClose,targetClose,smooth(t));
            render();
            if (t < 1) viewFrame = requestStudioFrame(turn);
          };
          viewFrame = requestStudioFrame(turn);
        }
      }
      render();
    },
    dispose() {
      disposed = true; forgetStudio(draw);
      cancelStudioFrame(viewFrame); observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      surface.dispose();
      for (const mesh of [floor, plinth]) { mesh.geometry.dispose(); mesh.material.dispose(); }
      environment.dispose(); key.shadow.map?.dispose();
      renderer.dispose(); renderer.domElement.remove();
    },
  };
}
