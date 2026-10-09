import assert from "node:assert/strict";
import test from "node:test";
import { guides, guideSetting } from "./guides";
import { resolveHeroGuideSelection } from "./hero-guide-selection";

test("the home defaults open the classic 40K Ultramarines guide", () => {
  const selected = resolveHeroGuideSelection(guides, { faction: "Ultramarines", style: "classic", setting: "warhammer-40k" });
  assert.equal(selected?.guide.slug, "ultramarines-classic");
  assert.deepEqual(selected?.settings, ["warhammer-40k", "horus-heresy"]);
});

test("choosing Heresy keeps the faction and resolves an available style in that setting", () => {
  const selected = resolveHeroGuideSelection(guides, { faction: "Ultramarines", style: "grimdark", setting: "horus-heresy", studySlug: "ultramarines-grimdark" });
  assert.equal(selected?.faction, "Ultramarines");
  assert.equal(selected?.setting, "horus-heresy");
  assert.equal(selected?.style, "classic");
  assert.equal(selected?.guide.slug, "heresy-ultramarines");
  assert.deepEqual(selected?.styles, ["classic"]);
});

test("changing faction preserves an available setting and style", () => {
  const selected = resolveHeroGuideSelection(guides, { faction: "Blood Angels", style: "classic", setting: "horus-heresy", studySlug: "heresy-ultramarines" });
  assert.equal(selected?.faction, "Blood Angels");
  assert.equal(selected?.style, "classic");
  assert.equal(selected?.guide.slug, "heresy-blood-angels");
});

test("single-setting factions always resolve to their available setting", () => {
  const selected = resolveHeroGuideSelection(guides, { faction: "Necrons", style: "grimdark", setting: "horus-heresy" });
  assert.deepEqual(selected?.settings, ["warhammer-40k"]);
  assert.equal(selected?.setting, "warhammer-40k");
  assert.equal(selected?.style, "classic");
  assert.equal(selected?.guide.faction, "Necrons");
  const heresyOnly = resolveHeroGuideSelection(guides, { faction: "Sons of Horus", style: "classic", setting: "warhammer-40k" });
  assert.deepEqual(heresyOnly?.settings, ["horus-heresy"]);
  assert.equal(heresyOnly?.setting, "horus-heresy");
});

test("apostrophe variants share settings without changing the displayed faction", () => {
  const selected = resolveHeroGuideSelection(guides, { faction: "Emperor’s Children", style: "classic", setting: "horus-heresy" });
  assert.equal(selected?.faction, "Emperor’s Children");
  assert.deepEqual(selected?.settings, ["warhammer-40k", "horus-heresy"]);
  assert.equal(selected?.guide.slug, "heresy-emperors-children");
});

test("multiple colour studies remain selectable within a single setting and style", () => {
  const selected = resolveHeroGuideSelection(guides, { faction: "Chaos Daemons", style: "classic", setting: "warhammer-40k", studySlug: "daemons-tzeentch-horror" });
  assert.equal(selected?.studies.length, 4);
  assert.equal(selected?.guide.slug, "daemons-tzeentch-horror");
});

test("every published study remains reachable and the resolved controls match its destination", () => {
  for (const guide of guides) {
    const selected = resolveHeroGuideSelection(guides, { faction: guide.faction, style: guide.style, setting: guideSetting(guide), studySlug: guide.slug });
    assert.equal(selected?.guide, guide, guide.slug);
    assert.equal(selected?.setting, guideSetting(guide), guide.slug);
    assert.equal(selected?.style, guide.style, guide.slug);
  }
  assert.equal(resolveHeroGuideSelection([], { faction: "Ultramarines", style: "classic", setting: "warhammer-40k" }), undefined);
});
