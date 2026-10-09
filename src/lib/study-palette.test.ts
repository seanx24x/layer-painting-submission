import { strict as assert } from "node:assert";
import { test } from "node:test";
import { guides, type GuideTechnique } from "./guides";
import { lessonExamples } from "./lesson-examples";
import { resolveStudyPalette, studyPaletteOptions } from "./study-palette";
import type { TechniqueId } from "./technique-study-types";

function context(guideId: string, stepId: string) {
  const guide = guides.find((candidate) => candidate.id === guideId)!;
  const step = guide.steps.find((candidate) => candidate.id === stepId)!;
  assert.ok(guide && step, `${guideId}/${stepId} must be an authored recipe`);
  return { guide, step };
}

const techniques: Record<GuideTechnique, TechniqueId> = {
  basecoat: "layers", highlight: "edges", wash: "recess", drybrush: "drybrush", finish: "layers",
};

test("every painted guide stage resolves only its exact catalogue paints, and every linked demo has a palette", () => {
  let demoCount = 0;
  for (const guide of guides) {
    for (const step of guide.steps) {
      const examples = lessonExamples(guide.id, step.id);
      const candidates = new Set([techniques[step.technique], ...examples.map((example) => example.technique)]);
      for (const technique of candidates) {
        const options = studyPaletteOptions(guide, step, technique);
        assert.equal(options.length > 0, step.paintIds.length > 0, `${guide.id}/${step.id}/${technique}`);
        assert.equal(new Set(options.map((option) => option.id)).size, options.length, "material IDs must be unique");
        for (const { palette } of options) {
          assert.equal(palette.coats.length, 3);
          for (const paint of palette.coats) {
            assert.ok(step.paintIds.includes(paint.id), `${guide.id}/${step.id} must not borrow a later paint: ${paint.id}`);
            const original = guide.paints.find((candidate) => candidate.id === paint.id)!;
            assert.deepEqual(paint, { id: original.id, name: original.name, hex: original.hex });
          }
          if (!palette.base.id.startsWith("practice-primer-")) {
            const original = guide.paints.find((paint) => paint.id === palette.base.id)!;
            assert.ok(original, `${guide.id}: base must belong to this recipe`);
            assert.equal(palette.base.hex, original.hex);
          }
        }
      }
      if (examples.length) {
        demoCount++;
        assert.ok(step.paintIds.length, "a linked animation requires a named paint");
      }
    }
  }
  assert.ok(demoCount > 150, "audit covers the full collection rather than a few example recipes");
});

test("foundation demos preserve faction colour across red, green, yellow, white, black, purple and metal", () => {
  for (const [guideId, paintId] of [
    ["blood-angels-red", "mephiston-red"],
    ["dark-angels-green", "caliban-green"],
    ["imperial-fists-yellow", "averland-sunset"],
    ["white-scars-white", "corax-white"],
    ["raven-guard-black", "abaddon-black"],
    ["heresy-emperors-children", "naggaroth-night"],
    ["custodes-gold", "retributor-armour"],
    ["heresy-mechanicum", "leadbelcher"],
  ]) {
    const { guide, step } = context(guideId, "foundation");
    const palette = resolveStudyPalette(guide, step, "layers");
    assert.deepEqual(palette.coats.map((paint) => paint.id), [paintId, paintId, paintId]);
    assert.equal(palette.coats[0].hex, guide.paints.find((paint) => paint.id === paintId)!.hex);
  }
});

test("a single-paint highlight or drybrush repeats that paint rather than inventing a paler endpoint", () => {
  for (const [guideId, stepId, technique, paintId] of [
    ["ultramarines-classic", "fine", "edges", "fenrisian-grey"],
    ["salamanders-classic", "recover", "drybrush", "warpstone-glow"],
    ["salamanders-classic", "light", "drybrush", "moot-green"],
    ["heresy-raven-guard", "edges-2", "edges", "thunderhawk-blue"],
  ] as const) {
    const { guide, step } = context(guideId, stepId);
    assert.deepEqual(resolveStudyPalette(guide, step, technique).coats.map((paint) => paint.id), [paintId, paintId, paintId]);
  }
  const { guide, step } = context("salamanders-classic", "recover");
  assert.equal(resolveStudyPalette(guide, step, "drybrush").base.id, "dark-angels-green");
});

test("separate wash materials keep the corresponding yellow, red and steel foundations", () => {
  const { guide, step } = context("imperial-fists-yellow", "shadows");
  assert.deepEqual(studyPaletteOptions(guide, step, "recess").map(({ palette }) => [palette.base.id, palette.coats[0].id]), [
    ["averland-sunset", "seraphim-sepia"],
    ["mephiston-red", "carroburg-crimson"],
    ["leadbelcher", "nuln-oil"],
  ]);
});

test("Heresy two-material highlights never combine white and blue paints on one surface", () => {
  const { guide, step } = context("heresy-world-eaters", "edges");
  assert.deepEqual(studyPaletteOptions(guide, step, "edges").map(({ label, palette }) => [label, palette.base.id, ...palette.coats.map((paint) => paint.id)]), [
    ["White armour", "corax-white", "white-scar", "white-scar", "white-scar"],
    ["Blue shoulders", "macragge-blue", "calgar-blue", "calgar-blue", "calgar-blue"],
  ]);
  const militia = context("heresy-imperialis-militia", "recess");
  assert.deepEqual(studyPaletteOptions(militia.guide, militia.step, "recess").map(({ palette }) => palette.base.id), ["steel-legion-drab", "castellan-green"]);
});

test("highlight progression excludes correction colours and respects the recovered underlying surface", () => {
  for (const [guideId, base, coats] of [
    ["heresy-sons-of-horus", "sons-of-horus-green", ["sybarite-green", "gauss-blaster-green", "gauss-blaster-green"]],
    ["heresy-salamanders", "waaagh-flesh", ["elysian-green", "ogryn-camo", "ogryn-camo"]],
    ["heresy-word-bearers", "khorne-red", ["wazdakka-red", "squig-orange", "squig-orange"]],
  ] as const) {
    const { guide, step } = context(guideId, "edges");
    const palette = resolveStudyPalette(guide, step, "edges");
    assert.equal(palette.base.id, base);
    assert.deepEqual(palette.coats.map((paint) => paint.id), coats);
  }
  const fists = context("imperial-fists-yellow", "light");
  assert.equal(resolveStudyPalette(fists.guide, fists.step, "edges").base.id, "yriel-yellow");
  const black = context("iron-hands-black", "light");
  assert.equal(studyPaletteOptions(black.guide, black.step, "edges").length, 1, "main armour step should not also offer a weapon that reuses Eshin Grey");
});

test("metal, cloth and focal-detail highlights use their own material foundation", () => {
  const { guide, step } = context("imperial-fists-yellow", "material-light");
  assert.deepEqual(studyPaletteOptions(guide, step, "edges").map(({ palette }) => [palette.base.id, palette.coats[0].id]), [
    ["mephiston-red", "evil-sunz-scarlet"], ["abaddon-black", "eshin-grey"], ["leadbelcher", "ironbreaker"],
  ]);
  const focal = context("blood-angels-red", "focal-point");
  const palette = resolveStudyPalette(focal.guide, focal.step, "edges");
  assert.equal(palette.base.id, "caliban-green");
  assert.equal(palette.coats[0].id, "moot-green");
});

test("recesses after transparent armour tints use the tinted surface rather than the silver beneath it", () => {
  for (const [guideId, base, shade] of [
    ["heresy-thousand-sons", "flesh-tearers-red", "carroburg-crimson"],
    ["heresy-alpha-legion", "akhelian-green", "coelia-greenshade"],
  ]) {
    const { guide, step } = context(guideId, "recess");
    const palette = resolveStudyPalette(guide, step, "recess");
    assert.equal(palette.base.id, base);
    assert.equal(palette.coats[0].id, shade);
  }
});

test("primer choices follow the preparation and paint-free stages cannot silently show blue", () => {
  for (const [guideId, primerId] of [
    ["imperial-fists-yellow", "practice-primer-warm"],
    ["heresy-white-scars", "practice-primer-light"],
    ["heresy-dark-angels", "practice-primer-black"],
  ]) {
    const { guide, step } = context(guideId, "foundation");
    assert.equal(resolveStudyPalette(guide, step, "layers").base.id, primerId);
  }
  const { guide, step } = context("ultramarines-grimdark", "seal");
  assert.deepEqual(studyPaletteOptions(guide, step, "layers"), []);
  assert.throws(() => resolveStudyPalette(guide, step, "layers"), /no paint to demonstrate/);
});
