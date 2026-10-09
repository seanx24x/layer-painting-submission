"use client";

import { studioQuality } from "@/lib/studio-quality";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { roundContactRadius } from "@/lib/brush-contact";
import { createPaintingPalette } from "@/lib/painting-palette";
import { createPaintingBrush } from "@/lib/painting-brush";
import { smooth, paintStrokes, strokePoint, strokeProgress, sphereBrushPose, sphereWetStroke, SPHERE_RADIUS } from "@/lib/shape-paint-motion";
import type { TechniqueId } from "@/lib/technique-study-types";
import { createTechniqueStudio } from "@/lib/technique-paint-studio";
import { WORKSHOPS, experimentFactors, type WorkshopExperiment, type LessonClock } from "@/lib/workshop";
import { requestStudioFrame, cancelStudioFrame, invalidateStudio, forgetStudio } from "@/lib/studio-scheduler";
import type { StudyPalette } from "@/lib/study-palette";

export type ShapePaintSceneProps = {
  clock?: LessonClock;
  experiment?: WorkshopExperiment;
  macro?: boolean;
  technique: TechniqueId;
  time: number;
  duration: number;
  playing: boolean;
  view: "front" | "turn" | "close";
  neutral?: boolean;
  comparison?: import("@/lib/technique-study-types").StudyComparison;
  before?: boolean;
  /** The guide step's surface and applied paints. Omit for the generic lesson. */
  palette?: StudyPalette;
  /** Local thumbnail composition and finish on a transparent stage; lessons keep their original presentation. */
  artwork?: boolean;
  onReady: () => void;
  onError: () => void;
};
type Studio = { update: (props: ShapePaintSceneProps) => void; dispose: () => void };

export default function ShapePaintScene(props: ShapePaintSceneProps) {
  const container = useRef<HTMLDivElement>(null);
  const studio = useRef<Studio | null>(null);
  const latest = useRef(props);
  useEffect(() => {
    // A low-frequency React snapshot must never rewind the live scene clock.
    const next = props.playing && latest.current.playing && props.time < latest.current.time
      ? { ...props, time: latest.current.time } : props;
    latest.current = next; studio.current?.update(next);
  }, [props]);
  useEffect(() => props.clock?.subscribe(time => {
    latest.current = { ...latest.current, time };
    studio.current?.update(latest.current);
  }), [props.clock]);
  useEffect(() => {
    if (!container.current) return;
    try {
      studio.current = latest.current.technique === "layers"
        ? createStudio(container.current, latest.current)
        : createTechniqueStudio(container.current, latest.current);
      latest.current.onReady();
    } catch (error) {
      console.error("Painting studio could not initialize", error);
      latest.current.onError();
    }
    return () => { studio.current?.dispose(); studio.current = null; };
  }, []);
  const description = props.technique === "layers" && props.time >= 10 && props.time < 35 ? "Three-dimensional palette demonstrating paint consistency, brush loading and a test stroke" : props.technique === "layers" ? "Three-dimensional sphere with brush-applied layers of paint"
    : props.technique === "edges" ? "Beveled cube with brush-applied edge highlights"
    : props.technique === "recess" ? "Ridged tile with controlled shading in its grooves"
    : "Ridged tile with drybrushed highlights on its raised details";
  const paintDescription = props.palette ? ` Surface: ${props.palette.base.name}. Applied paints: ${[...new Set(props.palette.coats.map(paint => paint.name))].join(", ")}.` : "";
  return <div ref={container} className="shape-paint-canvas" role="img" aria-label={description + paintDescription} data-paint-base={props.palette?.base.hex} data-paint-coats={props.palette?.coats.map(paint => paint.hex).join(",")} style={{ position: "absolute", inset: 0 }} />;
}

function createStudio(container: HTMLDivElement, initial: ShapePaintSceneProps): Studio {
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
  // CSS owns the shared backdrop so tone mapping only affects the objects.
  scene.background = null;
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 40);
  const overview = new THREE.PerspectiveCamera(36,1,.1,40);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture;
  scene.environmentIntensity = .3;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight("#f4f5f5", initial.artwork ? "#dce2eb" : "#aa9a7f", initial.artwork ? 1.1 : .85));
  const key = new THREE.DirectionalLight(initial.artwork ? "#ffffff" : "#fff8eb", 2.2);
  key.position.set(-3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -3; key.shadow.camera.right = 3;
  key.shadow.camera.top = 4; key.shadow.camera.bottom = -3;
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
  plinth.position.y = -.976;
  plinth.position.x = -.12;
  plinth.visible = false;
  scene.add(plinth);
  const assembly = new THREE.Group();
  assembly.position.set(-.12, .13, 0);
  scene.add(assembly);

  const width = 1024, height = 512;
  const layers = [0, 1, 2].map(() => {
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Paint surface unavailable");
    context.fillStyle = "black"; context.fillRect(0, 0, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.NoColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    texture.wrapS = THREE.RepeatWrapping;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    return { canvas, context, texture };
  });
  // One reusable, feathered bristle footprint. Surface deposition is sampled at
  // a fixed path spacing, so seeking and varying frame rates produce identical paint.
  const stamp = document.createElement("canvas");
  stamp.width = 96; stamp.height = 48;
  const stampContext = stamp.getContext("2d")!;
  stampContext.save(); stampContext.scale(2, 1);
  const gradient = stampContext.createRadialGradient(24, 24, 0, 24, 24, 24);
  gradient.addColorStop(0, "rgba(255,255,255,.98)");
  gradient.addColorStop(.82, "rgba(255,255,255,.97)");
  gradient.addColorStop(.94, "rgba(255,255,255,.72)");
  gradient.addColorStop(.99, "rgba(255,255,255,.20)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  stampContext.fillStyle = gradient; stampContext.fillRect(0, 0, 48, 48);
  stampContext.restore();
  stampContext.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 24; i++) {
    stampContext.fillStyle = `rgba(0,0,0,${.08 + (Math.sin(i * 4.3) + 1) * .04})`;
    stampContext.fillRect(i * 4 + 1, 0, .65, 48);
  }

  const uniforms = {
    paintFirst: { value: layers[0].texture }, paintSecond: { value: layers[1].texture },
    paintGlaze: { value: layers[2].texture },
    primerColor: { value: new THREE.Color(initial.palette?.base.hex ?? "#eeeee8") },
    firstColor: { value: new THREE.Color(initial.palette?.coats[0].hex ?? "#285cdf") },
    secondColor: { value: new THREE.Color(initial.palette?.coats[1].hex ?? "#285cdf") },
    glazeColor: { value: new THREE.Color(initial.palette?.coats[2].hex ?? "#599ddd") },
    wetPoint: { value: new THREE.Vector2(-1, -1) },
    wetTail: { value: new THREE.Vector2(-1, -1) },
    wetAmount: { value: 0 },
  };
  const material = new THREE.MeshPhysicalMaterial({ color: "white", map: layers[0].texture, roughness: .72, metalness: 0, clearcoat: .025, clearcoatRoughness: .6 });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = `
      uniform sampler2D paintFirst;
      uniform sampler2D paintSecond;
      uniform sampler2D paintGlaze;
      uniform vec3 primerColor;
      uniform vec3 firstColor;
      uniform vec3 secondColor;
      uniform vec3 glazeColor;
      uniform vec2 wetPoint;
      uniform vec2 wetTail;
      uniform float wetAmount;
      float paintCoverage;
      float glazeCoverage;
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `
      float first = texture2D(paintFirst, vMapUv).r;
      float second = texture2D(paintSecond, vMapUv).r;
      float glaze = texture2D(paintGlaze, vMapUv).r;
      paintCoverage = max(first, second);
      glazeCoverage = glaze;
      ${initial.artwork ? `
      // Three adjacent painted bands share their boundaries. The material and
      // lighting follow the sphere; no primer gaps interrupt the colour stack.
      float latitude = (vMapUv.y - .5) * 3.14159265;
      float band = (.63 - latitude) / .13;
      vec3 bandColor = mix(firstColor, secondColor, smoothstep(.985, 1.015, band));
      bandColor = mix(bandColor, glazeColor, smoothstep(1.985, 2.015, band));
      paintCoverage = smoothstep(-.02, .02, band) * (1. - smoothstep(2.98, 3.02, band));
      glazeCoverage = 0.;
      vec3 pigment = mix(primerColor, bandColor, paintCoverage);
      ` : `
      vec3 pigment = mix(primerColor, firstColor, first * .78);
      pigment = mix(pigment, secondColor, second * .88);
      pigment = mix(pigment, glazeColor, glaze * .45);
      `}
      float grain = fract(sin(dot(floor(vMapUv * vec2(3100.,1550.)), vec2(12.9898,78.233))) * 43758.5453);
      diffuseColor.rgb = pigment * (1.0 + (grain-.5)*.006);
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", `
      float roughnessFactor = mix(.79, .64, paintCoverage);
      roughnessFactor = mix(roughnessFactor, .67, glazeCoverage);
      vec2 wetPath = (wetPoint - wetTail) * vec2(1., .5);
      vec2 wetDelta = (vMapUv - wetTail) * vec2(1., .5);
      float wetProgress = clamp(dot(wetDelta, wetPath) / max(dot(wetPath, wetPath), .000001), 0., 1.);
      float wet = (1. - smoothstep(.005, .017, length(wetDelta-wetPath*wetProgress))) * wetAmount;
      roughnessFactor = mix(roughnessFactor, .43, wet);
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_maps>", `
      #include <normal_fragment_maps>
      float primerGrain = fract(sin(dot(floor(vMapUv * vec2(1600.,800.)), vec2(12.9898,78.233))) * 43758.5453);
      float skin = paintCoverage * .000025 + primerGrain * .000013;
      vec3 eye = -vViewPosition;
      vec3 q0 = dFdx(eye);
      vec3 q1 = dFdy(eye);
      vec3 r0 = cross(q1, normal);
      vec3 r1 = cross(normal, q0);
      float determinant = dot(q0, r0);
      normal = normalize(abs(determinant)*normal - sign(determinant)*(dFdx(skin)*r0 + dFdy(skin)*r1));
    `);
  };
  material.customProgramCacheKey = () => initial.artwork ? "layer-surface-artwork-v2" : "layer-surface-lesson-v3";
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(SPHERE_RADIUS, 128, 96), material);
  sphere.castShadow = true; sphere.receiveShadow = true;
  assembly.add(sphere);
  const brush = createPaintingBrush();
  brush.group.scale.set(1, .92, 1);
  assembly.add(brush.group);
  brush.group.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });

  const palette = createPaintingPalette(initial.palette?.coats[0].hex);
  assembly.add(palette.group);

  const steps = 260;
  const deposited = paintStrokes.map(() => -1);
  let previousTime = -1;
  let current = initial;
  let disposed = false;
  let viewFrame = 0;
  let viewOffset = initial.view === "turn" ? .86 : 0;
  let closeOffset = initial.view === "close" ? 1 : 0;
  const normal = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const axisY = new THREE.Vector3();
  const axisX = new THREE.Vector3();
  const axisZ = new THREE.Vector3();
  const rotation = new THREE.Matrix4();
  const brushColors = [uniforms.firstColor.value, uniforms.secondColor.value, uniforms.glazeColor.value];

  let paintLoad = -1;
  const checkpoints = new Map<number, { images: ImageData[]; samples: number[] }>();
  function paint(time: number) {
    const load = experimentFactors("layers", current.experiment).load;
    if (load !== paintLoad) { previousTime = Infinity; checkpoints.clear(); paintLoad = load; }
    if (time < previousTime) {
      layers.forEach(({ context }) => { context.globalAlpha = 1; context.fillStyle = "black"; context.fillRect(0, 0, width, height); });
      deposited.fill(-1);
      const checkpoint = [...checkpoints.keys()].filter(t => t <= time).sort((a,b) => b-a)[0];
      if (checkpoint !== undefined) {
        const saved = checkpoints.get(checkpoint)!;
        saved.images.forEach((image,i) => layers[i].context.putImageData(image,0,0));
        saved.samples.forEach((sample,i) => deposited[i] = sample);
      }
    }
    const dirty = [time < previousTime, time < previousTime, time < previousTime];
    paintStrokes.forEach((stroke, index) => {
      const target = time <= stroke.start ? -1 : Math.floor(strokeProgress(stroke, time) * steps);
      const context = layers[stroke.layer].context;
      for (let n = deposited[index] + 1; n <= target; n++) {
        const point = strokePoint(stroke, n / steps);
        const radius = roundContactRadius(point.pressure);
        if (radius < .00001) continue;
        const rx = radius / Math.max(.25, Math.cos(point.latitude)) * width / (Math.PI * 2);
        const ry = radius * height / Math.PI * .42;
        context.save();
        context.translate(point.u * width, (1 - point.v) * height);
        if (stroke.horizontal) context.rotate(-Math.PI / 2);
        const fibres = .78 + .22 * Math.sin(n * .19 + index * 2.7) ** 2;
        context.globalAlpha = (stroke.layer === 2 ? .016 : stroke.layer === 1 ? .22 : .17) * (load / .5) * fibres;
        // A loaded brush leaves a slightly heavier, irregular film along its path.
        if (load > .5) context.globalAlpha *= 1 + (load - .5) * (1 + Math.sin(n * .065));
        context.drawImage(stamp, -rx, -ry, rx * 2, ry * 2);
        context.restore();
        dirty[stroke.layer] = true;
      }
      deposited[index] = target;
    });
    dirty.forEach((changed, i) => { if (changed) layers[i].texture.needsUpdate = true; });
    for (const boundary of [54, 69, 78]) {
      if (time >= boundary && (previousTime < boundary || previousTime === Infinity) && !checkpoints.has(time))
        checkpoints.set(time, { images: layers.map(layer => layer.context.getImageData(0,0,width,height)), samples: [...deposited] });
    }
    // Three completed-coat checkpoints bound memory even under repeated seeking.
    while (checkpoints.size > 3) checkpoints.delete(checkpoints.keys().next().value!);
    previousTime = time;
    container.dataset.paintSamples = deposited.join(",");
  }

  function poseBrush(time: number) {
    const pose = sphereBrushPose(time);
    brush.group.visible = pose.visible;
    container.dataset.contact = String(pose.contact && pose.visible);
    if (!pose.visible) return;
    normal.set(pose.normal.x,pose.normal.y,pose.normal.z);
    tangent.set(pose.tangent.x,pose.tangent.y,pose.tangent.z);
    axisX.crossVectors(normal, tangent).normalize();
    axisY.copy(normal).multiplyScalar(.78).addScaledVector(tangent, -.62).normalize();
    axisZ.crossVectors(axisX, axisY).normalize();
    axisX.crossVectors(axisY, axisZ).normalize();
    rotation.makeBasis(axisX, axisY, axisZ);
    brush.group.quaternion.setFromRotationMatrix(rotation);
    brush.group.position.set(pose.point.x,pose.point.y,pose.point.z);
    brush.setContact(pose.pressure, brushColors[pose.layer], experimentFactors("layers", current.experiment).load);
    container.dataset.brushPoint = brush.group.position.toArray().map(n => n.toFixed(5)).join(",");
  }

  function render() { invalidateStudio(draw); }
  function draw() {
    if (disposed) return;
    const drawStart = quality.begin(current.playing);
    const time = current.comparison === "load" ? 34.8 : current.time;
    const active = !current.comparison && !current.artwork ? sphereWetStroke(time) : undefined;
    if (active) {
      const point = strokePoint(active, strokeProgress(active, time));
      const tail = strokePoint(active, Math.max(0,strokeProgress(active,time)-.18));
      uniforms.wetPoint.value.set(point.u, point.v);
      uniforms.wetTail.value.set(tail.u,tail.v);
      uniforms.wetAmount.value = 1 - smooth((time-active.end)/.7);
    } else uniforms.wetAmount.value = 0;
    const lightAngle = current.experiment?.lighting ? current.experiment.light * Math.PI / 180 : -.54;
    key.position.set(Math.sin(lightAngle) * 5.8, 5, Math.cos(lightAngle) * 5.8);
    key.intensity = current.neutral ? 1.0 : 2.2;
    rim.intensity = current.neutral ? .25 : 1.1;
    scene.environmentIntensity = current.neutral ? .55 : .3;
    paint(time);
    poseBrush(time);
    const preparing = time >= 10 && time < 35;
    sphere.visible = !preparing;
    plinth.visible = false;
    palette.group.visible = preparing;
    if (preparing) palette.update(time, brush, current.comparison === "load" && current.before);
    if (current.comparison || current.artwork || (current.experiment && !current.playing && time >= WORKSHOPS.layers.result)) brush.group.visible = false;
    // Camera settles before the first contact and stays still through each pass.
    const framingTime = current.comparison === "coverage" ? 69 : time;
    const zoom = smooth((framingTime - 35) / .9) * (1 - smooth((framingTime - 77.6) / 1.2));
    const wide = container.clientWidth / Math.max(1, container.clientHeight);
    const distance = preparing ? (wide < 1.3 ? 5.1 : 3.3) : (wide < 1 ? 5.9 : 4.8);
    camera.position.set(.10, .60, distance - THREE.MathUtils.lerp(.52 * zoom, 1.2, closeOffset));
    camera.lookAt(.10, THREE.MathUtils.lerp(.18, .35, closeOffset), 0);
    assembly.rotation.y = viewOffset - .08;
    if (current.artwork) {
      camera.position.set(.04, 1.25, 2.4);
      camera.lookAt(.02, .75, .18);
      camera.rotateZ(-.16);
      assembly.rotation.y = -.12;
    }
    if (current.macro && !preparing && !current.artwork) {
      assembly.updateWorldMatrix(true,true);
      const target = new THREE.Vector3(-.22,.14,.98).applyMatrix4(assembly.matrixWorld);
      camera.position.copy(target).add(new THREE.Vector3(.12,.22,2.05)); camera.lookAt(target);
    }
    renderer.render(scene, camera);
    if (current.macro && !preparing && !current.artwork) {
      overview.position.set(.1,.6,5.3); overview.lookAt(.1,.18,0);
      const side = Math.min(112, container.clientWidth * .22);
      renderer.setScissorTest(true); renderer.setScissor(12,12,side,side); renderer.setViewport(12,12,side,side);
      renderer.setClearColor(0xedeff2,1); renderer.clear(); renderer.render(scene,overview); renderer.setClearColor(0x000000,0);
      renderer.setScissorTest(false); renderer.setViewport(0,0,container.clientWidth,container.clientHeight);
    }
    container.dataset.experiment = String(experimentFactors("layers",current.experiment).amount);
    container.dataset.time = time.toFixed(3);
    container.dataset.angle = assembly.rotation.y.toFixed(4);
    quality.end(drawStart);
    container.dataset.renderer = "ready";
    container.dataset.technique = "layers";
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
    update(props) {
      const changedView = props.view !== current.view;
      const startingPlayback = props.playing && !current.playing;
      if (!props.playing && current.playing && !changedView) cancelStudioFrame(viewFrame);
      current = props;
      const targetOffset = props.view === "turn" ? .86 : 0;
      const targetClose = props.view === "close" ? 1 : 0;
      if (changedView || (startingPlayback && (Math.abs(viewOffset - targetOffset) > .0001 || Math.abs(closeOffset - targetClose) > .0001))) {
        cancelStudioFrame(viewFrame);
        const from = viewOffset;
        const fromClose = closeOffset;
        const to = targetOffset;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { viewOffset = to; closeOffset = targetClose; }
        else {
          const start = performance.now();
          const turn = (now: number) => {
            if (disposed) return;
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
              viewOffset = to; closeOffset = targetClose; render(); return;
            }
            const progress = Math.min(1, (now - start) / 700);
            viewOffset = THREE.MathUtils.lerp(from, to, smooth(progress));
            closeOffset = THREE.MathUtils.lerp(fromClose, targetClose, smooth(progress));
            render();
            if (progress < 1) viewFrame = requestStudioFrame(turn);
          };
          viewFrame = requestStudioFrame(turn);
        }
      }
      render();
    },
    dispose() {
      disposed = true; forgetStudio(draw); observer.disconnect(); cancelStudioFrame(viewFrame);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      brush.dispose();
      palette.dispose();
      for (const mesh of [sphere, floor, plinth]) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }
      layers.forEach(layer => layer.texture.dispose());
      environment.dispose();
      key.shadow.map?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
