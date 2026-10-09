import { strict as assert } from "node:assert";
import { test } from "node:test";
import * as THREE from "three";
import { createCubeStudy, cubeStrokes } from "./cube-paint-study";
import { createTileStudy, tilePaintStrokes } from "./tile-paint-study";
import { createPaintingPalette } from "./painting-palette";
import { createPaintingBrush } from "./painting-brush";
import type { StudyPalette } from "./study-palette";

const palette: StudyPalette = {
  base: { id: "base", name: "Dark green", hex: "#16452c" },
  coats: [
    { id: "first", name: "Leaf green", hex: "#329449" },
    { id: "second", name: "Light green", hex: "#81b855" },
    { id: "third", name: "Pale green", hex: "#c5dc8e" },
  ],
};

function prepareShader(mesh: THREE.Object3D | undefined) {
  assert.ok(mesh instanceof THREE.Mesh);
  const material = mesh.material as THREE.MeshPhysicalMaterial;
  const shader = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: "#include <begin_vertex>",
    fragmentShader: "#include <color_fragment>\n#include <roughnessmap_fragment>",
  };
  material.onBeforeCompile(shader as unknown as Parameters<typeof material.onBeforeCompile>[0], {} as THREE.WebGLRenderer);
  return { material, shader };
}

function assertColor(value: unknown, hex: string) {
  assert.ok(value instanceof THREE.Color);
  assert.equal(`#${value.getHexString()}`, hex);
}

function assertBrushColor(group: THREE.Group, hex: string) {
  const tuft = group.getObjectByName("Flexible sable tuft") as THREE.Mesh;
  const colors = tuft.geometry.getAttribute("color");
  const expected = new THREE.Color(hex).multiplyScalar(.97);
  // The contact tip is fully loaded. Compare its actual GPU vertex color in linear space.
  for (const [actual, target] of [[colors.getX(0), expected.r], [colors.getY(0), expected.g], [colors.getZ(0), expected.b]]) {
    assert.ok(Math.abs(actual - target) < 1e-6, `Brush pigment ${actual} should match ${target}`);
  }
}

test("cube material, each highlight pass and the comparison surface use the supplied paints", () => {
  const study = createCubeStudy(palette);
  try {
    const { material, shader } = prepareShader(study.group.children[0]);
    assertColor(material.color, palette.base.hex);
    assertColor(shader.uniforms.edgeBaseColor.value, palette.base.hex);
    ["edgeBroadColor", "edgeFineColor", "edgeCornerColor"].forEach((key, index) => {
      assertColor(shader.uniforms[key].value, palette.coats[index].hex);
      const stroke = cubeStrokes.find(item => item.layer === index)!;
      study.update((stroke.start + stroke.end) / 2);
      assertBrushColor(study.group, palette.coats[index].hex);
    });
    study.group.userData.compareEdges = 1;
    study.update(24);
    assert.equal(shader.uniforms.compareEdges.value, 1);
    assertColor(shader.uniforms.edgeBaseColor.value, palette.base.hex);
  } finally { study.dispose(); }
});

test("recess and drybrush tiles use the selected surface, all three paints and matching brush pigment", () => {
  for (const technique of ["recess", "drybrush"] as const) {
    const study = createTileStudy(technique, palette);
    try {
      const slab = study.group.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
      assertColor(slab.material.color, palette.base.hex);
      const { shader } = prepareShader(study.group.getObjectByName("Five raised ridges and four recessed channels"));
      assertColor(shader.uniforms.tileBase.value, palette.base.hex);
      ["tileFirst", "tileSecond", "tileFinal"].forEach((key, index) => {
        assertColor(shader.uniforms[key].value, palette.coats[index].hex);
        const stroke = tilePaintStrokes(technique).find(item => item.layer === index)!;
        study.update((stroke.start + stroke.end) / 2);
        assertBrushColor(study.group, palette.coats[index].hex);
      });
    } finally { study.dispose(); }
  }
});

test("preparation keeps a red paint's hue across consistency samples, unloading and the brush", () => {
  const hex = "#a52328";
  const board = createPaintingPalette(hex);
  const brush = createPaintingBrush();
  try {
    const paints = board.group.children.filter(object => object instanceof THREE.Mesh && object.geometry instanceof THREE.SphereGeometry);
    // The small water droplet is the only sphere without pigment.
    const pigmented = paints.filter(object => (object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>).material.color.getHexString() === hex.slice(1));
    assert.equal(pigmented.length, 7);
    for (const time of [12, 18, 28, 34]) {
      board.update(time, brush);
      assertBrushColor(brush.group, hex);
    }
  } finally { board.dispose(); brush.dispose(); }
});

test("catalogue washes tint the underlying colour in recesses and flooded comparisons without changing brush pigment", () => {
  const wash = { id: "seraphim-sepia", name: "Seraphim Sepia", hex: "#e7a477" };
  const yellow: StudyPalette = {
    base: { id: "averland-sunset", name: "Averland Sunset", hex: "#fbb81c" },
    coats: [wash, wash, wash],
  };
  for (const [technique, selectedPalette, expectedTint] of [
    ["recess", yellow, 1],
    ["recess", undefined, 0],
    ["drybrush", yellow, 0],
  ] as const) {
    const study = createTileStudy(technique, selectedPalette);
    try {
      const { shader } = prepareShader(study.group.getObjectByName("Five raised ridges and four recessed channels"));
      assert.equal(shader.uniforms.tileShadeTint.value, expectedTint);
      if (expectedTint) {
        assertColor(shader.uniforms.tileFirst.value, wash.hex);
        study.update(3);
        assertBrushColor(study.group, wash.hex);
        study.group.userData.comparison = "recess";
        study.group.userData.before = true;
        study.update(24);
        assert.equal(shader.uniforms.mistake.value, 1);
        assert.equal(shader.uniforms.tileShadeTint.value, 1);
        assert.match(shader.fragmentShader, /mix\(paint, undercoat \* paint, tileShadeTint\)/);
        assert.match(shader.fragmentShader, /if\(mistake > \.5\)\s*\{\s*pigment=applyTilePaint/);
      }
    } finally { study.dispose(); }
  }
});
