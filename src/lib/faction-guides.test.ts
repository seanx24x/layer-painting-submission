import assert from "node:assert/strict";
import test from "node:test";
import { guides, guideSetting } from "./guides";
import { getLessonExample } from "./lesson-examples";

const collection = guides.filter((guide) => guide.scheme);

test("the collection covers both universes and all eighteen known Heresy Legions", () => {
  assert.equal(new Set(guides.map((guide) => guide.id)).size, guides.length);
  assert.equal(new Set(guides.map((guide) => guide.slug)).size, guides.length);
  const heresy = guides.filter((guide) => guideSetting(guide) === "horus-heresy");
  const names = new Set(heresy.map((guide) => guide.faction));
  for (const name of ["Dark Angels", "Emperor’s Children", "Iron Warriors", "White Scars", "Space Wolves", "Imperial Fists", "Night Lords", "Blood Angels", "Iron Hands", "World Eaters", "Ultramarines", "Death Guard", "Thousand Sons", "Sons of Horus", "Word Bearers", "Salamanders", "Raven Guard", "Alpha Legion"]) {
    assert.ok([...names].some((candidate) => candidate.replaceAll("'", "’") === name), `Missing Legion: ${name}`);
  }
  assert.ok(heresy.length >= 29);
  assert.ok(names.has("Shattered Legions"));
  assert.ok(guides.filter((guide) => guideSetting(guide) === "warhammer-40k").length >= 37);
});

test("every faction study has a bounded scope, exact palette, complete steps and linked evidence", () => {
  for (const guide of collection) {
    assert.ok(guide.description.length > 50, `${guide.id}: missing scope`);
    assert.ok(guide.editorialNote?.includes("not an official studio recipe"));
    assert.ok(guide.prerequisites.length && guide.tools.length && guide.learning.length >= 2, guide.id);
    assert.ok(guide.steps.length >= 7, `${guide.id}: missing teaching sequence`);
    assert.equal(new Set(guide.steps.map((step) => step.id)).size, guide.steps.length, guide.id);
    assert.equal(new Set(guide.paints.map((paint) => paint.id)).size, guide.paints.length, guide.id);
    assert.ok(guide.paints.every((paint) => paint.catalogueId && paint.sourceUrl && paint.role), guide.id);
    const sourceIds = new Set(guide.sources.map((source) => source.id));
    assert.equal(sourceIds.size, guide.sources.length, guide.id);
    assert.ok(sourceIds.size > 0, `${guide.id}: missing sources`);
    for (const source of guide.sources) {
      const url = new URL(source.url);
      assert.equal(url.protocol, "https:", guide.id);
      assert.ok(["www.warhammer-community.com", "warhammer-community.com", "assets.warhammer-community.com", "warhammer40000.com", "www.warhammer40000.com", "paint.warhammer.com", "www.warhammer.com", "warhammer.com"].includes(url.hostname) || ["https://www.youtube.com/watch?v=RzFsuwhKXt4", "https://www.youtube.com/watch?v=ema9p7PjXqI", "https://www.youtube.com/watch?v=BqZK0gYPBYM", "https://www.richardgraycreations.com/wp-content/uploads/2018/09/KnightTutorial.pdf", "https://lillegendstudio.com/2020/04/28/daemons-of-the-ruinstorm/"].includes(url.href), `${guide.id}: review source ${url}`);
    }
    for (const step of guide.steps) {
      for (const field of ["title", "action", "detail", "lookFor", "simpleExplanation"] as const) assert.ok(step[field].trim().length > 0, `${guide.id}/${step.id}: missing ${field}`);
      assert.ok(step.sourceIds.every((id) => sourceIds.has(id)), `${guide.id}/${step.id}: unknown source`);
      assert.ok(step.paintIds.every((id) => guide.paints.some((paint) => paint.id === id)), `${guide.id}/${step.id}: unknown paint`);
      for (const id of step.exampleIds ?? []) assert.ok(getLessonExample(id), `${guide.id}/${step.id}: unknown example ${id}`);
    }
    for (const paint of guide.paints) assert.ok(guide.steps.some((step) => step.paintIds.includes(paint.id)), `${guide.id}: unused palette paint ${paint.name}`);
  }
});
