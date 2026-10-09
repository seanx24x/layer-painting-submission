import { experimentFactors, type WorkshopExperiment } from "./workshop";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createPaintingBrush } from "./painting-brush";
import type { TechniqueSurface } from "./technique-study-types";
import type { StudyPalette } from "./study-palette";

import { tilePaintStrokes, type TileStroke } from "./tile-strokes";
export { tilePaintStrokes } from "./tile-strokes";

type TileTechnique = "recess" | "drybrush";
const tileStrokes = { recess: tilePaintStrokes("recess"), drybrush: tilePaintStrokes("drybrush") };
const FRONT = .102;
const RELIEF = .145;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };

export const tilePaintColors = {
  recess: ["#27515e", "#234651", "#17343f"],
  drybrush: ["#70a9ae", "#8ac0c2", "#d0dddd"],
} as const;

/** The same surface function constructs the relief and locates brush contact. */
export function tileSurfaceHeight(x: number, y: number) {
  const ridge = Math.pow(Math.max(0, .5 + .5 * Math.cos(x / .32 * Math.PI * 2)), .72);
  const rim = ease((.83 - Math.abs(x)) / .075) * ease((.73 - Math.abs(y)) / .12);
  return FRONT + RELIEF * ridge * rim;
}

export function tileStrokePoint(stroke: TileStroke, progress: number, technique: TileTechnique) {
  const p = clamp(progress);
  const x = THREE.MathUtils.lerp(stroke.from[0], stroke.to[0], p);
  const y = THREE.MathUtils.lerp(stroke.from[1], stroke.to[1], p)
    + (technique === "drybrush" ? .024 * Math.sin(Math.PI * p) : 0);
  // A drybrush spans the tops; it must never dip into a valley during a sweep.
  const z = technique === "drybrush" ? FRONT + RELIEF : tileSurfaceHeight(x, y);
  return new THREE.Vector3(x, y, z);
}

/** Authored contact, lift and return arcs can be evaluated in any frame order. */
export function tileBrushPose(technique: TileTechnique, inputTime: number) {
  const time = THREE.MathUtils.clamp(inputTime, 0, 24);
  const strokes = tileStrokes[technique];
  let index = strokes.findIndex(stroke => time <= stroke.end);
  if (index < 0) index = strokes.length - 1;
  const stroke = strokes[index];
  const previous = strokes[index - 1];
  const progress = ease((time - stroke.start) / (stroke.end - stroke.start));
  const point = tileStrokePoint(stroke, progress, technique);
  const contact = time > stroke.start && time < stroke.end;
  let returnProgress = 1;

  if (time < stroke.start) {
    if (previous) {
      const t = clamp((time - previous.end) / (stroke.start - previous.end));
      // Lift before translating, then settle vertically into the next pass.
      // This keeps the round tip clear of a ridge when changing channels.
      returnProgress = ease((t - .12) / .76);
      const origin = tileStrokePoint(previous, 1, technique);
      point.lerpVectors(origin, point.clone(), returnProgress);
      point.z += .31 * ease(t / .26) * (1 - ease((t - .72) / .28));
    } else {
      returnProgress = ease(time / stroke.start);
      point.add(new THREE.Vector3(2.1, 3.4, 1.5).multiplyScalar(1 - returnProgress));
    }
  } else if (time > stroke.end) {
    const lift = ease((time - stroke.end) / (24 - stroke.end));
    point.add(new THREE.Vector3(2.1, 3.4, 1.5).multiplyScalar(lift));
  }
  point.z += .003;

  const targetLean = stroke.to[0] > stroke.from[0] ? -.48 : .48;
  const previousLean = previous ? (previous.to[0] > previous.from[0] ? -.48 : .48) : targetLean;
  const wrist = contact ? Math.sin(progress * Math.PI) : 0;
  const handle = technique === "drybrush"
    ? new THREE.Vector3(THREE.MathUtils.lerp(previousLean, targetLean, returnProgress) * (1 - .09 * wrist), .40 + .04 * wrist, .78)
    : new THREE.Vector3(.22 + .025 * wrist, .72 - .035 * wrist, .67);
  const pressure = contact
    ? (technique === "drybrush" ? .28 : .20) * ease(progress / .035) * ease((1 - progress) / .07) * (1 - .08 * wrist)
    : 0;
  return { point, handle: handle.normalize(), pressure, contact, visible: time > 0 && time < 24, layer: stroke.layer };
}

/** An actual corrugated relief. Paint masks stay in its local surface coordinates. */
export function createTileStudy(technique: TileTechnique, palette?: StudyPalette, artwork = false): TechniqueSurface {
  const group = new THREE.Group();
  group.name = technique === "recess" ? "Recess shading relief" : "Drybrushing relief";
  const colors = (palette ? palette.coats.map(paint => paint.hex) : tilePaintColors[technique]).map(color => new THREE.Color(color));
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const baseColor = new THREE.Color(palette?.base.hex ?? "#397684");
  const slabGeometry = new RoundedBoxGeometry(1.86, 1.66, .20, 5, .075);
  const slabMaterial = new THREE.MeshPhysicalMaterial({ color: baseColor, roughness: .76, clearcoat: .025 });
  const slab = new THREE.Mesh(slabGeometry, slabMaterial);
  slab.name = "Softly beveled practice tile";
  slab.castShadow = true; slab.receiveShadow = true;
  group.add(slab);
  geometries.push(slabGeometry); materials.push(slabMaterial);

  const reliefGeometry = new THREE.PlaneGeometry(1.66, 1.46, 200, 88);
  const vertices = reliefGeometry.getAttribute("position");
  for (let i = 0; i < vertices.count; i++) vertices.setZ(i, tileSurfaceHeight(vertices.getX(i), vertices.getY(i)));
  vertices.needsUpdate = true;
  reliefGeometry.computeVertexNormals();
  const strokes = tileStrokes[technique];
  const paths = Array.from({ length: 8 }, (_, i) => {
    const stroke = strokes[i];
    return stroke ? new THREE.Vector4(...stroke.from, ...stroke.to) : new THREE.Vector4();
  });
  const states = Array.from({ length: 8 }, (_, i) => new THREE.Vector4(0, strokes[i]?.width ?? 0, strokes[i]?.layer ?? 0, i < strokes.length ? 1 : 0));
  const uniforms = {
    wetPoint: {value:new THREE.Vector2()}, wetAmount:{value:0},
    mistake: {value:0},
    experimentAmount: {value:.4},
    // Catalogue shade swatches depict a tint on a light substrate. Applying
    // that tint over the current paint must absorb light, not cover it opaquely.
    // Generic studio colours remain the previously authored final shade tones.
    tileShadeTint: { value: technique === "recess" && palette ? 1 : 0 },
    tilePaths: { value: paths }, tileStates: { value: states },
    tileBase: { value: baseColor }, tileFirst: { value: colors[0] },
    tileSecond: { value: colors[1] }, tileFinal: { value: colors[2] },
  };
  const reliefMaterial = new THREE.MeshPhysicalMaterial({ color: "white", roughness: .77, clearcoat: .025 });
  reliefMaterial.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = "varying vec3 vTilePosition;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvTilePosition = position;");
    shader.fragmentShader = `
      varying vec3 vTilePosition;
      uniform vec2 wetPoint;
      uniform float wetAmount;
      uniform float mistake;
      uniform float experimentAmount;
      uniform float tileShadeTint;
      uniform vec4 tilePaths[8];
      uniform vec4 tileStates[8];
      uniform vec3 tileBase;
      uniform vec3 tileFirst;
      uniform vec3 tileSecond;
      uniform vec3 tileFinal;
      float tilePaintCoverage;
      float tileGrain(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }
      float tileNoise(vec2 p) {
        vec2 cell = floor(p), local = fract(p);
        vec2 blend = local * local * (3. - 2. * local);
        return mix(mix(tileGrain(cell), tileGrain(cell + vec2(1., 0.)), blend.x),
          mix(tileGrain(cell + vec2(0., 1.)), tileGrain(cell + vec2(1., 1.)), blend.x), blend.y);
      }
      vec3 applyTilePaint(vec3 undercoat, vec3 paint, float coverage) {
        vec3 depositedColor = mix(paint, undercoat * paint, tileShadeTint);
        return mix(undercoat, depositedColor, coverage);
      }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `
      vec3 deposits = vec3(0.);
      float heightRatio = clamp((vTilePosition.z - ${FRONT}) / ${RELIEF}, 0., 1.);
      float fleck = tileGrain(floor(vTilePosition.xy * 820.));
      ${artwork ? technique === "recess" ? `
        // Editorial thumbnail: a continuous finished shade in each channel.
        // The live study below still deposits every authored brush stroke.
        float panel = (1. - smoothstep(.73, .83, abs(vTilePosition.x)))
          * (1. - smoothstep(.56, .73, abs(vTilePosition.y)));
        float valley = pow(1. - smoothstep(.025, mix(.22,.95,experimentAmount), heightRatio), 1.35);
        deposits.x = valley * panel * (.93 + fleck * .07);
        deposits.y = (1. - smoothstep(.015, .27, heightRatio)) * panel * .84;
        deposits.z = (1. - smoothstep(.005, .12, heightRatio)) * panel * .58;
      ` : `
        // Continuous crest deposits retain the dry pigment grain. A soft
        // upper-light gradient avoids a stack of rectangular stroke ends.
        float upperLight = .58 + .42 * smoothstep(-.55, .65, vTilePosition.y);
        float dryGrain = mix(.55, 1., smoothstep(.12, .8, fleck));
        deposits.x = smoothstep(.56, .98, heightRatio) * dryGrain;
        deposits.y = smoothstep(.72, .995, heightRatio) * dryGrain * upperLight;
        deposits.z = smoothstep(.86, 1., heightRatio) * dryGrain * upperLight;
      ` : `for (int i = 0; i < 8; i++) {
        vec4 state = tileStates[i];
        if (state.x > 0. && state.w > .5) {
          vec2 begin = tilePaths[i].xy;
          vec2 line = tilePaths[i].zw - begin;
          float pathLength = length(line);
          vec2 direction = line / max(pathLength, .000001);
          float along = dot(vTilePosition.xy - begin, direction);
          float pathProgress = clamp(along / pathLength, 0., 1.);
          vec2 centre = begin + line * pathProgress;
          float footprint;
          ${technique === "recess" ? `
            // A connected wet trail advances just ahead of the point. Its
            // soft meniscus stays inside the channel, never on the crest.
            float distanceToChannel = length(vTilePosition.xy - centre);
            float loadedWidth = state.y * mix(.45, 2.4, experimentAmount);
            float channel = 1. - smoothstep(loadedWidth * .36, loadedWidth, distanceToChannel);
            float tip = state.x * pathLength;
            float lead = 1. - smoothstep(tip - .009, tip + .026, along);
            float start = smoothstep(-.018, .035, along);
            float finish = 1. - smoothstep(pathLength - .02, pathLength + .012, along);
            footprint = channel * lead * start * finish * smoothstep(0., .025, state.x);
            footprint *= pow(1. - smoothstep(.025, mix(.22,.95,experimentAmount), heightRatio), 1.35) * (.96 + fleck * .04);
          ` : `
            // The sweep has a slight wrist arc; the same curve places the
            // bristles. Soft, irregular coverage avoids rectangular ends.
            centre.y += .024 * sin(pathProgress * 3.14159265);
            float across = abs(vTilePosition.y - centre.y);
            float feather = exp(-pow(across / max(state.y * .73, .001), 2.) * 1.7);
            float front = 1. - smoothstep(state.x * pathLength - .018, state.x * pathLength + .026, along);
            float ends = smoothstep(-.04, .10, along) * (1. - smoothstep(pathLength - .10, pathLength + .035, along));
            float fibres = tileNoise(vec2(vTilePosition.x * 34., vTilePosition.y * 215. + float(i) * 7.));
            float tooth = tileNoise(vTilePosition.xy * vec2(240., 310.) + float(i) * 19.);
            float crest = smoothstep((state.z > 1.5 ? .76 : .49) + fibres * .12 - (experimentAmount-.4)*.9, .995, heightRatio);
            float pigment = mix(.24, 1., smoothstep(.18, .83, fibres * .65 + tooth * .35));
            footprint = feather * front * ends * crest * pigment * smoothstep(0., .02, state.x);
          `}
          // Repeated passes build coverage without replacing the earlier
          // texture or making overlapping swaths into solid painted blocks.
          if (state.z < .5) deposits.x = 1. - (1. - deposits.x) * (1. - footprint);
          else if (state.z < 1.5) deposits.y = 1. - (1. - deposits.y) * (1. - footprint);
          else deposits.z = 1. - (1. - deposits.z) * (1. - footprint);
        }
      }`}
      tilePaintCoverage = max(max(deposits.x, deposits.y), deposits.z);
      vec3 pigment = applyTilePaint(tileBase, tileFirst, deposits.x * ${technique === "recess" ? ".92" : ".64"});
      pigment = applyTilePaint(pigment, tileSecond, deposits.y * .91);
      pigment = applyTilePaint(pigment, tileFinal, deposits.z * ${technique === "recess" ? ".65" : ".66"});
      if(mistake > .5) {
        ${technique === "recess" ? `pigment=applyTilePaint(pigment,tileFirst,.55*smoothstep(.12,.75,heightRatio));` : `pigment=applyTilePaint(pigment,tileFinal,.72*(1.-smoothstep(.2,.85,heightRatio)));`}
      }
      diffuseColor.rgb = pigment * (1. + (fleck - .5) * .022);
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", `
      float wet = wetAmount * exp(-dot(vTilePosition.xy-wetPoint,vTilePosition.xy-wetPoint)*45.) * tilePaintCoverage;
      float roughnessFactor = ${technique === "recess" ? "mix(.77,.48,wet)" : "mix(.77,.84,tilePaintCoverage)"};
    `);
  };
  reliefMaterial.customProgramCacheKey = () => `layer-relief-${technique}-${artwork ? "artwork" : "lesson"}-v5`;
  const relief = new THREE.Mesh(reliefGeometry, reliefMaterial);
  relief.name = "Five raised ridges and four recessed channels";
  relief.castShadow = true; relief.receiveShadow = true;
  group.add(relief);
  geometries.push(reliefGeometry); materials.push(reliefMaterial);

  const brush = createPaintingBrush(technique === "drybrush" ? "drybrush" : "round");
  brush.group.scale.setScalar(technique === "drybrush" ? .88 : .82);
  group.add(brush.group);
  const axisX = new THREE.Vector3();
  const axisZ = new THREE.Vector3();
  const rotation = new THREE.Matrix4();
  let disposed = false;

  function update(inputTime: number, experiment?: WorkshopExperiment) {
    if (disposed) return;
    uniforms.mistake.value = group.userData.before && group.userData.comparison === technique ? 1 : 0;
    const factors = experimentFactors(technique, experiment);
    uniforms.experimentAmount.value = factors.amount;
    const time = Math.max(0, Math.min(24, inputTime));
    const wetStroke=strokes.find(s=>time>=s.start&&time<=s.end)
      ?? strokes.findLast(s=>time>s.end&&time<=s.end+.7);
    uniforms.wetAmount.value=wetStroke&&!group.userData.comparison?1-ease((time-wetStroke.end)/.7):0;
    if(wetStroke){const p=tileStrokePoint(wetStroke,ease((time-wetStroke.start)/(wetStroke.end-wetStroke.start)),technique);uniforms.wetPoint.value.set(p.x,p.y);}
    strokes.forEach((stroke, i) => { states[i].x = time <= stroke.start ? 0 : ease((time - stroke.start) / (stroke.end - stroke.start)); });
    group.userData.paintState = states.slice(0, strokes.length).map(state => state.x.toFixed(4)).join(",");
    group.userData.contact = false;
    const pose = tileBrushPose(technique, time);
    brush.group.visible = pose.visible && !group.userData.comparison;
    if (!brush.group.visible) { group.userData.brushPoint = ""; return; }

    brush.group.position.copy(pose.point);
    axisX.crossVectors(pose.handle, new THREE.Vector3(0, 0, 1)).normalize();
    axisZ.crossVectors(axisX, pose.handle).normalize();
    rotation.makeBasis(axisX, pose.handle, axisZ);
    brush.group.quaternion.setFromRotationMatrix(rotation);
    brush.setContact(pose.pressure * factors.pressure, colors[pose.layer], technique === "drybrush" ? .15 : factors.load);
    group.userData.contact = pose.contact;
    group.userData.brushPoint = pose.point.toArray().map(value => value.toFixed(5)).join(",");
  }
  update(0);
  return {
    group,
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      brush.dispose();
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      group.clear();
    },
  };
}
