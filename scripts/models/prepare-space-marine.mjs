#!/usr/bin/env node
/**
 * Convert the separately downloaded, attributed source OBJ into the web asset.
 * Usage: node scripts/models/prepare-space-marine.mjs /path/to/source.obj [targetTriangles]
 * The 84 MB original stays outside this repository. No network access is used.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mergeVertices, toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";
import { MeshoptSimplifier } from "meshoptimizer/simplifier";

const sourcePath = process.argv[2];
const targetTriangles = Number(process.argv[3] ?? 120000);
if (!sourcePath || !Number.isInteger(targetTriangles) || targetTriangles < 10000) {
  throw new Error("Usage: node scripts/models/prepare-space-marine.mjs source.obj [targetTriangles>=10000]");
}
const outputDirectory = fileURLToPath(new URL("../../public/models/", import.meta.url));
const outputName = "primaris-space-marine";
const modelHeight = 2.7;
const maximumRelativeError = 0.0015;
const attribution = {
  title: "Warhammer 40k Primaris Space Marine figure",
  creator: "DicamoCM",
  source: "https://www.nexprint.com/en/models/G6817715",
  license: "CC BY 4.0 (as listed by the creator on Nexprint)",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
};

// The exporter requires this browser API only to turn Blob buffers into GLB.
// This asset is untextured, so no DOM/canvas emulation is needed.
globalThis.FileReader ??= class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    }).catch((error) => this.onerror?.(error));
  }
};

const sourceBytes = await readFile(sourcePath);
const object = new OBJLoader().parse(sourceBytes.toString("utf8"));
object.updateMatrixWorld(true);
const originalBounds = new THREE.Box3().setFromObject(object);
const center = originalBounds.getCenter(new THREE.Vector3());
const scale = modelHeight / (originalBounds.max.y - originalBounds.min.y);
const normalize = new THREE.Matrix4().makeScale(scale, scale, scale)
  .multiply(new THREE.Matrix4().makeTranslation(-center.x, -originalBounds.min.y, -center.z));

await MeshoptSimplifier.ready;
const sourceMeshes = [];
object.traverse((child) => { if (child.isMesh) sourceMeshes.push(child); });
const totalSourceTriangles = sourceMeshes.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0);
const scene = new THREE.Group();
scene.name = "Primaris Space Marine - DicamoCM";
scene.userData = { ...attribution, modifications: "Normalized scale and origin; mesh simplified; unused UVs removed; crease-aware normals rebuilt; neutral material substituted because no MTL or textures were supplied." };
const neutralMaterial = new THREE.MeshStandardMaterial({ color: "#c3c9ce", roughness: 0.73, metalness: 0 });
neutralMaterial.name = "Neutral primer (web preview)";
const meshes = [];

for (const [meshIndex, sourceMesh] of sourceMeshes.entries()) {
  const originalGeometry = sourceMesh.geometry;
  originalGeometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(normalize, sourceMesh.matrixWorld));
  // The source's per-corner UV/normal islands duplicate almost every vertex.
  // No textures were supplied, so UVs provide no visible benefit. Rebuild the
  // normals after reduction, retaining hard creases instead of flat triangles.
  originalGeometry.deleteAttribute("uv");
  originalGeometry.deleteAttribute("normal");
  const geometry = mergeVertices(originalGeometry, 1e-6);
  geometry.computeVertexNormals();
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const originalIndices = new Uint32Array(geometry.index.array);
  const wanted = Math.max(3, Math.floor(targetTriangles * (originalIndices.length / 3) / totalSourceTriangles) * 3);
  const [indices, relativeError] = normal
    ? MeshoptSimplifier.simplifyWithAttributes(
      originalIndices, position.array, 3, normal.array, 3, [0.5, 0.5, 0.5], null,
      Math.min(wanted, originalIndices.length), maximumRelativeError,
    )
    : MeshoptSimplifier.simplify(
      originalIndices, position.array, 3, Math.min(wanted, originalIndices.length), maximumRelativeError,
    );
  const [remap, vertexCount] = MeshoptSimplifier.compactMesh(indices);
  const compactGeometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const compact = new attribute.array.constructor(vertexCount * attribute.itemSize);
    for (let oldIndex = 0; oldIndex < remap.length; oldIndex++) {
      const nextIndex = remap[oldIndex];
      if (nextIndex === 0xffffffff) continue;
      for (let component = 0; component < attribute.itemSize; component++) {
        compact[nextIndex * attribute.itemSize + component] = attribute.array[oldIndex * attribute.itemSize + component];
      }
    }
    compactGeometry.setAttribute(name, new THREE.BufferAttribute(compact, attribute.itemSize, attribute.normalized));
  }
  compactGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
  if (!normal) compactGeometry.computeVertexNormals();
  // toCreasedNormals groups positions at a fixed 0.01-unit precision. Work at
  // 100x scale so sub-millimetre sculpt details are not accidentally grouped.
  compactGeometry.scale(100, 100, 100);
  const creasedGeometry = toCreasedNormals(compactGeometry, Math.PI / 3);
  creasedGeometry.scale(0.01, 0.01, 0.01);
  const finalGeometry = mergeVertices(creasedGeometry, 1e-6);
  finalGeometry.computeBoundingBox();
  finalGeometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(finalGeometry, neutralMaterial);
  mesh.name = `Primaris miniature ${meshIndex + 1}`;
  scene.add(mesh);
  meshes.push({
    sourceTriangles: originalIndices.length / 3,
    weldedVertices: position.count,
    triangles: indices.length / 3,
    vertices: finalGeometry.getAttribute("position").count,
    relativeError,
    preservedNormals: false,
    preservedUVs: false,
    rebuiltNormals: "60-degree crease-aware normals after simplification",
    attributes: Object.keys(finalGeometry.attributes),
  });
  geometry.dispose();
  originalGeometry.dispose();
  compactGeometry.dispose();
  creasedGeometry.dispose();
}

// Decimation can discard an extreme vertex. Restore exact centered bounds and
// requested height after reduction rather than depending on that vertex.
const reducedBounds = new THREE.Box3().setFromObject(scene);
const reducedCenter = reducedBounds.getCenter(new THREE.Vector3());
const finalScale = modelHeight / (reducedBounds.max.y - reducedBounds.min.y);
const finalCorrection = new THREE.Matrix4().makeScale(finalScale, finalScale, finalScale)
  .multiply(new THREE.Matrix4().makeTranslation(-reducedCenter.x, -reducedBounds.min.y, -reducedCenter.z));
scene.traverse((child) => {
  if (!child.isMesh) return;
  child.geometry.applyMatrix4(finalCorrection);
  child.geometry.computeBoundingBox();
  child.geometry.computeBoundingSphere();
});

const binary = await new GLTFExporter().parseAsync(scene, {
  binary: true,
  onlyVisible: true,
  copyright: `DicamoCM. CC BY 4.0. ${attribution.source}. Modified for Layer.`,
});
const outputBytes = Buffer.from(binary);
const bounds = new THREE.Box3().setFromObject(scene);
const stats = {
  ...attribution,
  sourceFile: path.basename(sourcePath),
  sourceBytes: sourceBytes.byteLength,
  sourceSha256: createHash("sha256").update(sourceBytes).digest("hex"),
  outputFile: `${outputName}.glb`,
  outputBytes: outputBytes.byteLength,
  outputSha256: createHash("sha256").update(outputBytes).digest("hex"),
  sourceBounds: { min: originalBounds.min.toArray(), max: originalBounds.max.toArray() },
  bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
  normalization: { upAxis: "Y", targetHeight: modelHeight, scale, preScaleTranslation: [-center.x, -originalBounds.min.y, -center.z], postSimplificationCorrection: { scale: finalScale, preScaleTranslation: [-reducedCenter.x, -reducedBounds.min.y, -reducedCenter.z] }, rotationApplied: [0, 0, 0], orientationNote: "Source orientation preserved; front/shoulder camera targets require rendered inspection." },
  simplification: { targetTriangles, maximumRelativeError, normalWeights: [0.5, 0.5, 0.5], algorithm: "meshoptimizer simplifyWithAttributes", weldTolerance: 1e-6 },
  meshes,
  triangles: meshes.reduce((sum, mesh) => sum + mesh.triangles, 0),
  vertices: meshes.reduce((sum, mesh) => sum + mesh.vertices, 0),
  limitations: ["Single connected mesh; no semantic armour, weapon, or paint masks.", "Source references an MTL that was not supplied. No textures included; unused per-corner UV coordinates removed for efficient welding.", "Source per-corner normals replaced with reconstructed 60-degree crease-aware normals.", "Neutral web-preview material replaces the missing material. No painted appearance is claimed.", "License and creator attribution are taken from the Nexprint listing; this is a creator-uploaded model, not an official Games Workshop asset."],
};
await mkdir(outputDirectory, { recursive: true });
// Bake the reviewed surface map after geometry conversion. Keep intermediate
// assets out of public/ and discard only the temporary directory created here.
const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "layer-marine-"));
try {
  const neutralPath = path.join(temporaryDirectory, "neutral.glb");
  const paintedPath = path.join(temporaryDirectory, "painted.glb");
  await writeFile(neutralPath, outputBytes);
  execFileSync(process.execPath, [
    fileURLToPath(new URL("./segment-space-marine.mjs", import.meta.url)),
    neutralPath,
    fileURLToPath(new URL("./marine-paint-seeds.json", import.meta.url)),
    paintedPath,
  ], { stdio: "inherit" });
  const paintedBytes = await readFile(paintedPath);
  const paintReport = JSON.parse(await readFile(path.join(temporaryDirectory, "painted.segmentation.json"), "utf8"));
  stats.outputBytes = paintedBytes.byteLength;
  stats.outputSha256 = paintReport.outputSha256;
  stats.materialRegions = paintReport.labels;
  stats.paintMap = { seedsSha256: paintReport.seedsSha256, seedCount: paintReport.seedReport.length, polygonCount: paintReport.polygonReport.length, curvatureChannels: paintReport.curvatureChannels };
  stats.meshes.forEach((mesh) => mesh.attributes.push("color"));
  stats.limitations = [
    "Source was a single untextured mesh. Layer adds a hand-authored illustrative material map, not manufacturer textures.",
    "Regions use curated surface seeds and visible-view polygon boundaries; triangle resolution limits very small details.",
    "Curvature-driven shade and highlights illustrate geometry, not a physical paint simulation or calibrated finish.",
    "Source per-corner normals were rebuilt and unused UVs removed during optimisation.",
    "Creator and CC BY 4.0 license are taken from the Nexprint listing; this is not an official Games Workshop asset."
  ];
  await writeFile(path.join(outputDirectory, `${outputName}.glb`), paintedBytes);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
await writeFile(path.join(outputDirectory, `${outputName}.json`), `${JSON.stringify(stats, null, 2)}\n`);
await writeFile(path.join(outputDirectory, `${outputName}-LICENSE.txt`), `${attribution.title}\nCreator: ${attribution.creator}\nSource: ${attribution.source}\n\nLicense: Creative Commons Attribution 4.0 International (CC BY 4.0), as listed by the creator on Nexprint.\nLicense text and terms: ${attribution.licenseUrl}\n\nModifications for Layer:\n- Converted OBJ to binary glTF (GLB).\n- Centered horizontally, grounded at Y=0, and uniformly scaled to 2.7 units high.\n- Simplified mesh topology, removed unused per-corner UVs, and rebuilt crease-aware normals.\n- Authored armour, trim, weapon, metal, flexible joints, leather, cloth, lenses, base and stone material regions.\n- Baked convex and concave surface weights for illustrative paint stages; the referenced source MTL and textures were not supplied.\n\nPlease preserve this attribution and identify further changes when redistributing.\nThis is a creator-uploaded model; Layer does not claim it is an official Games Workshop asset or that Games Workshop endorses Layer.\n`);
console.log(JSON.stringify(stats, null, 2));
