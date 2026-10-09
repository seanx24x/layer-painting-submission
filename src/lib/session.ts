export const SESSION_STORAGE_KEY = "layer.practice.v1";
export const MAX_SESSION_NOTES_LENGTH = 1_000;
export const MAX_SAVED_GUIDES = 128;
export const MAX_SESSION_STORAGE_LENGTH = 1_000_000;

export interface PracticeSession {
  guideId: string;
  guideVersion: 1;
  currentStepId: string;
  completedStepIds: string[];
  preparedIds: string[];
  notes: Record<string, string>;
  updatedAt: string;
  /** Explicit lesson entry or pause; absent in legacy and materials-only saves. */
  startedAt?: string;
  completedAt?: string;
}

export interface GuideSessionDefinition {
  id: string;
  version: 1;
  stepIds: readonly string[];
  preparedIds: readonly string[];
}

export type SessionsByGuide = Record<string, PracticeSession>;
export type SessionStorage = Pick<Storage, "getItem" | "setItem">;
export type SessionErrorCode =
  | "storage-unavailable"
  | "read-failed"
  | "invalid-data"
  | "version-mismatch"
  | "write-failed";

export interface SessionError {
  ok: false;
  code: SessionErrorCode;
  message: string;
}

export type SessionValidationResult =
  { ok: true; sessions: SessionsByGuide } | SessionError;
export type ReadSessionsResult =
  { ok: true; sessions: SessionsByGuide; found: boolean } | SessionError;
export type SaveSessionsResult = { ok: true } | SessionError;

export type SessionAction =
  | { type: "start" }
  | { type: "pause"; stepId: string }
  | { type: "navigate"; stepId: string }
  | { type: "advance-step"; stepId: string }
  | { type: "complete-step"; stepId: string; completed: boolean }
  | { type: "prepare"; preparedId: string; prepared: boolean }
  | { type: "note"; stepId: string; note: string }
  | { type: "finish" }
  | { type: "restart" };

const error = (code: SessionErrorCode, message: string): SessionError => ({
  ok: false,
  code,
  message,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isKnownIdList(
  value: unknown,
  allowed: ReadonlySet<string>,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= allowed.size &&
    value.every((id) => typeof id === "string" && allowed.has(id)) &&
    new Set(value).size === value.length
  );
}

function isDefinitionValid(definition: GuideSessionDefinition): boolean {
  return (
    definition.version === 1 &&
    definition.id.length > 0 &&
    definition.stepIds.length > 0 &&
    definition.stepIds.length <= 100 &&
    definition.preparedIds.length <= 100 &&
    definition.stepIds.every((id) => typeof id === "string" && id.length > 0) &&
    definition.preparedIds.every(
      (id) => typeof id === "string" && id.length > 0,
    ) &&
    new Set(definition.stepIds).size === definition.stepIds.length &&
    new Set(definition.preparedIds).size === definition.preparedIds.length
  );
}

/** Validate saved progress against the current authored guide IDs, without migrating it. */
export function validateSessions(
  value: unknown,
  definitions: readonly GuideSessionDefinition[],
): SessionValidationResult {
  if (!isRecord(value) || Object.keys(value).length > MAX_SAVED_GUIDES) {
    return error("invalid-data", "Saved practice data could not be restored.");
  }
  const guides = new Map(
    definitions.map((definition) => [definition.id, definition]),
  );
  const validated: [string, PracticeSession][] = [];

  for (const [guideId, entry] of Object.entries(value)) {
    const definition = guides.get(guideId);
    if (
      !definition ||
      !isDefinitionValid(definition) ||
      !isRecord(entry) ||
      entry.guideId !== guideId
    ) {
      return error(
        "invalid-data",
        "Saved practice no longer matches an available guide.",
      );
    }
    if (entry.guideVersion !== definition.version) {
      return error(
        "version-mismatch",
        "This practice was saved with a different guide version.",
      );
    }
    const steps = new Set(definition.stepIds);
    const preparation = new Set(definition.preparedIds);
    if (
      typeof entry.currentStepId !== "string" ||
      !steps.has(entry.currentStepId) ||
      !isKnownIdList(entry.completedStepIds, steps) ||
      !isKnownIdList(entry.preparedIds, preparation) ||
      !isRecord(entry.notes) ||
      Object.keys(entry.notes).length > steps.size ||
      !isTimestamp(entry.updatedAt) ||
      (entry.startedAt !== undefined && !isTimestamp(entry.startedAt)) ||
      (entry.completedAt !== undefined &&
        (!isTimestamp(entry.completedAt) ||
          entry.completedStepIds.length !== steps.size))
    ) {
      return error(
        "invalid-data",
        "Saved practice contains progress that cannot be restored.",
      );
    }
    const notes: [string, string][] = [];
    for (const [stepId, note] of Object.entries(entry.notes)) {
      if (
        !steps.has(stepId) ||
        typeof note !== "string" ||
        note.length > MAX_SESSION_NOTES_LENGTH
      ) {
        return error(
          "invalid-data",
          "Saved practice contains a note that cannot be restored.",
        );
      }
      notes.push([stepId, note]);
    }
    validated.push([
      guideId,
      {
        guideId,
        guideVersion: definition.version,
        currentStepId: entry.currentStepId,
        completedStepIds: [...entry.completedStepIds],
        preparedIds: [...entry.preparedIds],
        notes: Object.fromEntries(notes),
        updatedAt: entry.updatedAt,
        ...(entry.startedAt !== undefined ? { startedAt: entry.startedAt } : {}),
        ...(entry.completedAt !== undefined
          ? { completedAt: entry.completedAt }
          : {}),
      },
    ]);
  }
  return { ok: true, sessions: Object.fromEntries(validated) };
}

// Deliberately resolve the browser API only when called, including its throwing getter.
function resolveStorage(
  storage?: SessionStorage | null,
): SessionStorage | null {
  if (storage !== undefined) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function readSessions(
  definitions: readonly GuideSessionDefinition[],
  storage?: SessionStorage | null,
): ReadSessionsResult {
  let resolved: SessionStorage | null;
  try {
    resolved = resolveStorage(storage);
  } catch {
    return error(
      "storage-unavailable",
      "Saving on this device is unavailable.",
    );
  }
  if (!resolved)
    return error(
      "storage-unavailable",
      "Saving on this device is unavailable.",
    );

  let raw: string | null;
  try {
    raw = resolved.getItem(SESSION_STORAGE_KEY);
  } catch {
    return error(
      "read-failed",
      "Saved practice could not be read. Your saved data has not been changed.",
    );
  }
  if (raw === null) return { ok: true, sessions: {}, found: false };
  if (raw.length > MAX_SESSION_STORAGE_LENGTH)
    return error(
      "invalid-data",
      "Saved practice data is too large to restore.",
    );

  let envelope: unknown;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return error(
      "invalid-data",
      "Saved practice data could not be read. You can start fresh.",
    );
  }
  if (!isRecord(envelope))
    return error("invalid-data", "Saved practice data could not be restored.");
  if (envelope.schemaVersion !== 1) {
    return error(
      "version-mismatch",
      "This saved practice uses an unsupported storage version.",
    );
  }
  const result = validateSessions(envelope.sessions, definitions);
  return result.ok ? { ...result, found: true } : result;
}

/** Synchronous writes make an immediately following navigation or reload safe. */
export function saveSessions(
  sessions: SessionsByGuide,
  definitions: readonly GuideSessionDefinition[],
  storage?: SessionStorage | null,
): SaveSessionsResult {
  const validation = validateSessions(sessions, definitions);
  if (!validation.ok) return validation;
  const serialized = JSON.stringify({ schemaVersion: 1, sessions: validation.sessions });
  // Never replace readable progress with a payload that the reader will reject.
  if (serialized.length > MAX_SESSION_STORAGE_LENGTH) {
    return error(
      "write-failed",
      "Saved practice is too large to store. Your work is still open.",
    );
  }
  let resolved: SessionStorage | null;
  try {
    resolved = resolveStorage(storage);
  } catch {
    return error(
      "storage-unavailable",
      "Saving on this device is unavailable. Your work is still open.",
    );
  }
  if (!resolved) {
    return error(
      "storage-unavailable",
      "Saving on this device is unavailable. Your work is still open.",
    );
  }
  try {
    resolved.setItem(
      SESSION_STORAGE_KEY,
      serialized,
    );
    return { ok: true };
  } catch {
    return error(
      "write-failed",
      "Your latest changes have not been saved. Keep this page open and try again.",
    );
  }
}

export function createSession(
  definition: GuideSessionDefinition,
  now = new Date().toISOString(),
): PracticeSession {
  if (!isDefinitionValid(definition))
    throw new Error("A session needs a valid guide definition.");
  if (!isTimestamp(now)) throw new Error("A session needs a valid timestamp.");
  return {
    guideId: definition.id,
    guideVersion: definition.version,
    currentStepId: definition.stepIds[0],
    completedStepIds: [],
    preparedIds: [],
    notes: {},
    updatedAt: now,
  };
}

/** Next completes this step only. A jump to the end cannot complete skipped steps. */
export function stepAdvance(
  stepIds: readonly string[],
  stepId: string,
  completedStepIds: readonly string[],
): { stepId: string; finished: boolean } {
  const index = stepIds.indexOf(stepId);
  if (index < 0) throw new Error("That step is not part of this guide.");
  const following = stepIds[index + 1];
  if (following) return { stepId: following, finished: false };
  const remaining = stepIds.find(id => id !== stepId && !completedStepIds.includes(id));
  return { stepId: remaining ?? stepId, finished: !remaining };
}

/** Invalid transitions throw; callers keep the last valid in-memory session. */
export function updateSession(
  session: PracticeSession,
  action: SessionAction,
  definition: GuideSessionDefinition,
  now = new Date().toISOString(),
): PracticeSession {
  const validation = validateSessions({ [session.guideId]: session }, [
    definition,
  ]);
  if (!validation.ok) throw new Error(validation.message);
  if (!isTimestamp(now)) throw new Error("A session needs a valid timestamp.");
  if (action.type === "restart") return createSession(definition, now);
  const next = { ...validation.sessions[session.guideId], updatedAt: now };

  if ("stepId" in action && !definition.stepIds.includes(action.stepId)) {
    throw new Error("That step is not part of this guide.");
  }
  switch (action.type) {
    case "start":
      next.startedAt = next.startedAt ?? now;
      break;
    case "pause":
      next.startedAt = next.startedAt ?? now;
      next.currentStepId = action.stepId;
      break;
    case "navigate":
      next.currentStepId = action.stepId;
      break;
    case "advance-step": {
      const destination = stepAdvance(definition.stepIds, action.stepId, next.completedStepIds);
      next.completedStepIds = definition.stepIds.filter(id => id === action.stepId || next.completedStepIds.includes(id));
      next.currentStepId = destination.stepId;
      if (destination.finished) next.completedAt = next.completedAt ?? now;
      break;
    }
    case "complete-step": {
      const completed = new Set(next.completedStepIds);
      if (action.completed) completed.add(action.stepId);
      else completed.delete(action.stepId);
      next.completedStepIds = definition.stepIds.filter((id) =>
        completed.has(id),
      );
      if (!action.completed) delete next.completedAt;
      break;
    }
    case "prepare": {
      if (!definition.preparedIds.includes(action.preparedId)) {
        throw new Error("That preparation item is not part of this guide.");
      }
      const prepared = new Set(next.preparedIds);
      if (action.prepared) prepared.add(action.preparedId);
      else prepared.delete(action.preparedId);
      next.preparedIds = definition.preparedIds.filter((id) =>
        prepared.has(id),
      );
      break;
    }
    case "note":
      if (action.note.length > MAX_SESSION_NOTES_LENGTH) {
        throw new Error(
          "Keep each practice note to 1,000 characters or fewer.",
        );
      }
      next.notes = { ...next.notes, [action.stepId]: action.note };
      break;
    case "finish":
      if (next.completedStepIds.length !== definition.stepIds.length) {
        throw new Error(
          "Complete each step before finishing this guide.",
        );
      }
      next.completedAt = next.completedAt ?? now;
      break;
  }
  return next;
}
