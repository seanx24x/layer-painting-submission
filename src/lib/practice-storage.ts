import {
  createSession,
  readSessions,
  saveSessions,
  updateSession,
  type GuideSessionDefinition,
  type PracticeSession,
  type SessionAction,
  type SessionError,
  type SessionStorage,
  type SessionsByGuide,
} from "./session";

type PendingChange = { guideId: string; action?: SessionAction; at: string };
export type PracticeStorageSnapshot = {
  sessions: SessionsByGuide;
  error: SessionError | null;
  unsavedChanges: boolean;
};
type PracticeChangeResult = {
  saved: boolean;
  session: PracticeSession | undefined;
  completionAdded: boolean;
};

/** The provider's synchronous save/recovery controller. Inject storage only in tests. */
export function createPracticeStorage(
  definitions: readonly GuideSessionDefinition[],
  storage?: SessionStorage | null,
) {
  let snapshot: PracticeStorageSnapshot = { sessions: {}, error: null, unsavedChanges: false };
  let blocked = false;
  let pending: PendingChange[] = [];
  let replacing = false;

  function applyChanges(base: SessionsByGuide, changes: PendingChange[]): SessionsByGuide {
    return changes.reduce((sessions, change) => {
      const definition = definitions.find(entry => entry.id === change.guideId);
      if (!definition) return sessions;
      const session = sessions[change.guideId] ?? createSession(definition, change.at);
      // Another tab may have unmarked a step since Finish was rendered.
      if (change.action?.type === "finish" && session.completedStepIds.length !== definition.stepIds.length) return sessions;
      return {
        ...sessions,
        [change.guideId]: change.action
          ? updateSession(session, change.action, definition, change.at)
          : session,
      };
    }, base);
  }

  function restore() {
    const result = readSessions(definitions, storage);
    if (result.ok) {
      blocked = false;
      if (!replacing) snapshot = { ...snapshot, sessions: applyChanges(result.sessions, pending) };
      if (pending.length === 0 && !replacing) snapshot = { ...snapshot, error: null };
    } else {
      blocked = true;
      snapshot = { ...snapshot, error: result };
    }
  }

  function persist(next: SessionsByGuide): boolean {
    snapshot = { ...snapshot, sessions: next, unsavedChanges: pending.length > 0 || replacing };
    if (blocked) return false;
    const saved = saveSessions(next, definitions, storage);
    if (saved.ok) {
      pending = [];
      replacing = false;
    }
    snapshot = { ...snapshot, error: saved.ok ? null : saved, unsavedChanges: pending.length > 0 || replacing };
    return saved.ok;
  }

  function changeWithResult(guideId: string, action?: SessionAction, at = new Date().toISOString()): PracticeChangeResult {
    if (!definitions.some(entry => entry.id === guideId)) return { saved: false, session: undefined, completionAdded: false };
    let base = snapshot.sessions;
    if (!replacing) {
      // Read before every action so another tab's unrelated edits survive.
      const latest = readSessions(definitions, storage);
      if (latest.ok) {
        blocked = false;
        base = applyChanges(latest.sessions, pending);
      } else {
        blocked = true;
        snapshot = { ...snapshot, error: latest };
      }
    }
    const edit = { guideId, action, at };
    const next = applyChanges(base, [edit]);
    // Undo belongs only to a completion added by this action. The rendered
    // session may predate another tab's completion or our own queued changes.
    const completionAdded = action?.type === "advance-step"
      && !base[guideId]?.completedStepIds.includes(action.stepId)
      && next[guideId].completedStepIds.includes(action.stepId);
    pending.push(edit);
    return { saved: persist(next), session: next[guideId], completionAdded };
  }

  function change(guideId: string, action?: SessionAction, at = new Date().toISOString()): boolean {
    return changeWithResult(guideId, action, at).saved;
  }

  function retry(): boolean {
    if (replacing) {
      blocked = false;
      return persist(snapshot.sessions);
    }
    const restored = readSessions(definitions, storage);
    if (!restored.ok) {
      blocked = true;
      snapshot = { ...snapshot, error: restored };
      return false;
    }
    blocked = false;
    return persist(applyChanges(restored.sessions, pending));
  }

  function reset(): boolean {
    // Only explicit replacement may overwrite unreadable saved data.
    replacing = true;
    blocked = false;
    return persist(snapshot.sessions);
  }

  return { getSnapshot: () => snapshot, restore, change, changeWithResult, retry, reset };
}
