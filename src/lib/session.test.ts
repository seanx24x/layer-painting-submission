import assert from "node:assert/strict";
import test from "node:test";
import {
  createSession,
  MAX_SAVED_GUIDES,
  MAX_SESSION_STORAGE_LENGTH,
  readSessions,
  saveSessions,
  SESSION_STORAGE_KEY,
  stepAdvance,
  updateSession,
  validateSessions,
  type GuideSessionDefinition,
  type SessionStorage,
  type SessionsByGuide,
} from "./session";

const guide: GuideSessionDefinition = {
  id: "drybrush",
  version: 1,
  stepIds: ["prepare", "practise"],
  preparedIds: ["brush", "paint"],
};
const now = "2026-10-07T12:00:00.000Z";

function memoryStorage(initial?: string): SessionStorage {
  const entries = new Map<string, string>();
  if (initial !== undefined) entries.set(SESSION_STORAGE_KEY, initial);
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

test("fresh storage is distinct from unavailable storage", () => {
  assert.deepEqual(readSessions([guide], memoryStorage()), {
    ok: true,
    sessions: {},
    found: false,
  });
  const unavailable = readSessions([guide], null);
  assert.equal(unavailable.ok, false);
  if (!unavailable.ok) assert.equal(unavailable.code, "storage-unavailable");
});

test("navigation, preparation, notes and explicit completion survive an immediate read", () => {
  let session = createSession(guide, now);
  session = updateSession(
    session,
    { type: "navigate", stepId: "practise" },
    guide,
    now,
  );
  assert.deepEqual(session.completedStepIds, []);
  session = updateSession(
    session,
    { type: "prepare", preparedId: "brush", prepared: true },
    guide,
    now,
  );
  session = updateSession(
    session,
    { type: "note", stepId: "practise", note: "Use less paint." },
    guide,
    now,
  );
  const storage = memoryStorage();
  assert.deepEqual(saveSessions({ [guide.id]: session }, [guide], storage), {
    ok: true,
  });
  assert.deepEqual(readSessions([guide], storage), {
    ok: true,
    sessions: { [guide.id]: session },
    found: true,
  });
});

test("corrupt and incompatible storage are reported without overwriting it", () => {
  for (const [raw, code] of [
    ["{broken", "invalid-data"],
    [JSON.stringify({ schemaVersion: 2, sessions: {} }), "version-mismatch"],
    [JSON.stringify({ schemaVersion: 1, sessions: [] }), "invalid-data"],
  ] as const) {
    const storage = memoryStorage(raw);
    const result = readSessions([guide], storage);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, code);
    assert.equal(storage.getItem(SESSION_STORAGE_KEY), raw);
  }
});

test("unknown identifiers, duplicate progress and oversized notes cannot attach to a guide", () => {
  const session = createSession(guide, now);
  const invalid = [
    { ...session, currentStepId: "removed" },
    { ...session, completedStepIds: ["prepare", "prepare"] },
    { ...session, preparedIds: ["not-a-material"] },
    { ...session, notes: { removed: "Old guide note" } },
    { ...session, notes: { prepare: "x".repeat(1_001) } },
    { ...session, completedAt: now },
    { ...session, startedAt: "not-a-timestamp" },
  ];
  for (const value of invalid)
    assert.equal(validateSessions({ [guide.id]: value }, [guide]).ok, false);
  const oldVersion = validateSessions(
    { [guide.id]: { ...session, guideVersion: 2 } },
    [guide],
  );
  assert.equal(oldVersion.ok, false);
  if (!oldVersion.ok) assert.equal(oldVersion.code, "version-mismatch");
});

test("a full collection retains independent notes and progress beyond the former five-guide limit", () => {
  const definitions = Array.from({ length: 65 }, (_, index) => ({
    ...guide,
    id: `guide-${index}`,
  }));
  const storage = memoryStorage();
  const sessions: SessionsByGuide = {};
  definitions.forEach((definition, index) => {
    let session = createSession(definition, now);
    session = updateSession(session, {
      type: "navigate",
      stepId: index % 2 ? "practise" : "prepare",
    }, definition, now);
    session = updateSession(session, {
      type: "note",
      stepId: "prepare",
      note: `Painting observations for ${definition.id}.`,
    }, definition, now);
    session = updateSession(session, {
      type: "complete-step",
      stepId: "prepare",
      completed: index % 3 === 0,
    }, definition, now);
    sessions[definition.id] = session;
    assert.deepEqual(saveSessions(sessions, definitions, storage), { ok: true });
  });
  assert.deepEqual(readSessions(definitions, storage), {
    ok: true,
    sessions,
    found: true,
  });
});

test("the larger collection still rejects excess guide counts and oversized raw storage", () => {
  const definitions = Array.from({ length: MAX_SAVED_GUIDES + 1 }, (_, index) => ({
    ...guide,
    id: `guide-${index}`,
  }));
  const sessions = Object.fromEntries(definitions.map((definition) => [
    definition.id,
    createSession(definition, now),
  ]));
  const oversized = validateSessions(sessions, definitions);
  assert.equal(oversized.ok, false);
  if (!oversized.ok) assert.equal(oversized.code, "invalid-data");
  delete sessions[definitions.at(-1)!.id];
  assert.equal(validateSessions(sessions, definitions).ok, true);

  const raw = "{malformed".repeat(Math.ceil(MAX_SESSION_STORAGE_LENGTH / 10) + 1);
  const storage = memoryStorage(raw);
  const read = readSessions(definitions, storage);
  assert.equal(read.ok, false);
  if (!read.ok) {
    assert.equal(read.code, "invalid-data");
    assert.match(read.message, /too large/);
  }
  assert.equal(storage.getItem(SESSION_STORAGE_KEY), raw);
});

test("a write exceeding the read limit leaves previous saved practice intact", () => {
  const definitions = Array.from({ length: 12 }, (_, index) => ({
    ...guide,
    id: `guide-${index}`,
    stepIds: Array.from({ length: 100 }, (_, step) => `step-${step}`),
  }));
  const sessions = Object.fromEntries(definitions.map((definition) => [
    definition.id,
    {
      ...createSession(definition, now),
      notes: Object.fromEntries(definition.stepIds.map((id) => [id, "x".repeat(1_000)])),
    },
  ]));
  const initial = JSON.stringify({ schemaVersion: 1, sessions: {} });
  const storage = memoryStorage(initial);
  const saved = saveSessions(sessions, definitions, storage);
  assert.equal(saved.ok, false);
  if (!saved.ok) assert.equal(saved.code, "write-failed");
  assert.equal(storage.getItem(SESSION_STORAGE_KEY), initial);
});

test("finishing requires explicit practice, and undoing a step reopens the session", () => {
  const original = createSession(guide, now);
  assert.throws(() => updateSession(original, { type: "finish" }, guide, now));
  let session = original;
  for (const stepId of guide.stepIds) {
    session = updateSession(
      session,
      { type: "complete-step", stepId, completed: true },
      guide,
      now,
    );
  }
  assert.equal(session.completedAt, undefined);
  session = updateSession(session, { type: "finish" }, guide, now);
  assert.equal(session.completedAt, now);
  session = updateSession(
    session,
    { type: "complete-step", stepId: "prepare", completed: false },
    guide,
    now,
  );
  assert.equal(session.completedAt, undefined);
  assert.deepEqual(original.completedStepIds, []);
});

test("Next completes only the current step and saves its destination in one transition", () => {
  const original = {
    ...createSession(guide, now),
    notes: { prepare: "Keep the point damp." },
    preparedIds: ["brush"],
  };
  const next = updateSession(original, { type: "advance-step", stepId: "prepare" }, guide, now);
  assert.deepEqual(next.completedStepIds, ["prepare"]);
  assert.equal(next.currentStepId, "practise");
  assert.equal(next.completedAt, undefined);
  assert.deepEqual(next.notes, original.notes);
  assert.deepEqual(next.preparedIds, original.preparedIds);
  assert.deepEqual(original.completedStepIds, []);
  assert.deepEqual(stepAdvance(guide.stepIds, "prepare", []), { stepId: "practise", finished: false });
  const revisited = updateSession(next, { type: "advance-step", stepId: "prepare" }, guide, now);
  assert.deepEqual(revisited.completedStepIds, ["prepare"], "revisiting Next is idempotent");
});

test("finishing the last step completes and restores the summary without a separate checkbox", () => {
  let session = createSession(guide, now);
  for (const stepId of guide.stepIds) {
    session = updateSession(session, { type: "advance-step", stepId }, guide, now);
  }
  assert.deepEqual(session.completedStepIds, guide.stepIds);
  assert.equal(session.currentStepId, "practise");
  assert.equal(session.completedAt, now);
  const storage = memoryStorage();
  assert.equal(saveSessions({ [guide.id]: session }, [guide], storage).ok, true);
  assert.deepEqual(readSessions([guide], storage), { ok: true, found: true, sessions: { [guide.id]: session } });
  assert.deepEqual(stepAdvance(guide.stepIds, "practise", ["prepare"]), { stepId: "practise", finished: true });
});

test("jumping to the final step never awards skipped steps; ordinary navigation awards nothing", () => {
  const visited = updateSession(createSession(guide, now), { type: "navigate", stepId: "practise" }, guide, now);
  assert.deepEqual(visited.completedStepIds, []);
  const final = updateSession(visited, { type: "advance-step", stepId: "practise" }, guide, now);
  assert.deepEqual(final.completedStepIds, ["practise"]);
  assert.equal(final.completedAt, undefined);
  assert.equal(final.currentStepId, "prepare");
  assert.deepEqual(stepAdvance(guide.stepIds, "practise", []), { stepId: "prepare", finished: false });
  assert.throws(() => updateSession(final, { type: "advance-step", stepId: "unknown" }, guide, now));
});

test("restart is immutable and clears only the given session", () => {
  const original = updateSession(
    createSession(guide, now),
    { type: "note", stepId: "prepare", note: "Keep this until restart." },
    guide,
    now,
  );
  const fresh = updateSession(original, { type: "restart" }, guide, now);
  assert.deepEqual(fresh, createSession(guide, now));
  assert.equal(original.notes.prepare, "Keep this until restart.");
  assert.throws(() =>
    updateSession(fresh, { type: "navigate", stepId: "missing" }, guide, now),
  );
  assert.throws(() =>
    updateSession(
      fresh,
      { type: "note", stepId: "prepare", note: "x".repeat(1_001) },
      guide,
      now,
    ),
  );
});

test("explicit starts and pauses preserve the first start without awarding completion", () => {
  const later = "2026-10-07T12:05:00.000Z";
  const first = updateSession(createSession(guide, now), { type: "start" }, guide, now);
  assert.equal(first.startedAt, now);
  const paused = updateSession(first, { type: "pause", stepId: "practise" }, guide, later);
  assert.equal(paused.startedAt, now);
  assert.equal(paused.currentStepId, "practise");
  assert.deepEqual(paused.completedStepIds, []);
  assert.equal(paused.completedAt, undefined);
  assert.equal(updateSession(paused, { type: "start" }, guide, later).currentStepId, "practise", "Continue keeps the latest saved position");
  assert.equal(updateSession(paused, { type: "restart" }, guide, later).startedAt, undefined);
  assert.throws(() => updateSession(paused, { type: "pause", stepId: "removed" }, guide, later));
});

test("legacy schema-one notes, completion and material identifiers round-trip without a start marker", () => {
  const legacy = {
    ...createSession(guide, now),
    currentStepId: "practise",
    preparedIds: [...guide.preparedIds],
    completedStepIds: [...guide.stepIds],
    notes: { prepare: "Keep this older note.", practise: "Use a lighter touch." },
    completedAt: now,
  };
  const storage = memoryStorage(JSON.stringify({ schemaVersion: 1, sessions: { [guide.id]: legacy } }));
  const restored = readSessions([guide], storage);
  assert.ok(restored.ok);
  assert.deepEqual(restored.sessions[guide.id], legacy);
  assert.equal(restored.sessions[guide.id].startedAt, undefined);
  assert.deepEqual(saveSessions(restored.sessions, [guide], storage), { ok: true });
  assert.equal(JSON.parse(storage.getItem(SESSION_STORAGE_KEY)!).schemaVersion, 1);
  assert.deepEqual(readSessions([guide], storage), restored);
});

test("storage read and quota errors never report a successful save", () => {
  const broken: SessionStorage = {
    getItem() {
      throw new Error("SecurityError");
    },
    setItem() {
      throw new Error("QuotaExceededError");
    },
  };
  const read = readSessions([guide], broken);
  assert.equal(read.ok, false);
  if (!read.ok) assert.equal(read.code, "read-failed");
  const session = createSession(guide, now);
  const saved = saveSessions({ [guide.id]: session }, [guide], broken);
  assert.equal(saved.ok, false);
  if (!saved.ok) assert.equal(saved.code, "write-failed");
  assert.equal(session.currentStepId, "prepare");
});
