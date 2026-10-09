import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { Matrix4, OrthographicCamera, Vector3 } from 'three';
import { framePauldronCamera } from './pauldron-viewer';

const directory = new URL('../../public/models/pauldron/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8'));
const compressed = readFileSync(new URL(manifest.payload.file, directory));
const payload = gunzipSync(compressed);
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const triangles = 85_424;
const positions = payload.subarray(0, triangles * 36);
const facets = payload.subarray(triangles * 36, triangles * 48);
const smooth = payload.subarray(triangles * 48, triangles * 84);
const regions = payload.subarray(triangles * 84);

test('guide pauldron delivery is lossless, complete and excludes the original STL and animation data', () => {
  assert.equal(manifest.sourceSha256, 'a49fd57c0b1f9a5359f29f6ea73148c8f45c50799f42a7f91286c27a95085278');
  assert.equal(manifest.triangles, triangles);
  assert.equal(manifest.vertices, triangles * 3);
  assert.equal(manifest.positionValues, triangles * 9);
  assert.equal(manifest.coordinateUnits, 'unspecified');
  assert.equal(manifest.positionMismatches, 0);
  assert.equal(payload.length, triangles * 85);
  assert.equal(payload.length, manifest.payload.byteLength);
  assert.equal(compressed.length, manifest.payload.compressedBytes);
  assert.equal(hash(payload), manifest.payload.sha256);
  // A pinned digest checks fidelity even on machines without the private STL.
  assert.equal(hash(positions), 'c6c06174fe36dab7afab414ee6776bf77dc2bcf519eecce6aef4d690b5c4f9f1');
  assert.equal(hash(positions), manifest.positionsSha256);
  assert.deepEqual(readdirSync(directory).sort(), [manifest.payload.file, 'manifest.json'].sort());
  assert.ok(compressed.length < 3_000_000, 'Lossless transfer should remain below 3 MB.');
});

test('source face IDs, display normals and all seven reviewed regions survive the delivery format', () => {
  assert.equal(facets.length, triangles * 12);
  assert.equal(smooth.length, triangles * 36);
  assert.equal(regions.length, triangles);
  assert.deepEqual(manifest.correctedNormalFaces, [39_869, 66_120]);
  for (const bytes of [facets, smooth]) for (let offset = 0; offset < bytes.length; offset += 4) {
    assert.ok(Number.isFinite(bytes.readFloatLE(offset)));
  }
  for (const face of manifest.correctedNormalFaces) {
    assert.deepEqual([0, 4, 8].map(offset => facets.readFloatLE(face * 12 + offset)), [1, 0, 0]);
  }
  const counts = Array<number>(7).fill(0);
  for (const region of regions) {
    assert.ok(region >= 0 && region < 7);
    counts[region]++;
  }
  assert.deepEqual(counts, [12004, 9382, 14939, 2325, 12222, 20487, 14065]);
  assert.deepEqual(counts, manifest.regions.map((region: { faces: number }) => region.faces));
});

test('the continuous paint border is tied to the same geometry and preserves the reviewed display transform', () => {
  assert.equal(manifest.boundary.kind, 'authored-profile-v1');
  assert.equal(manifest.boundary.sourceSha256, manifest.sourceSha256);
  assert.equal(manifest.boundary.radiusSquaredCoefficients.length, 5);
  assert.equal(manifest.boundary.bottomCoefficients.length, 3);
  assert.ok(manifest.boundary.radiusSquaredCoefficients.every(Number.isFinite));
  assert.ok(manifest.boundary.bottomCoefficients.every(Number.isFinite));
  const basis = Object.values(manifest.displayBasis) as number[][];
  for (const axis of basis) assert.ok(Math.abs(Math.hypot(...axis) - 1) < 1e-12);
  for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) {
    assert.ok(Math.abs(basis[a].reduce((sum, value, index) => sum + value * basis[b][index], 0)) < 1e-12);
  }
});

const sourcePath = new URL('../../docs/pauldron-assets/source.stl', import.meta.url);
test('every delivered position retains the original source float bit pattern and triangle order', {
  skip: !existsSync(sourcePath) && 'The original user-supplied STL deliberately stays local.',
}, () => {
  const source = readFileSync(sourcePath);
  assert.equal(hash(source), manifest.sourceSha256);
  assert.equal(source.readUInt32LE(80), triangles);
  for (let face = 0; face < triangles; face++) for (let coordinate = 0; coordinate < 9; coordinate++) {
    assert.equal(positions.readUInt32LE(face * 36 + coordinate * 4), source.readUInt32LE(84 + face * 50 + 12 + coordinate * 4));
  }
});

test('the pauldron silhouette is centred across presets, zoom and viewport resizing without moving its geometry or orbit pivot', () => {
  const points = new Float32Array(positions.buffer, positions.byteOffset, positions.length / 4);
  const basis = manifest.displayBasis as { right: [number, number, number]; up: [number, number, number]; front: [number, number, number] };
  const model = new Matrix4().set(...basis.right, 0, ...basis.up, 0, ...basis.front, 0, 0, 0, 0, 1);
  model.multiply(new Matrix4().makeTranslation(-manifest.center[0], -manifest.center[1], -manifest.center[2]));
  const originalModel = model.clone();
  const directions = [[13, 6, 27], [0, 1, 30], [0, 1, -30], [9, 4, 28], [-20, 16, 13], [17, -15, -19]];
  const viewports = [[980, 490], [620, 440], [320, 320]];
  for (const direction of directions) for (const [width, height] of viewports) for (const zoom of [1, 1.65, 2.5]) {
    const camera = new OrthographicCamera(-12, 12, 9, -9, .1, 150);
    camera.position.fromArray(direction);
    camera.lookAt(0, 0, 0);
    camera.zoom = zoom;
    const originalPosition = camera.position.clone(), originalQuaternion = camera.quaternion.clone();
    framePauldronCamera(camera, points, model, width, height);
    // Independently project every unchanged source corner to verify the visible
    // silhouette's opposing edges are equidistant from the canvas centre.
    const clip = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(model);
    const point = new Vector3();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let index = 0; index < points.length; index += 3) {
      point.fromArray(points, index).applyMatrix4(clip);
      minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
    }
    assert.ok(Math.abs((minX + maxX) * width / 4) < 1e-8, 'Horizontal silhouette centre must match the canvas centre.');
    assert.ok(Math.abs((minY + maxY) * height / 4) < 1e-8, 'Vertical silhouette centre must match the canvas centre.');
    assert.deepEqual(camera.position, originalPosition);
    assert.deepEqual(camera.quaternion.toArray(), originalQuaternion.toArray());
    assert.deepEqual(model, originalModel);
  }
  assert.equal(hash(positions), manifest.positionsSha256);
});
