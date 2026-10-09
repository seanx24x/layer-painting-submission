import { strict as assert } from "node:assert";
import { test } from "node:test";
import { guides } from "./guides";
import { groupGuidesByFaction } from "./guide-collection";
import { GUIDE_CARD_DESCRIPTIONS, guideCardDescription } from "./guide-card-copy";

test("every authored study has its own concise palette description", () => {
  assert.deepEqual(Object.keys(GUIDE_CARD_DESCRIPTIONS).sort(), guides.map(guide => guide.id).sort());
  for (const guide of guides) {
    const description = guideCardDescription(guide);
    assert.ok(description.length >= 65 && description.length <= 73, `${guide.id}: ${description.length} characters`);
    assert.doesNotMatch(description, /\b(practise|learn|exercise|brush control)\b/i, guide.id);
    assert.notEqual(description, `${guide.learning[0]}. ${guide.learning[1]}.`);
  }
  for (const group of groupGuidesByFaction(guides)) {
    assert.equal(new Set(group.guides.map(guideCardDescription)).size, group.guides.length, `${group.faction}: changing a study should change its description`);
  }
});
