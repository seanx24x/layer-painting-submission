import { experimentFactors } from "./workshop";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createPaintingBrush } from "./painting-brush";
import type { TechniqueSurface } from "./technique-study-types";
import type { StudyPalette } from "./study-palette";
import { roundContactRadius } from "./brush-contact";

import { BEVEL, CORE, cubeStrokes, type CubeStroke } from "./cube-strokes";
export { cubeStrokes } from "./cube-strokes";

function smooth(value: number) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

export function cubeStrokeProgress(stroke: CubeStroke, time: number) {
  return time <= stroke.start ? -1 : smooth((time - stroke.start) / (stroke.end - stroke.start));
}

const BRUSH_SCALE = .70;
const EDGE_PRESSURE = [.30, .15, .27] as const;

/** The fine pass uses less of the same bristle tip, rather than a new brush. */
export function cubeStrokePressure(stroke: CubeStroke, progress: number) {
  return EDGE_PRESSURE[stroke.layer] * smooth(progress / .06) * smooth((1 - progress) / .08);
}

/** Positive outside; used to keep repositioning arcs out of the solid cube. */
export function cubeSurfaceDistance(point: THREE.Vector3) {
  const q = new THREE.Vector3(Math.abs(point.x) - CORE, Math.abs(point.y) - CORE, Math.abs(point.z) - CORE);
  return Math.hypot(Math.max(q.x, 0), Math.max(q.y, 0), Math.max(q.z, 0)) + Math.min(Math.max(q.x, q.y, q.z), 0) - BEVEL;
}

function outside(point: THREE.Vector3, minimum: number) {
  const closest = point.clone().clampScalar(-CORE, CORE);
  const direction = point.clone().sub(closest);
  const length = direction.length();
  if (length < BEVEL + minimum) {
    if (length < 1e-8) direction.set(0, 0, 1);
    point.copy(closest).addScaledVector(direction.normalize(), BEVEL + minimum);
  }
  return point;
}

export function cubeBrushPose(time: number) {
  let index = cubeStrokes.findIndex(stroke => time <= stroke.end);
  if (index < 0) index = cubeStrokes.length - 1;
  const stroke = cubeStrokes[index];
  const progress = Math.max(0, cubeStrokeProgress(stroke, time));
  const point = new THREE.Vector3().fromArray(stroke.from).lerp(new THREE.Vector3().fromArray(stroke.to), progress);
  const normal = new THREE.Vector3().fromArray(stroke.normal).normalize();
  const handle = new THREE.Vector3().fromArray(stroke.handle).normalize();
  const contact = time > stroke.start && time < stroke.end;
  const pressure = contact ? cubeStrokePressure(stroke, progress) : 0;
  if (time < stroke.start) {
    const previous = cubeStrokes[index - 1];
    const t = smooth((time - (previous?.end ?? .8)) / (stroke.start - (previous?.end ?? .8)));
    const from = new THREE.Vector3().fromArray(previous?.to ?? stroke.from);
    const fromNormal = new THREE.Vector3().fromArray(previous?.normal ?? stroke.normal).normalize();
    point.copy(from).lerp(new THREE.Vector3().fromArray(stroke.from), t);
    normal.copy(fromNormal).lerp(new THREE.Vector3().fromArray(stroke.normal).normalize(), t).normalize();
    handle.fromArray(previous?.handle ?? stroke.handle).normalize().lerp(new THREE.Vector3().fromArray(stroke.handle).normalize(), t).normalize();
    // Lift promptly, travel with clearance, then lower gently into the next
    // stroke. A sine arc spends too much of a short transfer grazing the edge.
    const clearance = previous
      ? .42 * smooth(t / .22) * smooth((1 - t) / .26)
      : 3 * (1 - t);
    point.addScaledVector(normal, clearance);
  } else if (time > stroke.end) {
    point.addScaledVector(normal, smooth((time - stroke.end) / 1.2) * 4);
  }
  point.addScaledVector(normal, .004);
  outside(point, .004);
  return { point, normal, handle, pressure, contact, visible: time >= .8 && time <= 22.7, layer: stroke.layer };
}

export function createCubeStudy(palette?: StudyPalette, artwork = false): TechniqueSurface {
  const group = new THREE.Group();
  group.name = "Beveled cube edge highlighting";
  const geometry = new RoundedBoxGeometry(1.6, 1.6, 1.6, 8, BEVEL);
  const material = new THREE.MeshPhysicalMaterial({ color: palette?.base.hex ?? "#285cdf", roughness: .66, clearcoat: .025, clearcoatRoughness: .6 });
  const progress = cubeStrokes.map(() => -1);
  const uniforms = {
    edgeProgress: { value: progress },
    edgeClock: { value: 0 },
    edgeTiming: { value: cubeStrokes.map(stroke => new THREE.Vector2(stroke.start, stroke.end - stroke.start)) },
    edgeWidth: { value: EDGE_PRESSURE.map(pressure => roundContactRadius(pressure) * BRUSH_SCALE) },
    compareEdges: { value: 0 },
    edgeFrom: { value: cubeStrokes.map(stroke => new THREE.Vector3().fromArray(stroke.from)) },
    edgeTo: { value: cubeStrokes.map(stroke => new THREE.Vector3().fromArray(stroke.to)) },
    edgeBaseColor: { value: palette ? material.color : new THREE.Color().setRGB(.021, .109, .738) },
    edgeLowColor: { value: palette ? new THREE.Color(palette.coats[0].hex).lerp(material.color, .7) : new THREE.Color().setRGB(.15, .29, .52) },
    edgeBroadColor: { value: new THREE.Color(palette?.coats[0].hex ?? "#70a7e5") },
    edgeFineColor: { value: new THREE.Color(palette?.coats[1].hex ?? "#c1dcf1") },
    edgeCornerColor: { value: new THREE.Color(palette?.coats[2].hex ?? "#e0edf7") },
  };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = "varying vec3 vCubePoint;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvCubePoint = position;");
    shader.fragmentShader = `
      varying vec3 vCubePoint;
      uniform float edgeProgress[9];
      uniform float edgeClock;
      uniform vec2 edgeTiming[9];
      uniform float edgeWidth[3];
      uniform float compareEdges;
      uniform vec3 edgeFrom[9];
      uniform vec3 edgeTo[9];
      uniform vec3 edgeBaseColor;
      uniform vec3 edgeLowColor;
      uniform vec3 edgeBroadColor;
      uniform vec3 edgeFineColor;
      uniform vec3 edgeCornerColor;
      vec2 edgeStroke(vec3 point, vec3 from, vec3 to, float progress, float width, vec2 timing, float feather) {
        if (progress <= 0.) return vec2(0.);
        vec3 path = to - from;
        float pathLength = length(path);
        float along = clamp(dot(point - from, path) / max(dot(path, path), .000001), 0., progress);
        // A single continuous film follows the very same path as the brush.
        // The settled trail keeps its shape while the live front broadens
        // with pressure. No particles or frame-history stamps are involved.
        float pressure = smoothstep(0., .06, along) * (1. - smoothstep(.92, 1., along));
        float localWidth = width * mix(.38, 1., pressure) * (.94 + .06 * sin(along * 53.));
        if (pathLength < .0001) localWidth = width * mix(.38, 1., smoothstep(0., .45, progress));
        float distance = length(point - from - path * along);
        float coverage = (1. - smoothstep(localWidth - feather, localWidth + feather, distance))
          * smoothstep(0., .018, progress);
        // Invert the authored smoothstep to recover when this piece of paint
        // was laid down. The slight wet sheen dries without recolouring it.
        float depositedAt = pathLength < .0001 ? timing.x
          : timing.x + timing.y * (.5 - sin(asin(clamp(1. - 2. * along, -1., 1.)) / 3.));
        float wet = 1. - smoothstep(.05, 1.05, max(0., edgeClock - depositedAt));
        return vec2(coverage, coverage * wet);
      }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `
      #include <color_fragment>
      float broad = 0.;
      float fine = 0.;
      float corners = 0.;
      float edgeWetFilm = 0.;
      // Sample one continuous pixel footprint before the stroke loop. Taking
      // derivatives of each capped distance exposed triangle seams in the
      // rendered lesson. The bound also keeps grazing pixels from widening a
      // highlight across an otherwise unpainted face.
      float edgeFeather = clamp(length(fwidth(vCubePoint)) * .65, .0012, .004);
      for (int i = 0; i < 3; i++) {
        vec2 broadPass = edgeStroke(vCubePoint, edgeFrom[i], edgeTo[i], edgeProgress[i], edgeWidth[0], edgeTiming[i], edgeFeather);
        vec2 finePass = edgeStroke(vCubePoint, edgeFrom[i+3], edgeTo[i+3], edgeProgress[i+3], edgeWidth[1], edgeTiming[i+3], edgeFeather);
        vec2 cornerPass = edgeStroke(vCubePoint, edgeFrom[i+6], edgeTo[i+6], edgeProgress[i+6], edgeWidth[2], edgeTiming[i+6], edgeFeather);
        broad = max(broad, broadPass.x);
        fine = max(fine, finePass.x);
        corners = max(corners, cornerPass.x);
        edgeWetFilm = max(edgeWetFilm, max(broadPass.y, max(finePass.y, cornerPass.y)));
      }
      float grain = fract(sin(dot(floor(vCubePoint * 1900.), vec3(12.9898,78.233,39.425))) * 43758.5453);
      diffuseColor.rgb = mix(diffuseColor.rgb, edgeBroadColor, broad * .88 * mix(.5,1.,smoothstep(-.65,.65,vCubePoint.y)));
      diffuseColor.rgb = mix(diffuseColor.rgb, edgeFineColor, fine * .94 * mix(.45,1.,smoothstep(-.65,.65,vCubePoint.y)));
      diffuseColor.rgb = mix(diffuseColor.rgb, edgeCornerColor, corners);
      diffuseColor.rgb *= 1. + (grain - .5) * .014 * ${artwork ? "1." : "(1. - smoothstep(.5, 1.5, length(fwidth(vCubePoint * 1900.))))"};
      if (compareEdges > .5) {
        vec3 p = abs(vCubePoint);
        float median = p.x+p.y+p.z-min(p.x,min(p.y,p.z))-max(p.x,max(p.y,p.z));
        float mask = smoothstep(.744,.76,median);
        float height = smoothstep(-.6,.65,vCubePoint.y);
        vec3 edgeTone = compareEdges > 1.5 ? edgeCornerColor : mix(edgeLowColor,edgeFineColor,height);
        diffuseColor.rgb = mix(edgeBaseColor,edgeTone,mask);
      }
      ${artwork ? `
        // Three coloured passes meet on the visible corner. Their union keeps
        // the rounded junction covered without adding an isolated corner dot.
        float lilac = smoothstep(.742, .762, min(vCubePoint.y, vCubePoint.z));
        float powder = smoothstep(.742, .762, min(vCubePoint.x, vCubePoint.y));
        float mint = smoothstep(.742, .762, min(vCubePoint.x, vCubePoint.z));
        float coverage = 1. - (1. - lilac) * (1. - powder) * (1. - mint);
        vec3 pigment = (edgeBroadColor * lilac + edgeFineColor * powder + edgeCornerColor * mint)
          / max(lilac + powder + mint, .0001);
        diffuseColor.rgb = mix(edgeBaseColor, pigment, coverage * .98);
        diffuseColor.rgb *= 1. + (grain - .5) * .006;
      ` : ""}
    `);
    if (!artwork) shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", `
      #include <roughnessmap_fragment>
      if (compareEdges < .5) roughnessFactor = mix(roughnessFactor, .43, edgeWetFilm * .72);
    `);
  };
  material.customProgramCacheKey = () => artwork ? "layer-cube-artwork-v1" : "layer-cube-edges-v3";
  const cube = new THREE.Mesh(geometry, material);
  cube.name = "Satin beveled practice cube";
  cube.castShadow = true;
  cube.receiveShadow = true;
  group.add(cube);

  const brush = createPaintingBrush();
  brush.group.scale.set(BRUSH_SCALE, .85, BRUSH_SCALE);
  group.add(brush.group);
  const colors = [uniforms.edgeBroadColor.value, uniforms.edgeFineColor.value, uniforms.edgeCornerColor.value];
  const axisX = new THREE.Vector3();
  const axisZ = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  return {
    group,
    update(time, experiment) {
      uniforms.compareEdges.value = Number(group.userData.compareEdges ?? 0);
      uniforms.edgeClock.value = time;
      const factors = experimentFactors("edges", experiment);
      uniforms.edgeWidth.value = EDGE_PRESSURE.map(pressure => roundContactRadius(Math.min(1,pressure * factors.pressure)) * BRUSH_SCALE);
      for (let i = 0; i < cubeStrokes.length; i++) progress[i] = cubeStrokeProgress(cubeStrokes[i], time);
      const pose = cubeBrushPose(time);
      brush.group.visible = pose.visible && !group.userData.comparison;
      brush.group.position.copy(pose.point);
      axisX.crossVectors(pose.normal, pose.handle);
      if (axisX.lengthSq() < .000001) axisX.set(1, 0, 0);
      axisX.normalize();
      axisZ.crossVectors(axisX, pose.handle).normalize();
      matrix.makeBasis(axisX, pose.handle, axisZ);
      brush.group.quaternion.setFromRotationMatrix(matrix);
      brush.setContact(pose.pressure * factors.pressure, colors[pose.layer], factors.load);
      group.userData.contact = pose.visible && pose.contact;
      group.userData.brushPoint = pose.point.toArray().map(n => n.toFixed(5)).join(",");
      group.userData.paintState = progress.map(n => n.toFixed(4)).join(",");
    },
    dispose() {
      brush.dispose();
      geometry.dispose();
      material.dispose();
      group.clear();
    },
  };
}
