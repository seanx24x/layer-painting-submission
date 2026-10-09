"use client";

import { useEffect, useRef, useState } from "react";
import type * as Three from "three";

export type MiniatureStage = "primer" | "base" | "shade" | "edge" | "fine";
export type MiniatureFocus = "model" | "shoulder" | "helmet";
export type MiniaturePerspective = "front" | "three-quarter" | "side";
export type MiniatureTechnique =
  "base" | "recess" | "tidy" | "edge" | "fine" | "drybrush" | "finish";
export type MiniatureSceneProps = {
  baseColor: string;
  edgeColor: string;
  fineColor: string;
  recessColor?: string;
  stage: MiniatureStage;
  focus: MiniatureFocus;
  perspective: MiniaturePerspective;
  progress?: number;
  technique?: MiniatureTechnique;
  reducedMotion?: boolean;
  /** Freeze an active guided camera move; idle manual inspection remains available. */
  cameraPaused?: boolean;
  className?: string;
};

type Runtime = {
  update: (props: MiniatureSceneProps) => void;
  dispose: () => void;
};
type ThreeModule = typeof import("three");
type GLTFLoaderConstructor =
  typeof import("three/addons/loaders/GLTFLoader.js").GLTFLoader;
const MODEL_URL = "/models/primaris-space-marine.glb";
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const ease = (value: number) =>
  value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
const stageIndex = (stage: MiniatureStage) =>
  ["primer", "base", "shade", "edge", "fine"].indexOf(stage);
const sceneLabel = (props: MiniatureSceneProps, painted: boolean) =>
  `Space Marine sculpt by DicamoCM, ${props.perspective.replace("-", " ")} view, ${props.focus === "model" ? "whole model" : `${props.focus} close-up`}. ${painted ? `${props.stage} paint preview with digitally applied colours.` : "Neutral sculpt for inspecting the surface."} Brush technique is shown in the separate study.`;

type PaintAmounts = {
  base: number;
  recess: number;
  edge: number;
  fine: number;
  primer: number;
};
const paintChannels = ["base", "recess", "edge", "fine", "primer"] as const;
function paintAmounts(props: MiniatureSceneProps): PaintAmounts {
  const stage = stageIndex(props.stage);
  const progress = clamp(props.progress ?? 1);
  const amounts: PaintAmounts = {
    base: stage >= 1 ? 1 : 0,
    recess: stage >= 2 ? 1 : 0,
    edge: stage >= 3 ? 1 : 0,
    fine: stage >= 4 ? 1 : 0,
    primer: props.stage === "primer" ? 1 : 0,
  };
  if (props.stage === "primer") return amounts;
  switch (props.technique) {
    case "base":
      return { base: progress, recess: 0, edge: 0, fine: 0, primer: 0 };
    case "recess":
      return { base: 1, recess: progress, edge: 0, fine: 0, primer: 0 };
    case "tidy":
      // No authored spill mask exists. Keep the correct finished recess here;
      // the companion brush study demonstrates the cleanup stroke explicitly.
      return { base: 1, recess: 1, edge: 0, fine: 0, primer: 0 };
    case "edge":
    case "drybrush":
      return { base: 1, recess: 1, edge: progress, fine: 0, primer: 0 };
    case "fine":
      return { base: 1, recess: 1, edge: 1, fine: progress, primer: 0 };
    default:
      return amounts;
  }
}

/** Demand-rendered, locally hosted Space Marine sculpt with interruptible camera moves. */
export function MiniatureScene(props: MiniatureSceneProps) {
  const mount = useRef<HTMLDivElement>(null);
  const runtime = useRef<Runtime | null>(null);
  const latest = useRef(props);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );

  useEffect(() => {
    latest.current = props;
    runtime.current?.update(props);
  }, [props]);

  useEffect(() => {
    const container = mount.current;
    if (!container) return;
    let cancelled = false;
    let instance: Runtime | undefined;
    Promise.all([
      import("three"),
      import("three/addons/loaders/GLTFLoader.js"),
    ])
      .then(([THREE, { GLTFLoader }]) => {
        if (cancelled) return;
        try {
          instance = createScene(
            THREE,
            GLTFLoader,
            container,
            latest.current,
            () => {
              if (!cancelled) setStatus("ready");
            },
            () => {
              if (!cancelled) setStatus("unavailable");
            },
          );
          runtime.current = instance;
        } catch {
          if (!cancelled) setStatus("unavailable");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("unavailable");
      });
    return () => {
      cancelled = true;
      instance?.dispose();
      runtime.current = null;
    };
  }, []);

  return (
    <div
      className={`miniature-scene ${props.className ?? ""}`}
      data-renderer={status}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 260,
      }}
    >
      <div
        ref={mount}
        aria-hidden={status !== "ready"}
        style={{
          position: "absolute",
          inset: 0,
          visibility: status === "ready" ? "visible" : "hidden",
        }}
      />
      {status !== "ready" && (
        <MiniatureFallback {...props} unavailable={status === "unavailable"} />
      )}
    </div>
  );
}

function MiniatureFallback(
  props: MiniatureSceneProps & { unavailable: boolean },
) {
  const shade = stageIndex(props.stage) >= 2;
  const highlighted = stageIndex(props.stage) >= 3;
  const fill = props.stage === "primer" ? "#b7bbc2" : props.baseColor;
  return (
    <div
      className="miniature-scene-fallback"
      style={{
        height: "100%",
        minHeight: 260,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        viewBox="0 0 400 430"
        role="img"
        aria-label={`Temporary flat illustration of an armoured miniature at the ${props.stage} painting stage. This is not the downloaded Space Marine sculpt.`}
        style={{ flex: 1, minHeight: 0, maxHeight: 400, width: "100%" }}
      >
        <ellipse
          cx="200"
          cy="378"
          rx="105"
          ry="17"
          fill="#23364a"
          opacity=".07"
        />
        <path
          d="M102 350Q200 323 298 350V367Q200 397 102 367Z"
          fill="#bcc3c7"
        />
        <ellipse cx="200" cy="350" rx="98" ry="23" fill="#d5d9d7" />
        <g fill={shade ? (props.recessColor ?? "#253246") : "#556580"}>
          <path d="M168 244L146 319H184L199 256L216 319H252L232 244Z" />
          <path d="M125 155L105 239L128 252L155 176M275 155L295 239L272 252L245 176" />
          <rect x="179" y="115" width="43" height="38" rx="14" />
        </g>
        <g
          fill={fill}
          stroke={shade ? (props.recessColor ?? "#253246") : fill}
          strokeWidth="3"
          strokeLinejoin="round"
        >
          <path d="M150 146L200 131L250 146L239 219L223 240H177L161 219Z" />
          <path d="M113 132Q131 113 157 137L155 175L106 178Z" />
          <path d="M287 132Q269 113 243 137L245 175L294 178Z" />
          <path d="M105 206L131 212L124 251L96 246Z" />
          <path d="M295 206L269 212L276 251L304 246Z" />
          <path d="M157 249L186 253L178 292L147 286Z" />
          <path d="M243 249L214 253L222 292L253 286Z" />
          <path d="M145 299L181 302L180 340L132 345L130 333Z" />
          <path d="M255 299L219 302L220 340L268 345L270 333Z" />
          <path d="M178 79Q200 59 222 79L228 111L215 129H185L172 111Z" />
        </g>
        <path
          d="M179 95L196 99M221 95L204 99"
          stroke="#192736"
          strokeWidth="7"
        />
        <path
          d="M181 94L195 97M219 94L205 97"
          stroke="#d6a275"
          strokeWidth="2"
        />
        <path
          d="M157 155L197 162V190L166 181M243 155L203 162V190L234 181"
          fill="#fff"
          opacity=".11"
        />
        {highlighted && (
          <g
            fill="none"
            stroke={props.stage === "fine" ? props.fineColor : props.edgeColor}
            strokeWidth={props.stage === "fine" ? 2.5 : 5}
            strokeLinecap="round"
          >
            <path d="M108 173L151 170M249 170L292 173M159 153L195 161M205 161L241 153M147 303L176 306M224 306L253 303" />
            <path d="M180 83Q200 69 220 83" />
          </g>
        )}
      </svg>
      <p
        role="status"
        style={{
          margin: "0 20px 16px",
          textAlign: "center",
          fontSize: 12,
          color: "#667078",
        }}
      >
        {props.unavailable
          ? "3D view is unavailable. A flat illustration is shown instead."
          : "Loading the Space Marine. Illustration shown temporarily."}
      </p>
    </div>
  );
}

function createScene(
  THREE: ThreeModule,
  GLTFLoader: GLTFLoaderConstructor,
  container: HTMLDivElement,
  initial: MiniatureSceneProps,
  ready: () => void,
  unavailable: () => void,
): Runtime {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.07;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.dataset.model = "primaris-space-marine";
  renderer.domElement.style.cssText = "display:block;width:100%;height:100%;";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
  const materials = new Set<Three.Material>();
  const geometries = new Set<Three.BufferGeometry>();
  const textures = new Set<Three.Texture>();
  const rememberMaterial = (material: Three.Material) => {
    materials.add(material);
    for (const value of Object.values(material)) {
      if ((value as Three.Texture | null)?.isTexture)
        textures.add(value as Three.Texture);
    }
  };
  // Region names and curvature are authored into the asset offline. Runtime
  // painting never classifies triangles or infers a region from its position.
  const primerColor = new THREE.Color("#bbbeb8");
  const clay = new THREE.MeshStandardMaterial({
    color: primerColor,
    roughness: 0.78,
    metalness: 0,
  });
  rememberMaterial(clay);
  const paintUniforms = {
    layerPrimer: { value: primerColor },
    layerBase: { value: new THREE.Color(initial.baseColor) },
    layerRecess: { value: new THREE.Color(initial.recessColor ?? "#253246") },
    layerEdge: { value: new THREE.Color(initial.edgeColor) },
    layerFine: { value: new THREE.Color(initial.fineColor) },
    layerAmounts: { value: new THREE.Vector4() },
  };
  const authoredSurfaces: {
    material: Three.MeshStandardMaterial;
    color: Three.Color;
    emissive: Three.Color;
    metalness: number;
    roughness: number;
  }[] = [];
  const surfaceMaterials = new Map<string, Three.Material>();
  const materialNames = new Set<string>();
  let paintRegionsAvailable = false;
  let curvatureRegions = 0;
  let armourRegions = 0;

  const paintedMaterial = (
    source: Three.Material,
    hasCurvature: boolean,
  ): Three.Material => {
    const region = source.name.trim().toLowerCase();
    materialNames.add(region);
    const cacheKey = `${source.uuid}:${hasCurvature}`;
    const existing = surfaceMaterials.get(cacheKey);
    if (existing) return existing;
    const standard = source as Three.MeshStandardMaterial;
    if (!standard.isMeshStandardMaterial) return source;
    const result = standard.clone();
    // COLOR_0 contains scalar masks, not visible vertex colours. Only the armour
    // shader consumes it, and replaces Three's normal colour multiplication.
    result.vertexColors = region === "armour" && hasCurvature;
    if (region === "armour") {
      paintRegionsAvailable = true;
      result.color.set("#ffffff");
      result.roughness = 0.74;
      result.metalness = 0;
      result.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, paintUniforms);
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            `#include <common>
            uniform vec3 layerPrimer;
            uniform vec3 layerBase;
            uniform vec3 layerRecess;
            uniform vec3 layerEdge;
            uniform vec3 layerFine;
            uniform vec4 layerAmounts;`,
          )
          .replace(
            "#include <color_fragment>",
            `
            vec2 layerCurvature = vec2(0.0);
            #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
              layerCurvature = clamp(vColor.rg, 0.0, 1.0);
            #endif
            float layerRecessMask = smoothstep(0.08, 0.60, layerCurvature.g);
            float layerEdgeMask = smoothstep(0.12, 0.65, layerCurvature.r);
            float layerFineMask = smoothstep(0.70, 0.98, layerCurvature.r);
            vec3 layerPaint = mix(layerPrimer, layerBase, layerAmounts.x);
            layerPaint = mix(layerPaint, layerRecess,
              layerRecessMask * layerAmounts.y * 0.92);
            layerPaint = mix(layerPaint, layerEdge,
              layerEdgeMask * layerAmounts.z * 0.88);
            layerPaint = mix(layerPaint, layerFine,
              layerFineMask * layerAmounts.w * 0.94);
            diffuseColor.rgb = layerPaint;
            `,
          );
      };
      result.customProgramCacheKey = () => "layer-armour-curvature-v1";
    } else if (region !== "base" && region !== "stone") {
      authoredSurfaces.push({
        material: result,
        color: result.color.clone(),
        emissive: result.emissive.clone(),
        metalness: result.metalness,
        roughness: result.roughness,
      });
    }
    rememberMaterial(result);
    surfaceMaterials.set(cacheKey, result);
    return result;
  };

  scene.add(new THREE.HemisphereLight("#eff4ff", "#8f9390", 1.75));
  const key = new THREE.DirectionalLight("#fff7ec", 3.1);
  key.position.set(-3.5, 8, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 15;
  key.shadow.normalBias = 0.008;
  key.shadow.bias = -0.00015;
  key.shadow.radius = 4;
  scene.add(key);
  const fill = new THREE.DirectionalLight("#d4e2ff", 0.9);
  fill.position.set(4, 3, 4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight("#ffffff", 2.1);
  rim.position.set(1, 4, -4);
  scene.add(rim);

  const groundMaterial = new THREE.ShadowMaterial({
    color: "#5c6872",
    opacity: 0.08,
  });
  rememberMaterial(groundMaterial);
  const groundGeometry = new THREE.PlaneGeometry(200, 200);
  geometries.add(groundGeometry);
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.position.y = -0.015;
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const currentTarget = new THREE.Vector3();
  const targetCamera = new THREE.Vector3();
  const targetLook = new THREE.Vector3();
  const fromCamera = new THREE.Vector3();
  const fromLook = new THREE.Vector3();
  let currentProps = initial;
  let started = 0;
  let travelling = false;
  let travelDuration = 780;
  let travelProgress = 0;
  let frame = 0;
  let disposed = false;
  let loaded = false;
  let lost = false;
  let visible = !document.hidden;
  let measurable = true;
  let lastCameraKey = "";
  let paintCurrent = paintAmounts(initial);
  let paintFrom = { ...paintCurrent };
  let paintTarget = { ...paintCurrent };
  let paintStarted = 0;
  let paintDuration = 420;
  let paintProgress = 0;
  let paintMoving = false;
  const requestController = new AbortController();

  const applyPaint = () => {
    paintUniforms.layerAmounts.value.set(
      paintCurrent.base,
      paintCurrent.recess,
      paintCurrent.edge,
      paintCurrent.fine,
    );
    for (const surface of authoredSurfaces) {
      surface.material.color
        .copy(surface.color)
        .lerp(primerColor, paintCurrent.primer);
      surface.material.emissive
        .copy(surface.emissive)
        .multiplyScalar(1 - paintCurrent.primer);
      surface.material.metalness = surface.metalness * (1 - paintCurrent.primer);
      surface.material.roughness =
        surface.roughness + (0.78 - surface.roughness) * paintCurrent.primer;
    }
  };

  const setCameraGoal = (props: MiniatureSceneProps) => {
    const angle =
      props.perspective === "front"
        ? 0
        : props.perspective === "three-quarter"
          ? 0.57
          : 1.22;
    const modelView = props.focus === "model";
    const shoulderView = props.focus === "shoulder";
    targetLook.set(
      modelView ? 0 : shoulderView ? 0.53 : 0.25,
      modelView ? 1.38 : shoulderView ? 2.2 : 2.36,
      modelView ? 0 : shoulderView ? -0.03 : 0.385,
    );
    const distance =
      (modelView ? 5.95 : shoulderView ? 2.15 : 1.95) *
      (camera.aspect < 0.82 ? 1.11 : 1);
    const height = modelView ? 0.86 : 0.25;
    targetCamera.set(
      targetLook.x + Math.sin(angle) * distance,
      targetLook.y + height,
      targetLook.z + Math.cos(angle) * distance,
    );
  };

  const render = () => {
    if (disposed || lost || !loaded || !visible || !measurable) return;
    camera.lookAt(currentTarget);
    renderer.render(scene, camera);
  };
  const tick = (time: number) => {
    frame = 0;
    if (disposed || lost || !visible || !measurable) return;
    if (travelling && !currentProps.cameraPaused) {
      const amount = clamp((time - started) / travelDuration);
      travelProgress = amount;
      const eased = ease(amount);
      camera.position.lerpVectors(fromCamera, targetCamera, eased);
      currentTarget.lerpVectors(fromLook, targetLook, eased);
      travelling = amount < 1;
    }
    if (paintMoving && !currentProps.cameraPaused) {
      const amount = clamp((time - paintStarted) / paintDuration);
      paintProgress = amount;
      const eased = ease(amount);
      for (const channel of paintChannels) {
        paintCurrent[channel] =
          paintFrom[channel] + (paintTarget[channel] - paintFrom[channel]) * eased;
      }
      paintMoving = amount < 1;
      applyPaint();
    }
    render();
    if ((travelling || paintMoving) && !currentProps.cameraPaused)
      frame = requestAnimationFrame(tick);
  };
  const requestRender = () => {
    if (!frame && !disposed && !lost && visible && measurable)
      frame = requestAnimationFrame(tick);
  };
  const update = (props: MiniatureSceneProps) => {
    const previous = currentProps;
    currentProps = props;
    if (previous.cameraPaused && !props.cameraPaused && travelling) {
      fromCamera.copy(camera.position);
      fromLook.copy(currentTarget);
      started = performance.now();
      travelDuration = Math.max(100, travelDuration * (1 - travelProgress));
      travelProgress = 0;
    }
    if (previous.cameraPaused && !props.cameraPaused && paintMoving) {
      paintFrom = { ...paintCurrent };
      paintStarted = performance.now();
      paintDuration = Math.max(100, paintDuration * (1 - paintProgress));
      paintProgress = 0;
    }
    renderer.domElement.setAttribute(
      "aria-label",
      sceneLabel(props, paintRegionsAvailable),
    );
    renderer.domElement.dataset.paintStage = props.stage;
    const cameraKey = `${props.focus}:${props.perspective}`;
    const changedView = cameraKey !== lastCameraKey;
    if (changedView || (props.reducedMotion && !previous.reducedMotion)) {
      setCameraGoal(props);
      fromCamera.copy(camera.position);
      fromLook.copy(currentTarget);
      started = performance.now();
      travelDuration = 780;
      travelProgress = 0;
      travelling = Boolean(lastCameraKey) && !props.reducedMotion;
      if (!travelling) {
        camera.position.copy(targetCamera);
        currentTarget.copy(targetLook);
      }
      lastCameraKey = cameraKey;
    }
    if (props.reducedMotion) {
      travelling = false;
      camera.position.copy(targetCamera);
      currentTarget.copy(targetLook);
    }
    const nextPaint = paintAmounts(props);
    const changedPaint = paintChannels.some(
      (channel) => nextPaint[channel] !== paintTarget[channel],
    );
    const changedPalette =
      previous.baseColor !== props.baseColor ||
      previous.recessColor !== props.recessColor ||
      previous.edgeColor !== props.edgeColor ||
      previous.fineColor !== props.fineColor;
    if (changedPaint) {
      paintFrom = { ...paintCurrent };
      paintTarget = nextPaint;
      paintStarted = performance.now();
      paintDuration = 420;
      paintProgress = 0;
      paintMoving = !props.technique && !props.reducedMotion;
      if (!paintMoving) paintCurrent = { ...paintTarget };
    }
    const snapPaint = Boolean(props.technique || props.reducedMotion);
    const interruptedPaint = snapPaint && paintMoving;
    if (snapPaint) {
      paintMoving = false;
      paintCurrent = { ...paintTarget };
    }
    paintUniforms.layerBase.value.set(props.baseColor);
    paintUniforms.layerRecess.value.set(props.recessColor ?? "#253246");
    paintUniforms.layerEdge.value.set(props.edgeColor);
    paintUniforms.layerFine.value.set(props.fineColor);
    applyPaint();
    // Baked masks keep colour updates constant-time. A finished, idle model
    // draws no frames until its palette, painting progress or camera changes.
    if (
      changedView ||
      changedPaint ||
      changedPalette ||
      interruptedPaint ||
      travelling ||
      paintMoving ||
      previous.reducedMotion !== props.reducedMotion ||
      previous.cameraPaused !== props.cameraPaused
    ) {
      requestRender();
    }
  };
  const resize = () => {
    if (disposed || lost) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    measurable = width > 0 && height > 0;
    if (!measurable) {
      cancelAnimationFrame(frame);
      frame = 0;
      return;
    }
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    setCameraGoal(currentProps);
    if (!travelling) {
      camera.position.copy(targetCamera);
      currentTarget.copy(targetLook);
    } else {
      fromCamera.copy(camera.position);
      fromLook.copy(currentTarget);
      started = performance.now();
    }
    requestRender();
  };
  const onVisibility = () => {
    visible = !document.hidden;
    if (!visible) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else {
      fromCamera.copy(camera.position);
      fromLook.copy(currentTarget);
      started = performance.now();
      paintFrom = { ...paintCurrent };
      paintStarted = performance.now();
      requestRender();
    }
  };
  const onContextLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(frame);
    frame = 0;
    unavailable();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  document.addEventListener("visibilitychange", onVisibility);
  renderer.domElement.addEventListener("webglcontextlost", onContextLost);
  resize();
  update(initial);

  // Fetch is abortable; parsing can outlive an unmount, so late resources are
  // disposed separately before they ever enter the scene or update React state.
  void fetch(MODEL_URL, { signal: requestController.signal })
    .then((response) => {
      if (!response.ok) throw new Error(`Model request failed: ${response.status}`);
      return response.arrayBuffer();
    })
    .then((buffer) => {
      if (disposed) return null;
      return new GLTFLoader().parseAsync(buffer, "/models/");
    })
    .then((gltf) => {
      if (!gltf) return;
      if (disposed || lost) {
        disposeImportedScene(gltf.scene);
        return;
      }
      gltf.scene.traverse((object) => {
        const mesh = object as Three.Mesh;
        if (!mesh.isMesh) return;
        geometries.add(mesh.geometry);
        const sourceMaterials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        sourceMaterials.forEach(rememberMaterial);
        const curvature = mesh.geometry.getAttribute("color");
        const hasCurvature = Boolean(curvature && curvature.itemSize >= 2);
        const mappedMaterials = sourceMaterials.map((source) => {
          if (source.name.trim().toLowerCase() === "armour") {
            armourRegions += 1;
            if (hasCurvature) curvatureRegions += 1;
          }
          return paintedMaterial(source, hasCurvature);
        });
        mesh.material = Array.isArray(mesh.material)
          ? mappedMaterials
          : mappedMaterials[0] ?? clay;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      });
      // Conversion grounds and centres the sculpt at a height of 2.7 units.
      scene.add(gltf.scene);
      loaded = true;
      applyPaint();
      renderer.domElement.setAttribute(
        "aria-label",
        sceneLabel(currentProps, paintRegionsAvailable),
      );
      renderer.domElement.dataset.materials = [...materialNames].sort().join(",");
      renderer.domElement.dataset.curvature =
        curvatureRegions === 0
          ? "unavailable"
          : curvatureRegions === armourRegions
            ? "available"
            : "partial";
      renderer.shadowMap.needsUpdate = true;
      resize();
      render();
      ready();
    })
    .catch((error: unknown) => {
      if (disposed || requestController.signal.aborted) return;
      console.warn("The Space Marine model could not be loaded.", error);
      unavailable();
    });

  return {
    update,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      requestController.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      key.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}

function disposeImportedScene(scene: Three.Object3D) {
  const geometries = new Set<Three.BufferGeometry>();
  const materials = new Set<Three.Material>();
  const textures = new Set<Three.Texture>();
  scene.traverse((object) => {
    const mesh = object as Three.Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    const meshMaterials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    meshMaterials.forEach((material) => {
      materials.add(material);
      for (const value of Object.values(material)) {
        if ((value as Three.Texture | null)?.isTexture)
          textures.add(value as Three.Texture);
      }
    });
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}
