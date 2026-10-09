#!/usr/bin/env node
/**
 * Bake reviewed material regions onto the normalized sculpt.
 * node scripts/models/segment-space-marine.mjs input.glb seeds.json output.glb
 *
 * Seed format: { seeds: [{ label, point: [x,y,z] }], options?: {...} }
 * A seed may use faceIndex instead of point (indices refer to input triangles).
 * Optional label settings:
 * { labels: { trim: { radius: 0.12, distanceScale: 1.35 },
 *             weapon: { min: [x,y,z], max: [x,y,z] } } }
 * Radius caps a seed's Euclidean reach in model units (2.7 total model height).
 * Set radius per seed to override the label default. distanceScale > 1 narrows
 * that label's region in competition with other labels. Both are opt-in.
 * polygons: [{ angle: 0|1|2|3, label, points: [[screenX,screenY], ...] }]
 * Polygons use the 900px inspector at screen origin [20,55]. Only visible
 * face centroids are assigned. Later polygons from the same view override
 * earlier ones; cross-view edits require a more directly facing surface.
 * options.minIslandFaces defaults to 12; set 0 to disable two-pass cleanup.
 * options.protectedIslandLabels adds exceptions; lenses are always protected.
 * COLOR_0 contains diagnostic curvature weights: red=convex, green=concave,
 * blue=0. These are not paint colors; materials leave vertexColors disabled.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

const [inputPath, seedsPath, outputPath] = process.argv.slice(2);
if (!inputPath || !seedsPath || !outputPath) throw new Error("Usage: node scripts/models/segment-space-marine.mjs input.glb seeds.json output.glb");
if (path.resolve(inputPath) === path.resolve(outputPath)) throw new Error("Use a separate output file; the neutral input must be retained.");
const source = await readFile(inputPath);
const seedBytes = await readFile(seedsPath);
const config = JSON.parse(seedBytes.toString("utf8"));
const options = { creasePenalty: 28, distancePower: 2, baseCeiling: 0.26, curvatureScale: 0.05, ...config.options };
const palette = { armour: "#2f539a", trim: "#b39755", weapon: "#272d35", metal: "#85909a", rubber: "#22272c", leather: "#5b392b", parchment: "#c9b991", wax: "#923840", lenses: "#df6b4c", base: "#3c4145", stone: "#88867d", unassigned: "#ec48e4" };
const labels = Object.keys(palette);
const labelIds = new Map(labels.map((name, index) => [name, index]));
if (!Array.isArray(config.seeds) || config.seeds.length === 0) throw new Error("Seed list is empty.");
for (const seed of config.seeds) if (!labelIds.has(seed.label) || seed.label === "unassigned") throw new Error(`Unknown material label: ${seed.label}`);

globalThis.FileReader ??= class FileReader {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.(); }); }
};
const { scene } = await new GLTFLoader().parseAsync(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength), "");
const sourceMeshes = [];
scene.traverse((object) => { if (object.isMesh) sourceMeshes.push(object); });
if (sourceMeshes.length !== 1) throw new Error("This seed map expects the single normalized Space Marine mesh.");
const mesh = sourceMeshes[0];
const geometry = mesh.geometry;
const positions = geometry.getAttribute("position");
const index = geometry.index?.array ?? Uint32Array.from({ length: positions.count }, (_, i) => i);
const faceCount = index.length / 3;

// Geometric topology ignores normal splits. Labels are propagated across faces,
// so crossing a crease is charged even where adjacent faces share a vertex.
const vertexMap = new Uint32Array(positions.count);
const coordinateMap = new Map();
const vertices = [];
for (let i = 0; i < positions.count; i++) {
  const point = [positions.getX(i), positions.getY(i), positions.getZ(i)];
  const key = point.map((value) => Math.round(value * 1e5)).join(",");
  let id = coordinateMap.get(key);
  if (id === undefined) { id = vertices.length; coordinateMap.set(key, id); vertices.push(point); }
  vertexMap[i] = id;
}
const faces = [];
const edgeMap = new Map();
const adjacency = Array.from({ length: faceCount }, () => []);
const vertexNormals = Array.from({ length: vertices.length }, () => [0, 0, 0]);
const vertexNeighbors = Array.from({ length: vertices.length }, () => new Set());
const vertexArea = new Float64Array(vertices.length);
const laplacian = Array.from({ length: vertices.length }, () => [0, 0, 0]);
for (let f = 0; f < faceCount; f++) {
  const ids = [vertexMap[index[f * 3]], vertexMap[index[f * 3 + 1]], vertexMap[index[f * 3 + 2]]];
  const points = ids.map((id) => vertices[id]);
  const u = points[1].map((v, axis) => v - points[0][axis]);
  const v = points[2].map((n, axis) => n - points[0][axis]);
  const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const doubleArea = Math.hypot(...cross);
  const normal = cross.map((n) => n / (doubleArea || 1));
  const center = points[0].map((_, axis) => (points[0][axis] + points[1][axis] + points[2][axis]) / 3);
  faces.push({ ids, normal, center });
  for (const id of ids) {
    vertexArea[id] += doubleArea / 6;
    for (let axis = 0; axis < 3; axis++) vertexNormals[id][axis] += cross[axis];
  }
  for (let side = 0; side < 3; side++) {
    const a = ids[side], b = ids[(side + 1) % 3], opposite = points[(side + 2) % 3];
    vertexNeighbors[a].add(b); vertexNeighbors[b].add(a);
    const edgeKey = a < b ? `${a},${b}` : `${b},${a}`;
    const earlier = edgeMap.get(edgeKey);
    if (earlier !== undefined) { adjacency[f].push(earlier); adjacency[earlier].push(f); }
    else edgeMap.set(edgeKey, f);
    const va = vertices[a].map((n, axis) => n - opposite[axis]);
    const vb = vertices[b].map((n, axis) => n - opposite[axis]);
    const cotangent = Math.max(-5, Math.min(5, va.reduce((sum, n, axis) => sum + n * vb[axis], 0) / (doubleArea || 1)));
    for (let axis = 0; axis < 3; axis++) {
      const delta = cotangent * (vertices[b][axis] - vertices[a][axis]);
      laplacian[a][axis] += delta; laplacian[b][axis] -= delta;
    }
  }
}
const costs = adjacency.map((neighbors, f) => neighbors.map((other) => {
  const a = faces[f], b = faces[other];
  const distance = Math.hypot(...a.center.map((n, axis) => n - b.center[axis]));
  const dot = Math.max(-1, Math.min(1, a.normal.reduce((sum, n, axis) => sum + n * b.normal[axis], 0)));
  const bend = Math.acos(dot) / (Math.PI / 2);
  return Math.max(distance, 1e-7) * (1 + options.creasePenalty * bend ** options.distancePower);
}));

const reachByLabel = new Map();
for (const seed of config.seeds) {
  const radius = seed.radius ?? config.labels?.[seed.label]?.radius ?? Infinity;
  if (!(radius > 0)) throw new Error("Seed radius must be positive.");
  const point = seed.point ?? faces[seed.faceIndex]?.center;
  if (!Array.isArray(point) || point.length !== 3 || point.some((n) => !Number.isFinite(n))) throw new Error("Each seed needs a finite point [x,y,z] or valid faceIndex.");
  if (!reachByLabel.has(seed.label)) reachByLabel.set(seed.label, []);
  reachByLabel.get(seed.label).push({ point, radiusSquared: radius ** 2 });
}

function allowed(label, point) {
  if (label === "base" && point[1] > options.baseCeiling) return false;
  const bounds = config.labels?.[label];
  if (bounds && !point.every((n, axis) => (bounds.min?.[axis] === undefined || n >= bounds.min[axis]) && (bounds.max?.[axis] === undefined || n <= bounds.max[axis]))) return false;
  return reachByLabel.get(label).some((reach) => reach.radiusSquared === Infinity || point.reduce((sum, n, axis) => sum + (n - reach.point[axis]) ** 2, 0) <= reach.radiusSquared);
}
const seedReport = [];
const byLabel = new Map();
for (const seed of config.seeds) {
  let closest = seed.faceIndex;
  let squaredDistance = 0;
  if (closest === undefined) {
    if (!Array.isArray(seed.point) || seed.point.length !== 3 || seed.point.some((n) => !Number.isFinite(n))) throw new Error("Each seed needs a finite point [x,y,z] or faceIndex.");
    squaredDistance = Infinity;
    for (let f = 0; f < faceCount; f++) {
      if (!allowed(seed.label, faces[f].center)) continue;
      const distance = faces[f].center.reduce((sum, n, axis) => sum + (n - seed.point[axis]) ** 2, 0);
      if (distance < squaredDistance) { closest = f; squaredDistance = distance; }
    }
  }
  if (!Number.isInteger(closest) || closest < 0 || closest >= faceCount || !allowed(seed.label, faces[closest].center)) throw new Error(`Seed is outside allowed surface: ${JSON.stringify(seed)}`);
  if (!byLabel.has(seed.label)) byLabel.set(seed.label, []);
  byLabel.get(seed.label).push(closest);
  seedReport.push({ ...seed, snappedFace: closest, snappedCenter: faces[closest].center, snapDistance: Math.sqrt(squaredDistance) });
}

class Heap {
  values = [];
  push(node) { const a = this.values; a.push(node); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= node[0]) break; a[i] = a[p]; i = p; } a[i] = node; }
  pop() { const a = this.values; const top = a[0], last = a.pop(); if (a.length) { let i = 0; while (i * 2 + 1 < a.length) { let c = i * 2 + 1; if (c + 1 < a.length && a[c + 1][0] < a[c][0]) c++; if (a[c][0] >= last[0]) break; a[i] = a[c]; i = c; } a[i] = last; } return top; }
  get length() { return this.values.length; }
}

const winners = new Int16Array(faceCount).fill(labelIds.get("unassigned"));
const bestDistances = new Float64Array(faceCount).fill(Infinity);
for (const [label, seedFaces] of byLabel) {
  const distanceScale = config.labels?.[label]?.distanceScale ?? 1;
  if (!Number.isFinite(distanceScale) || distanceScale <= 0) throw new Error("Label distanceScale must be positive and finite.");
  const distances = new Float64Array(faceCount).fill(Infinity);
  const heap = new Heap();
  for (const face of seedFaces) { distances[face] = 0; heap.push([0, face]); }
  while (heap.length) {
    const [distance, face] = heap.pop();
    if (distance !== distances[face]) continue;
    for (let n = 0; n < adjacency[face].length; n++) {
      const neighbor = adjacency[face][n];
      if (!allowed(label, faces[neighbor].center)) continue;
      const next = distance + costs[face][n];
      if (next < distances[neighbor]) { distances[neighbor] = next; heap.push([next, neighbor]); }
    }
  }
  for (let face = 0; face < faceCount; face++) {
    const score = distances[face] * distanceScale;
    if (score < bestDistances[face]) { bestDistances[face] = score; winners[face] = labelIds.get(label); }
  }
}
// An explicit reviewed face assignment overrides the automatic proposal.
for (const [face, label] of Object.entries(config.faceLabels ?? {})) {
  if (!Number.isInteger(Number(face)) || Number(face) < 0 || Number(face) >= faceCount || !labelIds.has(label)) throw new Error("Invalid faceLabels entry.");
  winners[Number(face)] = labelIds.get(label);
}

const polygonReport = [];
const viewport = { x: 20, y: 55, width: 900, height: 900, left: -1.6, right: 1.6, top: 2.95, bottom: -0.25, ...(config.viewport ?? {}) };
const depthViews = new Map();
const projectedViews = new Map();
function projected(point, angle) {
  const theta = angle * Math.PI / 2;
  const u = point[0] * Math.cos(theta) - point[2] * Math.sin(theta);
  const depth = point[0] * Math.sin(theta) + point[2] * Math.cos(theta);
  return [(u - viewport.left) / (viewport.right - viewport.left) * viewport.width, (viewport.top - point[1]) / (viewport.top - viewport.bottom) * viewport.height, depth];
}
function makeDepthView(angle) {
  const depth = new Float32Array(viewport.width * viewport.height).fill(-Infinity);
  const faceIds = new Int32Array(depth.length).fill(-1);
  const planes = new Float64Array(faceCount * 3);
  const projection = vertices.map((point) => projected(point, angle));
  for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
    const face = faces[faceIndex];
    const [a, b, c] = face.ids.map((id) => projection[id]);
    const denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(denominator) < 1e-8) continue;
    const dzdx = ((b[1] - c[1]) * (a[2] - c[2]) + (c[1] - a[1]) * (b[2] - c[2])) / denominator;
    const dzdy = ((c[0] - b[0]) * (a[2] - c[2]) + (a[0] - c[0]) * (b[2] - c[2])) / denominator;
    planes[faceIndex * 3] = dzdx;
    planes[faceIndex * 3 + 1] = dzdy;
    planes[faceIndex * 3 + 2] = c[2] - dzdx * c[0] - dzdy * c[1];
    const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
    const maxX = Math.min(viewport.width - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
    const maxY = Math.min(viewport.height - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const u = ((b[1] - c[1]) * (x + 0.5 - c[0]) + (c[0] - b[0]) * (y + 0.5 - c[1])) / denominator;
      const v = ((c[1] - a[1]) * (x + 0.5 - c[0]) + (a[0] - c[0]) * (y + 0.5 - c[1])) / denominator;
      const w = 1 - u - v;
      if (u < 0 || v < 0 || w < 0) continue;
      const z = u * a[2] + v * b[2] + w * c[2];
      const at = y * viewport.width + x;
      if (z > depth[at]) { depth[at] = z; faceIds[at] = faceIndex; }
    }
  }
  const visibleFaces = new Uint8Array(faceCount);
  for (const face of faceIds) if (face >= 0) visibleFaces[face] = 1;
  depthViews.set(angle, { depth, visibleFaces, planes });
  projectedViews.set(angle, faces.map((face) => projected(face.center, angle)));
}
function insidePolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
const polygonOwner = new Int8Array(faceCount).fill(-1);
const polygonFacing = new Float32Array(faceCount).fill(-1);
for (const polygon of config.polygons ?? []) {
  if (!Number.isInteger(polygon.angle) || polygon.angle < 0 || polygon.angle > 3 || !labelIds.has(polygon.label) || !Array.isArray(polygon.points) || polygon.points.length < 3 || polygon.points.some((point) => !Array.isArray(point) || point.length !== 2 || point.some((n) => !Number.isFinite(n)))) throw new Error(`Invalid polygon: ${JSON.stringify(polygon)}`);
  if (!depthViews.has(polygon.angle)) makeDepthView(polygon.angle);
  const { depth, visibleFaces, planes } = depthViews.get(polygon.angle);
  const projection = projectedViews.get(polygon.angle);
  const minX = Math.min(...polygon.points.map((p) => p[0])) - viewport.x;
  const maxX = Math.max(...polygon.points.map((p) => p[0])) - viewport.x;
  const minY = Math.min(...polygon.points.map((p) => p[1])) - viewport.y;
  const maxY = Math.max(...polygon.points.map((p) => p[1])) - viewport.y;
  const tolerance = polygon.depthTolerance ?? options.visibilityTolerance ?? 0.01;
  let assigned = 0;
  let blockedByStrongerView = 0;
  let backFacing = 0;
  let occluded = 0;
  const theta = polygon.angle * Math.PI / 2;
  for (let face = 0; face < faceCount; face++) {
    const [x, y] = projection[face];
    if (x < minX || x > maxX || y < minY || y > maxY || x < 0 || y < 0 || x >= viewport.width || y >= viewport.height) continue;
    if (!insidePolygon(x + viewport.x, y + viewport.y, polygon.points)) continue;
    const normal = faces[face].normal;
    const facing = normal[0] * Math.sin(theta) + normal[2] * Math.cos(theta);
    if (facing <= (options.minimumPolygonFacing ?? 0.0001)) { backFacing++; continue; }
    // A visible face ID is definitive. A subpixel face may win no full pixel;
    // compare its plane depth at the SAME pixel center used by the z-buffer.
    // Comparing centroid depth to pixel-center depth creates false holes on
    // steep surfaces even when both samples belong to the very same triangle.
    if (!visibleFaces[face]) {
      const pixelX = Math.floor(x), pixelY = Math.floor(y);
      const closest = depth[pixelY * viewport.width + pixelX];
      const faceDepth = planes[face * 3] * (pixelX + 0.5) + planes[face * 3 + 1] * (pixelY + 0.5) + planes[face * 3 + 2];
      if (!Number.isFinite(closest) || faceDepth < closest - tolerance) { occluded++; continue; }
    }
    if (!polygon.force && polygonOwner[face] !== -1 && polygonOwner[face] !== polygon.angle && facing <= polygonFacing[face] + 1e-6) { blockedByStrongerView++; continue; }
    winners[face] = labelIds.get(polygon.label);
    polygonOwner[face] = polygon.angle;
    polygonFacing[face] = facing;
    assigned++;
  }
  polygonReport.push({ angle: polygon.angle, label: polygon.label, facesAssigned: assigned, blockedByStrongerView, backFacing, occluded, depthTolerance: tolerance });
}

// Remove isolated assignment specks, not geometric triangles. Each pass reads
// a fixed label snapshot so traversal order cannot cascade through a region.
// Lenses are intentionally tiny and must never be removed by this heuristic.
const minIslandFaces = options.minIslandFaces ?? 12;
if (!Number.isInteger(minIslandFaces) || minIslandFaces < 0) throw new Error("minIslandFaces must be a nonnegative integer.");
const protectedIslandLabels = new Set(["lenses", ...(options.protectedIslandLabels ?? [])]);
const islandCleanup = { minIslandFaces, protectedLabels: [...protectedIslandLabels], passes: [] };
if (minIslandFaces > 0) for (let pass = 0; pass < 2; pass++) {
  const snapshot = winners.slice();
  const visited = new Uint8Array(faceCount);
  const changes = [];
  for (let start = 0; start < faceCount; start++) {
    if (visited[start]) continue;
    const current = snapshot[start];
    const component = [start];
    const boundary = new Map();
    visited[start] = 1;
    for (let at = 0; at < component.length; at++) {
      for (const neighbor of adjacency[component[at]]) {
        const neighborLabel = snapshot[neighbor];
        if (neighborLabel === current) {
          if (!visited[neighbor]) { visited[neighbor] = 1; component.push(neighbor); }
        } else boundary.set(neighborLabel, (boundary.get(neighborLabel) ?? 0) + 1);
      }
    }
    if (component.length >= minIslandFaces || protectedIslandLabels.has(labels[current]) || boundary.size === 0) continue;
    const candidates = [...boundary.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const replacement = candidates[0][0];
    for (const face of component) winners[face] = replacement;
    changes.push({ from: labels[current], to: labels[replacement], faces: component.length, sharedBoundaryEdges: candidates[0][1] });
  }
  islandCleanup.passes.push({ pass: pass + 1, componentsChanged: changes.length, facesChanged: changes.reduce((sum, change) => sum + change.faces, 0), changes });
  if (changes.length === 0) break;
}

const curvature = new Float32Array(vertices.length);
for (let i = 0; i < vertices.length; i++) {
  const normalLength = Math.hypot(...vertexNormals[i]) || 1;
  const dot = laplacian[i].reduce((sum, n, axis) => sum + n * vertexNormals[i][axis] / normalLength, 0);
  curvature[i] = Math.max(-1, Math.min(1, -dot / Math.max(4 * vertexArea[i], 1e-8) * options.curvatureScale));
}
const smoothCurvature = new Float32Array(curvature.length);
for (let i = 0; i < curvature.length; i++) {
  let sum = curvature[i] * 2;
  for (const other of vertexNeighbors[i]) sum += curvature[other];
  smoothCurvature[i] = sum / (vertexNeighbors[i].size + 2);
}
const colors = new Float32Array(positions.count * 3);
for (let i = 0; i < positions.count; i++) {
  const c = smoothCurvature[vertexMap[i]];
  colors[i * 3] = Math.max(0, c);
  colors[i * 3 + 1] = Math.max(0, -c);
}
geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
geometry.clearGroups();
const faceLists = labels.map(() => []);
for (let f = 0; f < faceCount; f++) faceLists[winners[f]].push(f);
const sortedIndex = new Uint32Array(index.length);
const originalFaceOrder = new Uint32Array(faceCount);
const materials = [];
let cursor = 0;
for (let label = 0; label < labels.length; label++) {
  if (!faceLists[label].length) continue;
  const material = new THREE.MeshStandardMaterial({ color: palette[labels[label]], roughness: labels[label] === "metal" || labels[label] === "trim" ? 0.48 : 0.76, metalness: labels[label] === "metal" || labels[label] === "trim" ? 0.48 : 0 });
  material.name = labels[label];
  const start = cursor;
  for (const face of faceLists[label]) { originalFaceOrder[cursor / 3] = face; sortedIndex[cursor++] = index[face * 3]; sortedIndex[cursor++] = index[face * 3 + 1]; sortedIndex[cursor++] = index[face * 3 + 2]; }
  geometry.addGroup(start, cursor - start, materials.length); materials.push(material);
}
geometry.setIndex(new THREE.BufferAttribute(sortedIndex, 1));
mesh.material = materials;
mesh.name = "Primaris Space Marine - authored material regions";
mesh.userData = { ...mesh.userData, segmentation: "Seeded curvature-weighted surface distances, requiring visual review", curvatureChannels: { r: "convexity weight", g: "concavity weight", b: "unused" } };
const output = Buffer.from(await new GLTFExporter().parseAsync(scene, { binary: true, copyright: "DicamoCM. CC BY 4.0. https://www.nexprint.com/en/models/G6817715. Modified for Layer: simplified geometry and authored material regions." }));
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, output);
const report = { sourceFile: path.basename(inputPath), sourceSha256: createHash("sha256").update(source).digest("hex"), seedsSha256: createHash("sha256").update(seedBytes).digest("hex"), outputFile: path.basename(outputPath), outputBytes: output.length, outputSha256: createHash("sha256").update(output).digest("hex"), options, labelSettings: config.labels ?? {}, triangleCount: faceCount, vertexCount: positions.count, weldedVertices: vertices.length, labels: Object.fromEntries(labels.map((name, i) => [name, faceLists[i].length])), seedReport, polygonReport, islandCleanup, viewport, curvatureChannels: { r: "convexity", g: "concavity", b: "unused" }, limitations: ["This is a deterministic material-region proposal from hand-authored seeds and visible-surface polygons, not semantic recognition.", "Review all sides, thin trim, intersecting hands/weapon, insignia, and undercuts before publishing.", "Curvature is an illustrative geometry weight, not physical paint or ambient occlusion.", "Input triangle indices are preserved in the face-order sidecar; output groups reorder triangles."] };
await writeFile(outputPath.replace(/\.glb$/i, "") + ".segmentation.json", JSON.stringify(report, null, 2) + "\n");
await writeFile(outputPath.replace(/\.glb$/i, "") + ".face-order.bin", Buffer.from(originalFaceOrder.buffer));
console.log(JSON.stringify({ outputPath, outputBytes: output.length, labels: report.labels, maximumSnapDistance: Math.max(...seedReport.map((seed) => seed.snapDistance)) }, null, 2));
