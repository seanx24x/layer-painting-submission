#!/usr/bin/env node
/** Source-specific, lossless pauldron preparation. No simplification, welding or position changes. */
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

const SOURCE_HASH = 'a49fd57c0b1f9a5359f29f6ea73148c8f45c50799f42a7f91286c27a95085278';
const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/models/prepare-pauldron.mjs "/path/to/ Pauldron 1.stl"');
const directory = fileURLToPath(new URL('../../docs/pauldron-assets/', import.meta.url));
const bytes = await readFile(source);
const sha256 = createHash('sha256').update(bytes).digest('hex');
if (sha256 !== SOURCE_HASH) throw new Error('This reviewed region map is bound to one source mesh. A different file needs a new review.');
const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const geometry = new STLLoader().parse(data);
const positions = geometry.attributes.position.array;
const sourceNormals = geometry.attributes.normal.array;
const count = positions.length / 9;
let mismatches = 0;
for (let f = 0; f < count; f++) for (let j = 0; j < 9; j++) if (!Object.is(positions[f * 9 + j], bytes.readFloatLE(84 + f * 50 + 12 + j * 4))) mismatches++;
if (mismatches) throw new Error(`${mismatches} imported positions differ from source`);
geometry.computeBoundingBox();
const center = geometry.boundingBox.getCenter(new THREE.Vector3());
const front = new THREE.Vector3(.99, .058, .129).normalize();
const up = new THREE.Vector3(-.14, .547, .825).addScaledVector(front, -new THREE.Vector3(-.14, .547, .825).dot(front)).normalize();
const right = new THREE.Vector3().crossVectors(up, front).normalize();
const basis = [right, up, front];
const v = (f, corner) => new THREE.Vector3().fromArray(positions, f * 9 + corner * 3);
const display = p => basis.map(axis => p.clone().sub(center).dot(axis));
const centroids = [], normals = [], invalidNormalFaces = [], areas = [];
const exactVertices = new Map(), vertexFaces = [], faceVertices = [], adjacency = Array.from({ length: count }, () => []), edgeFaces = new Map();
for (let f = 0; f < count; f++) {
  const p = [v(f, 0), v(f, 1), v(f, 2)];
  centroids.push(p[0].clone().add(p[1]).add(p[2]).multiplyScalar(1 / 3));
  const cross = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0]));
  areas.push(cross.length());
  const normal = new THREE.Vector3().fromArray(sourceNormals, f * 9);
  if (![normal.x, normal.y, normal.z].every(Number.isFinite)) { invalidNormalFaces.push(f); normal.set(1, 0, 0); }
  normals.push(normal);
  const ids = p.map(point => {
    const key = point.toArray().join(',');
    if (!exactVertices.has(key)) { exactVertices.set(key, vertexFaces.length); vertexFaces.push([]); }
    const id = exactVertices.get(key); vertexFaces[id].push(f); return id;
  });
  faceVertices.push(ids);
  for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
    const key = ids[a] < ids[b] ? `${ids[a]}:${ids[b]}` : `${ids[b]}:${ids[a]}`;
    if (edgeFaces.has(key)) { const other = edgeFaces.get(key); adjacency[f].push(other); adjacency[other].push(f); }
    else edgeFaces.set(key, f);
  }
}
function patches(threshold) {
  const assignment = new Int32Array(count).fill(-1), groups = [];
  for (let f = 0; f < count; f++) {
    if (assignment[f] >= 0) continue;
    const id = groups.length, stack = [f], group = []; assignment[f] = id;
    while (stack.length) {
      const face = stack.pop(); group.push(face);
      for (const other of adjacency[face]) if (assignment[other] < 0 && normals[face].dot(normals[other]) > threshold) { assignment[other] = id; stack.push(other); }
    }
    groups.push(group);
  }
  return { assignment, groups };
}
const fine = patches(.985), coarse = patches(.8);
const regions = new Int8Array(count).fill(-1);
const local = centroids.map(display);
const seedPatch = (seedFace, region) => { for (const f of fine.groups[fine.assignment[seedFace]]) regions[f] = region; };
// Authored seed faces identify the source's actual plane/crease patches. Their coordinates are not changed.
for (let f = 0; f < count; f++) if (local[f][2] < -2.62) regions[f] = 6;
for (const seed of [1583, 905, 1598]) seedPatch(seed, 5); // concave cup and its inner ledge
for (const seed of [12, 3, 572, 15514, 44608, 14024]) seedPatch(seed, 2); // band, upper lip and underside
for (const seed of [66061, 4878, 66005, 65995, 68534]) seedPatch(seed, 1); // rim plateau, bevel and end faces
for (const f of fine.groups[fine.assignment[651]]) {
  const depth = local[f][2], facing = normals[f].dot(front);
  if (depth > -1.65 || facing < .55) regions[f] = 0;
  if (depth < -1.65 && facing > .88) regions[f] = 1;
}
for (const f of coarse.groups[coarse.assignment[70877]]) regions[f] = 4;
for (const seed of [83099, 83441, 83793, 84105, 84437, 84780, 85092]) for (const f of coarse.groups[coarse.assignment[seed]]) regions[f] = 3;
// Multi-source shortest paths fill tiny bevels/noisy triangles. Surface adjacency and crease cost prevent straight-space leakage.
const heap = [];
function push(item) { heap.push(item); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= item[0]) break; heap[i] = heap[p]; i = p; } heap[i] = item; }
function pop() { const result = heap[0], last = heap.pop(); if (heap.length) { let i = 0; while (i * 2 + 1 < heap.length) { let c = i * 2 + 1; if (c + 1 < heap.length && heap[c + 1][0] < heap[c][0]) c++; if (last[0] <= heap[c][0]) break; heap[i] = heap[c]; i = c; } heap[i] = last; } return result; }
const distance = new Float64Array(count).fill(Infinity);
for (let f = 0; f < count; f++) if (regions[f] >= 0) { distance[f] = 0; push([0, f]); }
while (heap.length) {
  const [d, f] = pop(); if (d !== distance[f]) continue;
  for (const other of adjacency[f]) {
    const next = d + centroids[f].distanceTo(centroids[other]) * (1 + 15 * (1 - normals[f].dot(normals[other])));
    if (next < distance[other]) { distance[other] = next; regions[other] = regions[f]; push([next, other]); }
  }
}
if (regions.some(region => region < 0)) throw new Error('Unassigned source faces');
// Area-weighted crease-aware per-corner display normals only. Facet normals remain available in original STL.
const smooth = new Float32Array(positions.length), smoothingCosine = Math.cos(45 * Math.PI / 180);
for (let f = 0; f < count; f++) for (let corner = 0; corner < 3; corner++) {
  const normal = new THREE.Vector3();
  for (const neighbor of vertexFaces[faceVertices[f][corner]]) if (normals[f].dot(normals[neighbor]) > smoothingCosine) normal.addScaledVector(normals[neighbor], areas[neighbor]);
  if (!normal.lengthSq()) normal.copy(normals[f]);
  normal.normalize().toArray(smooth, f * 9 + corner * 3);
}
geometry.setAttribute('normal', new THREE.BufferAttribute(smooth, 3));
const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
mesh.updateMatrixWorld();
const raycaster = new THREE.Raycaster();
const raw = (x, y, z) => center.clone().addScaledVector(right, x).addScaledVector(up, y).addScaledVector(front, z);
function anchored(face, bary = [1 / 3, 1 / 3, 1 / 3]) {
  const position = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let i = 0; i < 3; i++) { position.addScaledVector(v(face, i), bary[i]); normal.addScaledVector(new THREE.Vector3().fromArray(smooth, face * 9 + i * 3), bary[i]); }
  return { face, bary, position: position.toArray(), normal: normal.normalize().toArray() };
}
function hit(x, y, region, allowMiss = false) {
  raycaster.set(raw(x, y, 20), front.clone().negate());
  const found = raycaster.intersectObject(mesh).find(item => regions[item.faceIndex] === region);
  if (!found) { if (allowMiss) return null; throw new Error(`No surface hit for ${x},${y}, region ${region}`); }
  const bary = new THREE.Triangle(v(found.faceIndex, 0), v(found.faceIndex, 1), v(found.faceIndex, 2)).getBarycoord(found.point, new THREE.Vector3()).toArray();
  return anchored(found.faceIndex, bary);
}
// Keep triangle labels for inspection; fit continuous visible boundaries to source edge anchors.
const boundaryAnchors = { rim: [], band: [] };
for (let f = 0; f < count; f++) if (regions[f] === 0) for (const other of adjacency[f]) {
  if (regions[other] !== 1 && regions[other] !== 2) continue;
  const shared = faceVertices[f].map((id, corner) => faceVertices[other].includes(id) ? corner : -1).filter(corner => corner >= 0);
  if (shared.length !== 2) continue;
  const bary = [0, 0, 0]; for (const corner of shared) bary[corner] = .5;
  const point = anchored(f, bary), projected = display(new THREE.Vector3().fromArray(point.position));
  if (regions[other] === 2 || projected[1] > -2.05) boundaryAnchors[regions[other] === 1 ? 'rim' : 'band'].push({ ...point, projected });
}
function leastSquares(rows, values) {
  const size = rows[0].length, matrix = Array.from({ length: size }, (_, i) => Array.from({ length: size + 1 }, (_, j) => rows.reduce((sum, row, k) => sum + row[i] * (j === size ? values[k] : row[j]), 0)));
  for (let column = 0; column < size; column++) {
    let pivot = column; for (let i = column + 1; i < size; i++) if (Math.abs(matrix[i][column]) > Math.abs(matrix[pivot][column])) pivot = i;
    [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
    const divisor = matrix[column][column]; if (Math.abs(divisor) < 1e-12) throw new Error('Boundary profile fit is singular');
    for (let j = column; j <= size; j++) matrix[column][j] /= divisor;
    for (let i = 0; i < size; i++) if (i !== column) { const factor = matrix[i][column]; for (let j = column; j <= size; j++) matrix[i][j] -= factor * matrix[column][j]; }
  }
  return matrix.map(row => row[size]);
}
const centerX = .241, yOrigin = -1.247, yScale = 6.1;
const polynomial = (coefficients, x) => coefficients.reduceRight((value, coefficient) => value * x + coefficient, 0);
const radiusSquaredCoefficients = leastSquares(boundaryAnchors.rim.map(({ projected: p }) => { const u = (p[1] - yOrigin) / yScale; return [1, u, u * u, u ** 3, u ** 4]; }), boundaryAnchors.rim.map(({ projected: p }) => (p[0] - centerX) ** 2));
const bottomCoefficients = leastSquares(boundaryAnchors.band.map(({ projected: p }) => { const x = p[0] - centerX; return [1, x * x, x ** 4]; }), boundaryAnchors.band.map(({ projected: p }) => p[1]));
const radiusSquaredAt = y => polynomial(radiusSquaredCoefficients, (y - yOrigin) / yScale);
const bottomAt = x => polynomial(bottomCoefficients, (x - centerX) ** 2);
let topY = 4.8;
for (let i = 0; i < 12; i++) { const u = (topY - yOrigin) / yScale; const derivative = polynomial(radiusSquaredCoefficients.slice(1).map((c, j) => c * (j + 1)), u) / yScale; topY -= radiusSquaredAt(topY) / derivative; }
function errorSummary(errors) { const sorted = errors.map(Math.abs).sort((a, b) => a - b); return { median: sorted[Math.floor(sorted.length * .5)], p99: sorted[Math.floor(sorted.length * .99)], maximum: sorted.at(-1) }; }
const boundary = {
  version: 1, kind: 'authored-profile-v1', sourceSha256: sha256,
  coordinateSpace: 'displayBasis * (original STL position - center); source units unspecified',
  centerX, yOrigin, yScale, radiusSquaredCoefficients, bottomCoefficients, topY,
  candidateRegions: [0, 1, 2], frontDepthMinimum: -2.04, minimumFrontDepth: -2.04,
  interpretation: 'Positive plate distance is minimum of sideDistance, localY-bottomAt(localX), topY-localY. Apply to colour, metalness, roughness and paint clipping. Coarse region IDs stay unchanged for inspection.',
  sideDistance: '(radiusSquaredAt(y) - (x-centerX)^2) / length(vec2(2*(x-centerX), derivative(radiusSquaredAt,y)))',
  bottomAt: 'b0 + b1*(x-centerX)^2 + b2*(x-centerX)^4',
  antialias: 'Use screen-space fwidth of signed distance, not a fixed soft gradient.',
  fit: {
    method: 'Source shared-edge midpoint anchors; symmetric quartic width profile and even-quartic lower seam. Source-bound authored approximation, not an exact analytic reconstruction.',
    rimAnchorCount: boundaryAnchors.rim.length, bandAnchorCount: boundaryAnchors.band.length,
    rimProjectedDistanceError: errorSummary(boundaryAnchors.rim.map(({ projected: p }) => { const x = p[0] - centerX, u = (p[1] - yOrigin) / yScale; const derivative = polynomial(radiusSquaredCoefficients.slice(1).map((c, j) => c * (j + 1)), u) / yScale; return (radiusSquaredAt(p[1]) - x * x) / Math.hypot(2 * x, derivative); })),
    bandProjectedDistanceError: errorSummary(boundaryAnchors.band.map(({ projected: p }) => p[1] - bottomAt(p[0]))),
    review: 'Projection plot records source anchors and fit. Inspect front, oblique and macro renders before claiming final sculpt accuracy.',
  },
  diagnosticAnchorFaces: Object.fromEntries(Object.entries(boundaryAnchors).map(([name, anchors]) => [name, anchors.filter((_, i) => i % Math.ceil(anchors.length / 24) === 0).map(({ face, bary, projected }) => ({ face, bary, projected }))])),
};
const baseTimeline = { coat1: [.8, 8.8], drying: [8.8, 10.5], coat2: [10.5, 19.2], notice: 'Demonstration time is compressed. Let the first real coat dry fully before adding another.' };
const base = [];
for (let coat = 0; coat < 2; coat++) {
  const [start, end] = coat === 0 ? baseTimeline.coat1 : baseTimeline.coat2;
  const heights = [4.62, 3.82, 2.68, 1.3, -.15, -1.55].map(y => y + (coat ? .035 : 0));
  for (const [pass, y] of heights.entries()) {
    const halfWidth = Math.max(0, Math.sqrt(Math.max(0, radiusSquaredAt(y))) - .008);
    const points = Array.from({ length: 10 }, (_, j) => {
      const progress = coat ? 1 - j / 9 : j / 9;
      const x = centerX + halfWidth * Math.sin((progress - .5) * Math.PI);
      // The authored profile is smooth, while source triangles contain small seam deviations.
      // Retry only inward on the same visible outer plate; never substitute an inner or rear hit.
      for (let inset = 0; inset <= .12; inset += .004) {
        const point = hit(x - Math.sign(x - centerX) * inset, y, 0, true);
        if (point) return point;
      }
      throw new Error(`Base pass cannot anchor on the outer plate at ${x},${y}`);
    });
    const slot = (end - start) / heights.length;
    base.push({ id: `base-coat-${coat + 1}-pass-${pass + 1}`, region: 0, points, start: start + pass * slot, end: start + (pass + 1) * slot - .11, width: 1.25, opacity: .7 });
  }
}
// The junction is taken from shared edges of the reviewed plate/rim map, not projected through the object.
const junction = [];
for (let f = 0; f < count; f++) if (regions[f] === 0) for (const other of adjacency[f]) if (regions[other] === 1) {
  const shared = faceVertices[f].map((id, i) => faceVertices[other].includes(id) ? i : -1).filter(i => i >= 0);
  if (shared.length !== 2) continue;
  const bary = [0.04, 0.04, 0.04]; for (const i of shared) bary[i] = .48;
  const point = anchored(f, bary), p = display(new THREE.Vector3().fromArray(point.position));
  if (p[1] > -.1) junction.push({ point, angle: Math.atan2(p[0] - .241, p[1] + .1) });
}
function sampleArc(candidates, n = 32) {
  return Array.from({ length: n }, (_, i) => {
    const angle = -1.15 + i / (n - 1) * 2.3;
    return candidates.reduce((a, b) => Math.abs(a.angle - angle) < Math.abs(b.angle - angle) ? a : b).point;
  });
}
const recess = [{ id: 'recess-junction', region: 0, points: sampleArc(junction), start: 1.5, end: 18.5, width: .115, opacity: .9 }];
const edgeCandidates = fine.groups[fine.assignment[4878]].filter(f => regions[f] === 1 && local[f][1] > 0).map(f => ({
  point: anchored(f), angle: Math.atan2(local[f][0] - .241, local[f][1] + .1),
}));
const edge = [{ id: 'edge-rim', region: 1, points: sampleArc(edgeCandidates), start: 1.5, end: 18.5, width: .105, opacity: .94 }];
const strokes = { base, recess, edge };
for (const [technique, sequences] of Object.entries(strokes)) {
  const segments = sequences.reduce((sum, stroke) => sum + stroke.points.length - 1, 0);
  if (segments > 128) throw new Error(`${technique} exceeds segment budget`);
  for (const stroke of sequences) for (const point of stroke.points) if (regions[point.face] !== stroke.region || Math.abs(point.bary.reduce((a, b) => a + b, 0) - 1) > 1e-6) throw new Error('Invalid surface anchor');
}
const names = ['Outer plate', 'Raised rim', 'Lower band', 'Rivets', 'Skull', 'Inner cup', 'Rear surfaces'];
const manifest = {
  version: 1, sourceFile: 'source.stl', sourceSha256: sha256, byteLength: bytes.length,
  triangleCount: count, triangles: count, sourceBytes: bytes.length, vertexCount: positions.length / 3, uniqueVertexCount: exactVertices.size,
  coordinateUnits: 'unspecified', importedPositionMismatches: mismatches,
  bounds: { min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray() },
  center: center.toArray(), displayBasis: { right: right.toArray(), up: up.toArray(), front: front.toArray() },
  connectedComponents: patches(-2).groups.length,
  invalidNormalFaces, collapsedFaces: areas.flatMap((area, f) => area === 0 ? [f] : []),
  corrections: 'Positions and source bytes unchanged. Two non-finite collapsed-face normals replaced in display buffers only. Crease-aware normals are optional display shading.',
  regions: names.map((name, id) => ({ id, name, faces: regions.reduce((sum, region) => sum + (region === id ? 1 : 0), 0) })),
  boundary: { file: 'boundary.json', diagnostic: 'boundary-diagnostic.svg', ...boundary.fit },
  regionMap: { file: 'regions.bin', encoding: 'uint8 per source triangle', sourceSha256: sha256, method: 'Authored source-face crease seeds, inset plateau orientation, surface-adjacency propagation. Front, three-quarter and rear diagnostics reviewed.' },
  smoothNormals: { file: 'smooth-normals.bin', encoding: 'little-endian float32 xyz per source corner', creaseDegrees: 45 },
  animation: { file: 'strokes.json', baseTimeline, coordinateSpace: 'original STL positions', duration: 20, widthMeaning: 'brush footprint radius in source units', segmentCounts: Object.fromEntries(Object.entries(strokes).map(([key, sequences]) => [key, sequences.reduce((sum, stroke) => sum + stroke.points.length - 1, 0)])) },
  distribution: 'Local test asset only; no redistribution licence established.',
};
await mkdir(directory, { recursive: true });
await copyFile(source, `${directory}/source.stl`);
const projectSvg = p => [400 + (p[0] - centerX) * 62, 430 - p[1] * 62];
const profilePoints = [];
for (let i = 0; i <= 200; i++) { const y = -2.14 + (topY + 2.14) * i / 200; profilePoints.push([centerX - Math.sqrt(Math.max(0, radiusSquaredAt(y))), y]); }
for (let i = 200; i >= 0; i--) { const y = -2.14 + (topY + 2.14) * i / 200; profilePoints.push([centerX + Math.sqrt(Math.max(0, radiusSquaredAt(y))), y]); }
const diagnosticSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="650" viewBox="0 0 800 650"><rect width="800" height="650" fill="#f7f8fa"/><g font-family="sans-serif" fill="#20252e"><text x="32" y="35" font-size="20">Pauldron source seam / continuous boundary fit</text><text x="32" y="60" font-size="13">Orange: original shared-edge anchors. Blue: smooth authored profile.</text></g><path d="M${profilePoints.map(projectSvg).map(p => p.join(',')).join('L')}" fill="none" stroke="#315faf" stroke-width="2"/>${Object.values(boundaryAnchors).flat().map(({ projected }) => { const [x, y] = projectSvg(projected); return `<circle cx="${x}" cy="${y}" r="1.4" fill="#b47628" opacity=".65"/>`; }).join('')}<path d="M${Array.from({ length: 201 }, (_, i) => { const x = centerX - 4.42 + i / 200 * 8.84; return projectSvg([x, bottomAt(x)]).join(','); }).join('L')}" fill="none" stroke="#315faf" stroke-width="2"/><text x="32" y="620" font-family="sans-serif" font-size="12" fill="#4b5563">Geometric fit only. Review material boundaries on the sculpt in front, oblique and macro views.</text></svg>`;
await writeFile(`${directory}/boundary-diagnostic.svg`, diagnosticSvg);
await writeFile(`${directory}/boundary.json`, JSON.stringify(boundary, null, 2) + '\n');
await writeFile(`${directory}/regions.bin`, new Uint8Array(regions));
await writeFile(`${directory}/smooth-normals.bin`, new Uint8Array(smooth.buffer));
await writeFile(`${directory}/strokes.json`, JSON.stringify(strokes, null, 2) + '\n');
await writeFile(`${directory}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ triangleCount: count, byteLength: bytes.length, sha256, regions: manifest.regions, segmentCounts: manifest.animation.segmentCounts, invalidNormalFaces, positionMismatches: mismatches }, null, 2));
