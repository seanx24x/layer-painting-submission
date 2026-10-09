import type { PracticeSession } from "./session";

/**
 * Material checkboxes alone do not imply practice activity. Explicit entry and
 * pause retain a first-step resume path; older saves keep their existing signals.
 */
export function hasPracticeActivity(
  session: PracticeSession | undefined,
  firstStepId: string,
): boolean {
  return Boolean(
    session &&
      (session.startedAt ||
        session.completedAt ||
        session.currentStepId !== firstStepId ||
        session.completedStepIds.length > 0 ||
        Object.values(session.notes).some((note) => note.trim().length > 0)),
  );
}

/** Empty visits must not displace a meaningful unfinished study. */
export function latestMeaningfulSession(sessions: PracticeSession[], firstSteps: Record<string, string>): PracticeSession | undefined {
  return sessions.filter(session => !session.completedAt && firstSteps[session.guideId] &&
    (session.preparedIds.length > 0 || hasPracticeActivity(session, firstSteps[session.guideId])))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}
