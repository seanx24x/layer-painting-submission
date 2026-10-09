#!/usr/bin/env node
/** Lossless inspection-only delivery asset. The original STL stays local. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

const sourceDirectory = new URL('../../docs/pauldron-assets/', import.meta.url);
const destination = new URL('../../public/models/pauldron/', import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const source = await readFile(new URL('source.stl', sourceDirectory));
const reviewed = JSON.parse(await readFile(new URL('manifest.json', sourceDirectory), 'utf8'));
const boundary = JSON.parse(await readFile(new URL('boundary.json', sourceDirectory), 'utf8'));
const sourceHash = hash(source);
if (sourceHash !== reviewed.sourceSha256 || sourceHash !== boundary.sourceSha256) throw new Error('Source and reviewed map do not match.');
const triangles = source.readUInt32LE(80);
if (triangles !== reviewed.triangles || source.length !== 84 + triangles * 50) throw new Error('Unexpected source dimensions.');
const positions = Buffer.alloc(triangles * 9 * 4);
const facetNormals = Buffer.alloc(triangles * 3 * 4);
let positionMismatches = 0;
const correctedNormalFaces = [];
for (let face = 0; face < triangles; face++) {
  const sourceOffset = 84 + face * 50;
  source.copy(positions, face * 36, sourceOffset + 12, sourceOffset + 48);
  for (let value = 0; value < 9; value++) {
    if (source.readUInt32LE(sourceOffset + 12 + value * 4) !== positions.readUInt32LE(face * 36 + value * 4)) positionMismatches++;
  }
  source.copy(facetNormals, face * 12, sourceOffset, sourceOffset + 12);
  if (![0, 4, 8].every(offset => Number.isFinite(facetNormals.readFloatLE(face * 12 + offset)))) {
    facetNormals.writeFloatLE(1, face * 12);
    facetNormals.writeFloatLE(0, face * 12 + 4);
    facetNormals.writeFloatLE(0, face * 12 + 8);
    correctedNormalFaces.push(face);
  }
}
if (positionMismatches) throw new Error('A source position changed.');
const smoothNormals = await readFile(new URL('smooth-normals.bin', sourceDirectory));
const regions = await readFile(new URL('regions.bin', sourceDirectory));
if (smoothNormals.length !== positions.length || regions.length !== triangles) throw new Error('Reviewed attributes have unexpected dimensions.');
for (let offset = 0; offset < smoothNormals.length; offset += 4) {
  if (!Number.isFinite(smoothNormals.readFloatLE(offset))) throw new Error('Non-finite display normal.');
}
if ([...regions].some(region => region > 6)) throw new Error('Unknown region.');
const payload = Buffer.concat([positions, facetNormals, smoothNormals, regions]);
const compressed = gzipSync(payload, { level: 9 });
if (!gunzipSync(compressed).equals(payload)) throw new Error('Delivery compression changed the payload.');
const payloadHash = hash(payload);
const filename = `inspection-${payloadHash.slice(0, 16)}.bin.gz`;
const fields = ['kind', 'sourceSha256', 'centerX', 'yOrigin', 'yScale', 'radiusSquaredCoefficients', 'bottomCoefficients', 'topY', 'frontDepthMinimum'];
const manifest = {
  version: 1,
  sourceSha256: sourceHash,
  sourceBytes: source.length,
  triangles,
  vertices: triangles * 3,
  positionValues: positions.length / 4,
  positionMismatches,
  positionsSha256: hash(positions),
  coordinateUnits: 'unspecified',
  center: reviewed.center,
  displayBasis: reviewed.displayBasis,
  regions: reviewed.regions,
  correctedNormalFaces,
  corrections: reviewed.corrections,
  boundary: Object.fromEntries(fields.map(key => [key, boundary[key]])),
  payload: { file: filename, encoding: 'gzip; little-endian float32 positions, per-face facet normals, per-corner smooth normals, uint8 source-face regions', sha256: payloadHash, byteLength: payload.length, compressedBytes: compressed.length },
};
await mkdir(destination, { recursive: true });
await writeFile(new URL(filename, destination), compressed);
await writeFile(new URL('manifest.json', destination), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ triangles, positionValues: manifest.positionValues, positionMismatches, sourceHash, payloadBytes: payload.length, compressedBytes: compressed.length, correctedNormalFaces }, null, 2));
