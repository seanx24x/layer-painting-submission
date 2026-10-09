import assert from "node:assert/strict";
import test from "node:test";
import { resolvePracticeView, showsPracticeSummary, type PracticeView } from "./practice-view";

const steps = ["prepare", "basecoat", "highlight"];
const finished = { currentStepId: "highlight", completedAt: "2026-10-08T12:00:00.000Z" };

test("hydration uses an explicit valid link, saved position, then the first step", () => {
  assert.deepEqual(resolvePracticeView(null, steps, finished, "basecoat"), { stepId: "basecoat", mode: "step" });
  assert.deepEqual(resolvePracticeView(null, steps, { currentStepId: "basecoat" }), { stepId: "basecoat", mode: "step" });
  assert.deepEqual(resolvePracticeView(null, steps, undefined), { stepId: "prepare", mode: "step" });
  assert.deepEqual(resolvePracticeView(null, steps, { currentStepId: "removed" }, "invalid"), { stepId: "prepare", mode: "step" });
});

test("another tab's navigation, completion and uncheck never move the open editor", () => {
  const active: PracticeView = { stepId: "basecoat", mode: "step" };
  for (const saved of [{ currentStepId: "highlight" }, finished, { currentStepId: "prepare" }]) {
    assert.equal(resolvePracticeView(active, steps, saved), active);
    assert.equal(showsPracticeSummary(active, saved), false);
  }
  assert.deepEqual(resolvePracticeView(null, steps, { currentStepId: "highlight" }), { stepId: "highlight", mode: "step" });
});

test("only an explicit changed query can override an already open local position", () => {
  const active: PracticeView = { stepId: "prepare", mode: "step" };
  assert.equal(resolvePracticeView(active, steps, finished, "basecoat"), active);
  assert.deepEqual(resolvePracticeView(active, steps, finished, "basecoat", true), { stepId: "basecoat", mode: "step" });
  assert.equal(resolvePracticeView(active, steps, finished, undefined, true), active);
  assert.equal(resolvePracticeView(active, steps, finished, "removed", true), active);
});

test("completed entry opens its summary; remote unchecking invalidates the claim without changing position", () => {
  const summary = resolvePracticeView(null, steps, finished);
  assert.deepEqual(summary, { stepId: "highlight", mode: "summary" });
  assert.equal(showsPracticeSummary(summary, finished), true);
  assert.equal(showsPracticeSummary(summary, { currentStepId: "prepare" }), false);
  const reopened = resolvePracticeView(summary, steps, { currentStepId: "prepare" });
  assert.deepEqual(reopened, { stepId: "highlight", mode: "step" });
  assert.equal(resolvePracticeView(reopened, steps, finished), reopened, "later remote completion must not take over the editor again");
  assert.deepEqual(resolvePracticeView(summary, steps, finished, "basecoat", true), { stepId: "basecoat", mode: "step" });
});

test("explicit restart and finish positions survive their own query removal", () => {
  const restart: PracticeView = { stepId: steps[0], mode: "step" };
  assert.equal(resolvePracticeView(restart, steps, finished, undefined, true), restart);
  const complete: PracticeView = { stepId: steps.at(-1)!, mode: "summary" };
  assert.equal(resolvePracticeView(complete, steps, finished, undefined, true), complete);
  assert.equal(showsPracticeSummary(complete, finished), true);
});
