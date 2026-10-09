import assert from "node:assert/strict";
import test from "node:test";
import { groupGuidesByFaction } from "./guide-collection";
import { guides, guideSetting } from "./guides";

const factionKey = (name: string) => name.replaceAll("’", "'").toLocaleLowerCase();

test("the collection shows one card per faction without losing any study", () => {
  const groups = groupGuidesByFaction(guides);
  assert.equal(new Set(groups.map((group) => factionKey(group.faction))).size, groups.length);
  assert.equal(groups.length, new Set(guides.map((guide) => factionKey(guide.faction))).size);
  assert.deepEqual(
    groups.flatMap((group) => group.guides.map((guide) => guide.id)).toSorted(),
    guides.map((guide) => guide.id).toSorted(),
  );
  for (const group of groups) {
    assert.ok(group.guides.every((guide) => factionKey(guide.faction) === factionKey(group.faction)));
  }
});

test("Ultramarines retains both 40K approaches and its Heresy study", () => {
  const group = groupGuidesByFaction(guides).find((candidate) => candidate.faction === "Ultramarines");
  assert.ok(group);
  assert.deepEqual(group.guides.map((guide) => guide.id), [
    "ultramarines-grimdark",
    "ultramarines-classic",
    "heresy-ultramarines",
  ]);
});

test("typographic apostrophes do not split the same faction into separate cards", () => {
  const variants = guides.filter((guide) => factionKey(guide.faction) === "emperor's children");
  assert.equal(variants.length, 2);
  const groups = groupGuidesByFaction(variants);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].guides, variants);
});

test("grouping respects the incoming order and never reintroduces filtered studies", () => {
  const filtered = guides
    .filter((guide) => guideSetting(guide) === "horus-heresy")
    .toReversed();
  const groups = groupGuidesByFaction(filtered);
  assert.deepEqual(groups.map((group) => group.guides[0].id), filtered.map((guide) => guide.id));
  assert.ok(groups.every((group) => group.guides.every((guide) => guideSetting(guide) === "horus-heresy")));

  const grimdarkOnly = guides.filter((guide) => guide.style === "grimdark");
  assert.deepEqual(groupGuidesByFaction(grimdarkOnly).flatMap((group) => group.guides), grimdarkOnly);
  assert.deepEqual(groupGuidesByFaction([]), []);
});
