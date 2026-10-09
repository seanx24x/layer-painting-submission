import * as THREE from "three";
import { roundContactRadius } from "./brush-contact";

type ProfilePoint = readonly [radius: number, height: number];

export type PaintingBrush = {
  group: THREE.Group;
  setContact: (pressure: number, wetColor: THREE.Color, load?: number) => void;
  dispose: () => void;
};

const TUFT_HEIGHT = 0.33;
const TAU = Math.PI * 2;

function smoothstep(low: number, high: number, value: number) {
  const t = THREE.MathUtils.clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
}

function lathe(profile: readonly ProfilePoint[], segments = 48) {
  const curve = new THREE.CatmullRomCurve3(
    profile.map(([radius, height]) => new THREE.Vector3(radius, height, 0)),
    false,
    "centripetal",
  );
  return new THREE.LatheGeometry(
    curve.getPoints(profile.length * 5).map((point) => new THREE.Vector2(Math.max(0, point.x), point.y)),
    segments,
  );
}

function tuftRadius(t: number) {
  return 0.056 * Math.pow(Math.sin(Math.min(1, t * 1.08) * Math.PI * 0.5), 0.93);
}

/**
 * A round miniature brush in local +Y, with the contact centre fixed at (0, 0, 0).
 * Paint the object first, then place/orient this group at that same contact point.
 */
export function createPaintingBrush(kind: "round" | "drybrush" = "round"): PaintingBrush {
  const group = new THREE.Group();
  group.name = kind === "drybrush" ? "Soft domed drybrush" : "Miniature painting brush";
  const drybrush = kind === "drybrush";
  const radiusAt = (t: number) => drybrush
    ? .107 * Math.pow(Math.sin(Math.min(1, t * 1.08) * Math.PI * .5), .42)
    : tuftRadius(t);
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, name: string) {
    if (drybrush && !name.includes("tuft") && !name.includes("filaments")) {
      geometry.scale(1.8, 1, 1.8);
    }
    geometries.push(geometry);
    if (!materials.includes(material)) materials.push(material);
    const result = new THREE.Mesh(geometry, material);
    result.name = name;
    result.castShadow = true;
    result.receiveShadow = true;
    group.add(result);
    return result;
  }

  const lacquer = new THREE.MeshPhysicalMaterial({
    color: "#37342e",
    roughness: 0.3,
    metalness: 0,
    clearcoat: 0.85,
    clearcoatRoughness: 0.17,
  });
  mesh(lathe([
    [0.046, 0.62], [0.049, 0.69], [0.053, 0.81], [0.051, 0.98],
    [0.045, 1.20], [0.037, 1.42], [0.025, 1.64], [0.014, 1.77],
    [0.005, 1.815], [0, 1.83],
  ]), lacquer, "Tapered lacquer handle");

  const nickel = new THREE.MeshPhysicalMaterial({
    color: "#c5c9ca",
    metalness: 0.87,
    roughness: 0.23,
    clearcoat: 0.3,
    clearcoatRoughness: 0.22,
  });
  mesh(lathe([
    [0.055, 0.316], [0.058, 0.321], [0.060, 0.331], [0.058, 0.344],
    [0.057, 0.368], [0.055, 0.415], [0.052, 0.49], [0.049, 0.558],
    [0.050, 0.58], [0.051, 0.59], [0.048, 0.60], [0.048, 0.634],
    [0.047, 0.645],
  ]), nickel, "Rolled nickel ferrule");

  const groove = new THREE.MeshStandardMaterial({ color: "#62686b", metalness: 0.92, roughness: 0.34 });
  mesh(new THREE.CylinderGeometry(0.0505, 0.0505, 0.006, 48, 1, true).translate(0, 0.584, 0), groove, "Ferrule crimp");

  const brass = new THREE.MeshPhysicalMaterial({
    color: "#b89b68", roughness: 0.29, metalness: 0.93, clearcoat: 0.15,
  });
  mesh(lathe([
    [0.0482, 0.672], [0.0493, 0.675], [0.0495, 0.687], [0.0486, 0.69],
  ]), brass, "Brass maker band");

  const tuftMaterial = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: kind === "drybrush" ? .8 : .4,
    metalness: 0,
    clearcoat: kind === "drybrush" ? .03 : .32,
    clearcoatRoughness: 0.24,
  });
  const strandMaterial = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: kind === "drybrush" ? .8 : .35,
    clearcoat: kind === "drybrush" ? .03 : .36,
    clearcoatRoughness: 0.2,
  });

  const radialSegments = 40;
  const rows = 28;
  const positions: number[] = [];
  const indices: number[] = [];
  const baseColors: number[] = [];
  const coordinates: { t: number; angle: number; offset: THREE.Vector3; strand: number }[] = [];

  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    for (let column = 0; column <= radialSegments; column++) {
      const angle = column / radialSegments * TAU;
      positions.push(Math.cos(angle) * radiusAt(t), t * TUFT_HEIGHT, Math.sin(angle) * radiusAt(t));
      coordinates.push({ t, angle, offset: new THREE.Vector3(), strand: -1 });
      baseColors.push(1, 1, 1);
      if (row < rows && column < radialSegments) {
        const a = row * (radialSegments + 1) + column;
        const b = a + radialSegments + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  // Close the flattened tip so it remains a physical surface at full pressure.
  const tipCenter = positions.length / 3;
  positions.push(0, 0, 0);
  coordinates.push({ t: 0, angle: 0, offset: new THREE.Vector3(), strand: -2 });
  baseColors.push(1, 1, 1);
  for (let column = 0; column < radialSegments; column++) indices.push(tipCenter, column, column + 1);

  const tuftGeometry = new THREE.BufferGeometry();
  tuftGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  tuftGeometry.setAttribute("color", new THREE.Float32BufferAttribute(baseColors, 3).setUsage(THREE.DynamicDrawUsage));
  tuftGeometry.setIndex(indices);
  const tuft = mesh(tuftGeometry, tuftMaterial, "Flexible sable tuft");
  tuft.frustumCulled = false;

  // Small physical strands catch the studio light without transparent line artifacts.
  const strandPositions: number[] = [];
  const strandIndices: number[] = [];
  const strandColors: number[] = [];
  const strandCoordinates: typeof coordinates = [];
  const strands = 36;
  const lengthSegments = 20;
  const tubeSides = 5;
  for (let strand = 0; strand < strands; strand++) {
    const angle = strand / strands * TAU;
    const thickness = 0.0008 + (Math.sin(strand * 17.32) * 0.5 + 0.5) * 0.0007;
    const start = strandPositions.length / 3;
    for (let row = 0; row <= lengthSegments; row++) {
      // Stagger the ends just enough to avoid a machined, perfectly uniform bundle.
      const startT = 0.01 + (strand % 5) * 0.006;
      const t = startT + (1 - startT) * row / lengthSegments;
      for (let side = 0; side <= tubeSides; side++) {
        const around = side / tubeSides * TAU;
        const radius = thickness * (0.2 + smoothstep(0, 0.3, t) * 0.8);
        const offset = new THREE.Vector3(Math.cos(around) * radius, 0, Math.sin(around) * radius);
        strandCoordinates.push({ t, angle: angle + Math.sin(t * 5 + strand * 2) * 0.015, offset, strand });
        strandPositions.push(0, 0, 0);
        strandColors.push(1, 1, 1);
        if (row < lengthSegments && side < tubeSides) {
          const a = start + row * (tubeSides + 1) + side;
          const b = a + tubeSides + 1;
          strandIndices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }
  }
  const strandGeometry = new THREE.BufferGeometry();
  strandGeometry.setAttribute("position", new THREE.Float32BufferAttribute(strandPositions, 3).setUsage(THREE.DynamicDrawUsage));
  strandGeometry.setAttribute("color", new THREE.Float32BufferAttribute(strandColors, 3).setUsage(THREE.DynamicDrawUsage));
  strandGeometry.setIndex(strandIndices);
  const strandMesh = mesh(strandGeometry, strandMaterial, "Individual bristle filaments");
  strandMesh.frustumCulled = false;

  const dryRoot = new THREE.Color(drybrush ? "#c1a17c" : "#856748");
  const dryPoint = new THREE.Color(drybrush ? "#aa9276" : "#443b30");
  const color = new THREE.Color();
  const wet = new THREE.Color();
  const previousColor = new THREE.Color(-1, -1, -1);
  let previousPressure = -1;
  let previousLoad = -1;

  function updateBristles(geometry: THREE.BufferGeometry, points: typeof coordinates, pressure: number, paint: THREE.Color, load: number) {
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    const colors = geometry.getAttribute("color") as THREE.BufferAttribute;
    const recolor = !previousColor.equals(paint) || Math.abs(load - previousLoad) >= .005;
    const reshape = Math.abs(pressure - previousPressure) >= .004;
    for (let i = 0; i < points.length; i++) {
      const { t, angle, offset, strand } = points[i];
      if (reshape) {
      const tipInfluence = Math.pow(1 - t, 2.7);
      const radius = radiusAt(t);
      // Widen only the hairs at contact; the ferrule and round handle stay slim.
      const spread = (drybrush ? pressure * .16 : roundContactRadius(pressure)) * tipInfluence;
      const bend = pressure * .014 * Math.sin(t * Math.PI);
      const tipWidth = radius + spread;
      const depth = radius * (1 - pressure * 0.32 * (1 - t)) + pressure * 0.02 * tipInfluence;
      const filamentLift = strand >= 0 ? 0.00055 : 0;
      const x = strand === -2 ? 0 : Math.cos(angle) * (tipWidth + filamentLift) + bend + offset.x;
      const z = strand === -2 ? 0 : Math.sin(angle) * (depth + filamentLift) + offset.z;
      const y = strand === -2 ? 0 : t * TUFT_HEIGHT - pressure * 0.023 * Math.sin(t * Math.PI) + offset.y;
      position.setXYZ(i, x, y, z);
      }

      if (recolor) {
      const naturalVariation = 0.91 + Math.sin(angle * 19 + t * 3) * 0.055;
      color.copy(dryPoint).lerp(dryRoot, smoothstep(0.07, 0.9, t)).multiplyScalar(naturalVariation);
      const pigmentCoverage = 1 - smoothstep(drybrush ? .04 : .08 + .14 * load, drybrush ? .25 : .24 + .40 * load, t);
      wet.copy(paint).multiplyScalar(strand >= 0 ? 1.055 : 0.97);
      color.lerp(wet, pigmentCoverage);
      colors.setXYZ(i, color.r, color.g, color.b);
      }
    }
    if (reshape) { position.needsUpdate = true; geometry.computeVertexNormals(); }
    if (recolor) colors.needsUpdate = true;
  }

  function setContact(pressure: number, wetColor: THREE.Color, load = 1) {
    const next = THREE.MathUtils.clamp(pressure, 0, 1);
    if (Math.abs(next - previousPressure) < 0.004 && previousColor.equals(wetColor) && Math.abs(load - previousLoad) < .005) return;
    updateBristles(tuftGeometry, coordinates, next, wetColor, load);
    updateBristles(strandGeometry, strandCoordinates, next, wetColor, load);
    previousPressure = next;
    previousLoad = load;
    previousColor.copy(wetColor);
  }

  setContact(0, new THREE.Color("#45669b"));

  return {
    group,
    setContact,
    dispose() {
      group.removeFromParent();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      group.clear();
    },
  };
}
