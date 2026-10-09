import assert from "node:assert/strict";
import test from "node:test";
import { hasPracticeActivity, latestMeaningfulSession } from "./practice-progress";
import { createSession, type GuideSessionDefinition } from "./session";

const guide: GuideSessionDefinition = {
  id: "layers",
  version: 1,
  stepIds: ["prepare", "paint"],
  preparedIds: ["brush", "paint"],
};
const session = createSession(guide, "2026-10-09T00:00:00.000Z");

test("preparing materials does not imply painting activity", () => {
  assert.equal(hasPracticeActivity(undefined, "prepare"), false);
  assert.equal(hasPracticeActivity(session, "prepare"), false);
  assert.equal(hasPracticeActivity({ ...session, preparedIds: [...guide.preparedIds] }, "prepare"), false);
  assert.equal(hasPracticeActivity({ ...session, notes: { prepare: " \n " } }, "prepare"), false);
});

test("saved navigation, meaningful notes and physical acknowledgements retain a resume path", () => {
  assert.equal(hasPracticeActivity({ ...session, currentStepId: "paint" }, "prepare"), true);
  assert.equal(hasPracticeActivity({ ...session, notes: { prepare: "Use the smaller brush." } }, "prepare"), true);
  assert.equal(hasPracticeActivity({ ...session, completedStepIds: ["prepare"] }, "prepare"), true);
  assert.equal(hasPracticeActivity({ ...session, completedAt: "2026-10-09T00:10:00.000Z" }, "prepare"), true);
});

const definition = (id: string) => ({ id, version: 1 as const, stepIds: ["base", "shade"], preparedIds: ["tool-0"] });
const older = createSession(definition("older"), "2026-10-08T10:00:00Z");
const empty = createSession(definition("empty"), "2026-10-09T10:00:00Z");
const firstSteps = { older: "base", empty: "base" };
test("empty newer visits do not replace meaningful preparation", () => {
  const prepared = { ...older, preparedIds: ["tool-0"] };
  assert.equal(latestMeaningfulSession([prepared, empty], firstSteps), prepared);
  assert.equal(latestMeaningfulSession([older, empty], firstSteps), undefined);
});
test("notes and progress qualify, completed and removed guides do not", () => {
  const noted = { ...older, notes: { base: "Try a smaller brush." } };
  assert.equal(latestMeaningfulSession([noted], firstSteps), noted);
  const progressed = { ...older, currentStepId: "shade" };
  assert.equal(latestMeaningfulSession([progressed], firstSteps), progressed);
  assert.equal(latestMeaningfulSession([{ ...noted, completedAt: older.updatedAt }], firstSteps), undefined);
  assert.equal(latestMeaningfulSession([noted], {}), undefined);
});
