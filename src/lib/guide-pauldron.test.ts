import assert from "node:assert/strict";
import test from "node:test";
import { guides, getGuide, type Guide } from "./guides";
import { getGuidePauldronStudy } from "./guide-pauldron";

function study(slug: string) {
  const guide = getGuide(slug);
  assert.ok(guide, `Missing test guide ${slug}`);
  return { guide, ...getGuidePauldronStudy(guide) };
}

test("every guide maps all seven regions to paints in its own palette without changing guide content", () => {
  const before = JSON.stringify(guides);
  assert.equal(guides.length, 66);
  for (const guide of guides) {
    const result = getGuidePauldronStudy(guide);
    assert.equal(result.id, guide.id);
    assert.equal(result.label, "Layer palette study");
    assert.deepEqual(result.sources, guide.sources);
    assert.deepEqual(result.assignments.flatMap((assignment) => assignment.regions).sort(), [0, 1, 2, 3, 4, 5, 6]);
    for (const assignment of result.assignments) {
      const paint = guide.paints.find((candidate) => candidate.id === assignment.paintId);
      assert.ok(paint, `${guide.id}/${assignment.label}: paint outside guide`);
      assert.equal(assignment.hex, paint.hex);
      assert.equal(assignment.name, paint.name);
    }
    for (const key of ["plate", "trim", "skull", "shade", "highlight", "trimHighlight"] as const) {
      assert.ok(guide.paints.some((paint) => paint.hex === result.palette[key]), `${guide.id}/${key}: unlisted paint colour`);
    }
    assert.deepEqual(getGuidePauldronStudy(guide), result, `${guide.id}: mapping changed between calls`);
  }
  assert.equal(JSON.stringify(guides), before);
});

test("shoulder-specific instructions take precedence over the guide's main body colour", () => {
  for (const [slug, plate, trim] of [
    ["black-templars-crusade", "Corax White", "Abaddon Black"],
    ["space-wolves-grey", "Averland Sunset", "Russ Grey"],
    ["deathwatch-veteran", "Leadbelcher", "Leadbelcher"],
    ["heresy-world-eaters", "Macragge Blue", "Corax White"],
  ]) {
    const result = study(slug);
    assert.equal(result.assignments[0].name, plate, slug);
    assert.equal(result.assignments[1].name, trim, slug);
  }
  assert.match(study("deathwatch-veteran").context, /separate parent-Chapter shoulder/);
});

test("finished palette uses recovery colours and transparent tints instead of the undercoat", () => {
  assert.equal(study("imperial-fists-yellow").assignments[0].name, "Yriel Yellow");
  assert.equal(study("emperors-children-pink").assignments[0].name, "Pink Horror");
  for (const [slug, colour] of [
    ["heresy-iron-hands", "Black Legion"],
    ["heresy-thousand-sons", "Flesh Tearers Red"],
    ["heresy-alpha-legion", "Akhelian Green"],
  ]) {
    const result = study(slug);
    assert.equal(result.assignments[0].name, colour);
    assert.equal(result.palette.plateMetalness, 0.65);
    assert.match(result.context, /illustrat/i);
  }
});

test("trim and skull remain explicit adaptations and do not import a generic faction recipe", () => {
  const classic = study("ultramarines-classic");
  assert.deepEqual(classic.assignments.map((assignment) => assignment.name), ["Macragge Blue", "Macragge Blue", "Macragge Blue"]);
  assert.equal(study("heresy-ultramarines").assignments[1].name, "Retributor Armour");
  assert.equal(study("blood-angels-red").assignments[1].name, "Mephiston Red");
  assert.equal(study("blood-angels-red").assignments[2].name, "Retributor Armour");
  assert.equal(study("imperial-fists-yellow").assignments[1].name, "Mephiston Red");
  assert.match(classic.context, /Layer choices/);
});

test("the scope distinguishes a palette adaptation from a faction armour model", () => {
  for (const slug of ["tyranids-leviathan", "daemons-tzeentch-horror", "heresy-daemons-of-the-ruinstorm", "orks-green-skin"]) {
    const result = study(slug);
    assert.equal(result.representation, "palette-adaptation");
    assert.match(result.context, /not a model of this faction's armour or anatomy/);
  }
  assert.equal(study("ultramarines-classic").representation, "armour-palette");
  assert.match(study("heresy-shattered-legions").context, /single pauldron does not represent all three/);
});

test("material adaptations retain defining secondary colours without changing armour studies", () => {
  for (const [slug, plate, trim, material] of [
    ["tyranids-leviathan", "Wraithbone", "Naggaroth Night", "carapace"],
    ["orks-green-skin", "Warboss Green", "Mephiston Red", "painted armour"],
    ["daemons-tzeentch-horror", "Pink Horror", "Caledor Sky", "tongue"],
    ["astra-militarum-cadian", "Castellan Green", "Zandri Dust", "fatigues"],
  ]) {
    const result = study(slug);
    assert.equal(result.assignments[0].name, plate);
    assert.equal(result.assignments[1].name, trim);
    assert.ok(result.context.includes(`guide's ${material} colour`));
    assert.match(result.context, /not a faction shoulder marking/);
  }
  const tyranids = study("tyranids-leviathan");
  assert.equal(tyranids.palette.trimHighlight, tyranids.guide.paints.find((paint) => paint.name === "Xereus Purple")?.hex);
  assert.deepEqual(study("ultramarines-classic").assignments.map((assignment) => assignment.name), ["Macragge Blue", "Macragge Blue", "Macragge Blue"]);
  assert.equal(study("grey-knights-silver").assignments[1].name, "Grey Knights Steel");
});

test("paint finish is assigned by material and unrelated metallic shades stay off black armour", () => {
  const greyKnights = study("grey-knights-silver");
  assert.equal(greyKnights.palette.plateMetalness, 0.65);
  assert.equal(greyKnights.palette.skullMetalness, 0);
  const templars = study("black-templars-crusade");
  assert.equal(templars.palette.plateMetalness, 0);
  assert.equal(templars.palette.metalness, 0);
  const raven = study("raven-guard-black");
  assert.equal(raven.palette.shade, raven.palette.plate);
});

test("a new guide uses an actual painted base rather than a primer or texture entry", () => {
  const base = getGuide("ultramarines-classic");
  assert.ok(base);
  const guide: Guide = {
    ...base, id: "new-palette-study", slug: "new-palette-study",
    paints: [{ id: "primer", name: "Primer", role: "Primer", hex: "#999999" }, ...base.paints],
    steps: [{ ...base.steps[0], paintIds: ["primer", "macragge-blue"] }, ...base.steps.slice(1)],
  };
  assert.equal(getGuidePauldronStudy(guide).assignments[0].paintId, "macragge-blue");
});
