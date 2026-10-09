import assert from "node:assert/strict";
import test from "node:test";
import { createPracticeStorage } from "./practice-storage";
import { createSession, readSessions, SESSION_STORAGE_KEY, type GuideSessionDefinition, type SessionStorage, type SessionsByGuide } from "./session";
import { hasPracticeActivity } from "./practice-progress";
import { resolvePracticeView } from "./practice-view";

const guide: GuideSessionDefinition = { id: "layers", version: 1, stepIds: ["prepare", "paint"], preparedIds: ["brush"] };
const other: GuideSessionDefinition = { ...guide, id: "edges" };
const definitions = [guide, other];
const now = "2026-10-08T12:00:00.000Z";
const envelope = (sessions: SessionsByGuide) => JSON.stringify({ schemaVersion: 1, sessions });

function failingStorage(initial: string | null = null) {
  const state = { raw: initial, failReads: false, failWrites: false, writeAttempts: 0 };
  const storage: SessionStorage = {
    getItem(key) {
      assert.equal(key, SESSION_STORAGE_KEY);
      if (state.failReads) throw new Error("SecurityError");
      return state.raw;
    },
    setItem(key, value) {
      assert.equal(key, SESSION_STORAGE_KEY);
      state.writeAttempts++;
      if (state.failWrites) throw new Error("QuotaExceededError");
      state.raw = value;
    },
  };
  return { state, storage };
}

function saved(storage: SessionStorage): SessionsByGuide {
  const result = readSessions(definitions, storage);
  assert.ok(result.ok);
  return result.sessions;
}

test("an explicit first-step pause resumes that step while materials-only progress remains Preparing", () => {
  const { storage } = failingStorage();
  const practice = createPracticeStorage(definitions, storage);
  practice.restore();
  assert.equal(practice.change(guide.id, { type: "prepare", preparedId: "brush", prepared: true }, now), true);
  assert.equal(hasPracticeActivity(saved(storage).layers, "prepare"), false);
  assert.equal(saved(storage).layers.startedAt, undefined);
  assert.equal(practice.change(guide.id, { type: "pause", stepId: "prepare" }, now), true);

  const restored = createPracticeStorage(definitions, storage);
  restored.restore();
  const session = restored.getSnapshot().sessions.layers;
  assert.equal(hasPracticeActivity(session, "prepare"), true);
  assert.deepEqual(resolvePracticeView(null, guide.stepIds, session), { stepId: "prepare", mode: "step" });
  assert.deepEqual(session.preparedIds, ["brush"]);
  assert.deepEqual(session.completedStepIds, []);
  assert.equal(session.completedAt, undefined);
  assert.equal(session.startedAt, now);
});

test("a failed first-step pause keeps its start marker through recovery and merges remote notes", () => {
  const { state, storage } = failingStorage(envelope({ layers: createSession(guide, now) }));
  const practice = createPracticeStorage(definitions, storage);
  practice.restore();
  state.failWrites = true;
  assert.equal(practice.change(guide.id, { type: "pause", stepId: "prepare" }, now), false);
  assert.equal(practice.getSnapshot().unsavedChanges, true);
  state.raw = envelope({ layers: { ...createSession(guide, now), notes: { paint: "Another tab's note." } } });
  state.failWrites = false;
  assert.equal(practice.retry(), true);
  assert.equal(saved(storage).layers.startedAt, now);
  assert.equal(saved(storage).layers.notes.paint, "Another tab's note.");
  assert.deepEqual(saved(storage).layers.completedStepIds, []);
});

test("Next persists completion and position together while preserving another tab's saved information", () => {
  const { state, storage } = failingStorage();
  const practice = createPracticeStorage(definitions, storage);
  practice.restore();
  practice.change(guide.id, { type: "note", stepId: "prepare", note: "Keep this local note." }, now);
  const remote = saved(storage);
  remote.layers.preparedIds = ["brush"];
  remote.layers.notes.paint = "Another tab's note.";
  state.raw = envelope(remote);
  const writes = state.writeAttempts;
  assert.equal(practice.change(guide.id, { type: "advance-step", stepId: "prepare" }, now), true);
  assert.equal(state.writeAttempts, writes + 1, "Next is a single synchronous persistence transition");
  const afterNext = saved(storage).layers;
  assert.deepEqual(afterNext.completedStepIds, ["prepare"]);
  assert.equal(afterNext.currentStepId, "paint");
  assert.deepEqual(afterNext.notes, { prepare: "Keep this local note.", paint: "Another tab's note." });
  assert.deepEqual(afterNext.preparedIds, ["brush"]);

  // A last-step click rendered before a remote undo must not create a false summary.
  afterNext.completedStepIds = [];
  state.raw = envelope({ layers: afterNext });
  assert.equal(practice.change(guide.id, { type: "advance-step", stepId: "paint" }, now), true);
  const afterFinish = saved(storage).layers;
  assert.deepEqual(afterFinish.completedStepIds, ["paint"]);
  assert.equal(afterFinish.currentStepId, "prepare");
  assert.equal(afterFinish.completedAt, undefined);
});

test("a last-step action exposes the merged destination when remote progress changed after render", () => {
  const { state, storage } = failingStorage(envelope({ layers: createSession(guide, now) }));
  const practice = createPracticeStorage(definitions, storage);
  practice.restore();
  assert.deepEqual(practice.getSnapshot().sessions.layers.completedStepIds, []);
  // This tab would predict an unfinished first step from its render snapshot.
  state.raw = envelope({ layers: { ...createSession(guide, now), completedStepIds: ["prepare"] } });
  practice.change(guide.id, { type: "advance-step", stepId: "paint" }, now);
  const advanced = practice.getSnapshot().sessions.layers;
  assert.equal(advanced.currentStepId, "paint");
  assert.equal(advanced.completedAt, now);
  assert.deepEqual(advanced, saved(storage).layers, "the provider's returned session can drive the URL and view from the same persisted result");
});

test("Next does not offer Undo for a completion another tab added after render", () => {
  const original = createSession(guide, now);
  const { state, storage } = failingStorage(envelope({ layers: original }));
  const practice = createPracticeStorage(definitions, storage);
  practice.restore();
  state.raw = envelope({ layers: { ...original, completedStepIds: ["prepare"] } });
  assert.deepEqual(practice.getSnapshot().sessions.layers.completedStepIds, [], "the rendered snapshot is deliberately stale");

  const writes = state.writeAttempts;
  const result = practice.changeWithResult(guide.id, { type: "advance-step", stepId: "prepare" }, now);
  assert.equal(result.saved, true);
  assert.equal(result.completionAdded, false);
  assert.equal(result.session?.currentStepId, "paint");
  assert.deepEqual(result.session, saved(storage).layers);
  assert.equal(state.writeAttempts, writes + 1, "metadata adds no extra persistence transition");
});

test("Undo removes the newly completed step and preserves later notes, preparation and other progress", () => {
  const { state, storage } = failingStorage(envelope({
    layers: { ...createSession(guide, now), completedStepIds: ["prepare"], notes: { prepare: "Keep my preparation note." } },
  }));
  const practice = createPracticeStorage(definitions, storage);
  practice.restore();
  const result = practice.changeWithResult(guide.id, { type: "advance-step", stepId: "paint" }, now);
  assert.equal(result.completionAdded, true);
  assert.equal(result.session?.completedAt, now);

  const remote = saved(storage);
  remote.layers.notes.paint = "A new observation after completion.";
  remote.layers.preparedIds = ["brush"];
  remote.edges = { ...createSession(other, now), notes: { paint: "Another study's note." } };
  state.raw = envelope(remote);
  practice.change(guide.id, { type: "complete-step", stepId: "paint", completed: false }, now);
  practice.change(guide.id, { type: "navigate", stepId: "paint" }, now);

  const afterUndo = saved(storage);
  assert.deepEqual(afterUndo.layers.completedStepIds, ["prepare"]);
  assert.equal(afterUndo.layers.completedAt, undefined);
  assert.equal(afterUndo.layers.currentStepId, "paint");
  assert.deepEqual(afterUndo.layers.notes, { prepare: "Keep my preparation note.", paint: "A new observation after completion." });
  assert.deepEqual(afterUndo.layers.preparedIds, ["brush"]);
  assert.equal(afterUndo.edges.notes.paint, "Another study's note.");
});

test("completion metadata includes queued progress without claiming a failed save succeeded", () => {
  const { state, storage } = failingStorage();
  const practice = createPracticeStorage(definitions, storage);
  practice.restore();
  state.failWrites = true;
  const first = practice.changeWithResult(guide.id, { type: "advance-step", stepId: "prepare" }, now);
  assert.equal(first.saved, false);
  assert.equal(first.completionAdded, true);
  const repeated = practice.changeWithResult(guide.id, { type: "advance-step", stepId: "prepare" }, now);
  assert.equal(repeated.saved, false);
  assert.equal(repeated.completionAdded, false, "queued completion already belongs to the open session");
  assert.deepEqual(repeated.session?.completedStepIds, ["prepare"]);

  const writes = state.writeAttempts;
  assert.deepEqual(practice.changeWithResult("missing", { type: "advance-step", stepId: "prepare" }, now), {
    saved: false, session: undefined, completionAdded: false,
  });
  assert.equal(state.writeAttempts, writes, "an unknown guide cannot write storage");
});

test("unreadable storage retains edits without overwriting data; retry merges them with repaired storage", () => {
  const { state, storage } = failingStorage("{unreadable");
  const practice = createPracticeStorage(definitions, storage);
  practice.restore();
  assert.equal(practice.getSnapshot().error?.code, "invalid-data");
  assert.equal(practice.change(guide.id, { type: "note", stepId: "paint", note: "Keep this local observation." }, now), false);
  assert.equal(practice.change(guide.id, { type: "navigate", stepId: "paint" }, now), false);
  assert.equal(practice.change(guide.id, { type: "complete-step", stepId: "prepare", completed: true }, now), false);
  assert.equal(practice.retry(), false);
  assert.equal(state.writeAttempts, 0, "a read failure must never authorise a replacement write");
  assert.equal(state.raw, "{unreadable");
  assert.equal(practice.getSnapshot().sessions.layers.notes.paint, "Keep this local observation.");

  state.raw = envelope({
    layers: { ...createSession(guide, now), notes: { prepare: "A note from the other tab." }, preparedIds: ["brush"] },
    edges: { ...createSession(other, now), notes: { paint: "Keep the other study too." } },
  });
  practice.restore();
  assert.equal(practice.getSnapshot().sessions.layers.notes.paint, "Keep this local observation.");
  assert.equal(practice.retry(), true);
  const restored = saved(storage);
  assert.deepEqual(restored.layers.notes, { prepare: "A note from the other tab.", paint: "Keep this local observation." });
  assert.equal(restored.layers.currentStepId, "paint");
  assert.deepEqual(restored.layers.completedStepIds, ["prepare"]);
  assert.deepEqual(restored.layers.preparedIds, ["brush"]);
  assert.equal(restored.edges.notes.paint, "Keep the other study too.");
  assert.equal(practice.getSnapshot().error, null);

  restored.layers.notes.paint = "A later saved edit.";
  state.raw = envelope(restored);
  practice.restore();
  assert.equal(practice.getSnapshot().sessions.layers.notes.paint, "A later saved edit.", "successful retry must clear the old pending edits");
});

test("quota failures and a failed reread preserve pending edits until a successful synchronous retry", () => {
  const original = envelope({ layers: { ...createSession(guide, now), notes: { paint: "Original saved note." } } });
  const { state, storage } = failingStorage(original);
  const practice = createPracticeStorage(definitions, storage);
  practice.restore();
  state.failWrites = true;
  assert.equal(practice.change(guide.id, { type: "note", stepId: "paint", note: "Unsaved replacement." }, now), false);
  assert.equal(practice.change(guide.id, { type: "prepare", preparedId: "brush", prepared: true }, now), false);
  assert.equal(state.raw, original);
  assert.equal(practice.getSnapshot().error?.code, "write-failed");

  state.failReads = true;
  const beforeRetry = practice.getSnapshot().sessions;
  assert.equal(practice.retry(), false);
  assert.equal(practice.getSnapshot().sessions, beforeRetry);
  assert.equal(practice.getSnapshot().error?.code, "read-failed");
  const writesBeforeBlockedEdit = state.writeAttempts;
  assert.equal(practice.change(guide.id, { type: "complete-step", stepId: "paint", completed: true }, now), false);
  assert.equal(state.writeAttempts, writesBeforeBlockedEdit, "editing while reads fail must not overwrite unseen data");
  state.failReads = false;
  state.raw = envelope({
    layers: { ...createSession(guide, now), notes: { prepare: "New remote note." } },
    edges: createSession(other, now),
  });
  practice.restore();
  assert.equal(practice.getSnapshot().sessions.layers.notes.paint, "Unsaved replacement.");
  assert.equal(practice.retry(), false, "read recovery alone is not a successful save");
  state.failWrites = false;
  assert.equal(practice.retry(), true);
  const restored = saved(storage); // No timer or effect is needed before reading the saved result.
  assert.deepEqual(restored.layers.notes, { prepare: "New remote note.", paint: "Unsaved replacement." });
  assert.deepEqual(restored.layers.preparedIds, ["brush"]);
  assert.deepEqual(restored.layers.completedStepIds, ["paint"]);
  assert.ok(restored.edges);
});

test("failed explicit replacement retains the open work through remote events and can be retried", () => {
  const { state, storage } = failingStorage("broken");
  const practice = createPracticeStorage(definitions, storage);
  practice.restore();
  practice.change(guide.id, { type: "note", stepId: "paint", note: "My open work." }, now);
  state.failWrites = true;
  assert.equal(practice.reset(), false);
  assert.equal(state.raw, "broken");

  // Explicit replacement stays in force after a quota failure. A later storage
  // event must not replace the exact working copy the user chose to retain.
  state.raw = envelope({ edges: createSession(other, now) });
  practice.restore();
  assert.equal(practice.getSnapshot().sessions.layers.notes.paint, "My open work.");
  assert.equal(practice.getSnapshot().sessions.edges, undefined);
  practice.change(guide.id, { type: "note", stepId: "prepare", note: "Added after the failed replacement." }, now);
  assert.equal(practice.retry(), false);
  state.failWrites = false;
  assert.equal(practice.retry(), true);
  assert.deepEqual(Object.keys(saved(storage)), [guide.id]);
  assert.deepEqual(saved(storage).layers.notes, { paint: "My open work.", prepare: "Added after the failed replacement." });

  state.raw = envelope({ ...saved(storage), edges: createSession(other, now) });
  assert.equal(practice.change(guide.id, { type: "navigate", stepId: "paint" }, now), true);
  assert.ok(saved(storage).edges, "normal read/merge semantics resume after a successful replacement");
});

test("queued restart clears that study in order without dropping another study's notes", () => {
  const { state, storage } = failingStorage(envelope({
    layers: { ...createSession(guide, now), notes: { prepare: "Old practice." }, preparedIds: ["brush"] },
    edges: { ...createSession(other, now), notes: { paint: "Unrelated work." } },
  }));
  const practice = createPracticeStorage(definitions, storage);
  practice.restore();
  state.failWrites = true;
  practice.change(guide.id, { type: "note", stepId: "paint", note: "Before restart." }, now);
  practice.change(guide.id, { type: "restart" }, now);
  practice.change(guide.id, { type: "note", stepId: "paint", note: "After restart." }, now);
  state.failWrites = false;
  assert.equal(practice.retry(), true);
  assert.deepEqual(saved(storage).layers.notes, { paint: "After restart." });
  assert.deepEqual(saved(storage).layers.preparedIds, []);
  assert.equal(saved(storage).edges.notes.paint, "Unrelated work.");
});

test("a stale Finish action cannot overwrite another tab's undone step", () => {
  const complete = { ...createSession(guide, now), completedStepIds: [...guide.stepIds] };
  const { state, storage } = failingStorage(envelope({ layers: complete }));
  const practice = createPracticeStorage(definitions, storage);
  practice.restore();
  state.raw = envelope({ layers: { ...complete, completedStepIds: ["prepare"] } });
  assert.equal(practice.change(guide.id, { type: "finish" }, now), true);
  assert.deepEqual(saved(storage).layers.completedStepIds, ["prepare"]);
  assert.equal(saved(storage).layers.completedAt, undefined);
});

test("unavailable storage keeps edits open and neither retry nor reset claims success", () => {
  const practice = createPracticeStorage(definitions, null);
  practice.restore();
  assert.equal(practice.change(guide.id, { type: "note", stepId: "paint", note: "Still in memory." }, now), false);
  assert.equal(practice.retry(), false);
  assert.equal(practice.reset(), false);
  assert.equal(practice.getSnapshot().error?.code, "storage-unavailable");
  assert.equal(practice.getSnapshot().sessions.layers.notes.paint, "Still in memory.");
});

test("unsaved status starts with a failed edit or replacement and clears only after a confirmed write", () => {
  const { state, storage } = failingStorage("unreadable");
  const practice = createPracticeStorage(definitions, storage);
  practice.restore();
  assert.equal(practice.getSnapshot().unsavedChanges, false, "an unreadable saved file alone is not unsaved work");
  assert.equal(practice.retry(), false);
  assert.equal(practice.getSnapshot().unsavedChanges, false);

  practice.change(guide.id, { type: "note", stepId: "paint", note: "Do not lose this." }, now);
  assert.equal(practice.getSnapshot().unsavedChanges, true);
  state.raw = envelope({});
  practice.restore();
  assert.equal(practice.getSnapshot().unsavedChanges, true, "a successful read does not save pending edits");
  state.failWrites = true;
  assert.equal(practice.retry(), false);
  assert.equal(practice.getSnapshot().unsavedChanges, true);
  state.failWrites = false;
  assert.equal(practice.retry(), true);
  assert.equal(practice.getSnapshot().unsavedChanges, false);
  assert.equal(JSON.stringify(saved(storage)).includes("unsavedChanges"), false, "the flag is never persisted");

  state.failWrites = true;
  assert.equal(practice.reset(), false);
  assert.equal(practice.getSnapshot().unsavedChanges, true, "an explicit replacement needs confirmation even without queued edits");
  practice.restore();
  assert.equal(practice.getSnapshot().unsavedChanges, true);
  state.failWrites = false;
  assert.equal(practice.reset(), true);
  assert.equal(practice.getSnapshot().unsavedChanges, false);
  assert.equal(practice.change(guide.id, { type: "navigate", stepId: "paint" }, now), true);
  assert.equal(practice.getSnapshot().unsavedChanges, false, "ordinary successful synchronous saves do not create a leave warning");
});
