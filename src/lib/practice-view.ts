import type { PracticeSession } from "./session";

export type PracticeView = { stepId: string; mode: "step" | "summary" };
type SavedPosition = Pick<PracticeSession, "currentStepId" | "completedAt">;

/** Restore once. Later storage updates refresh saved data, never this tab's position. */
export function resolvePracticeView(
  current: PracticeView | null,
  stepIds: readonly string[],
  saved: SavedPosition | undefined,
  requestedStepId?: string,
  queryChanged = false,
): PracticeView {
  const requested = requestedStepId && stepIds.includes(requestedStepId) ? requestedStepId : undefined;
  if (current) {
    if (queryChanged && requested) return { stepId: requested, mode: "step" };
    if (current.mode === "summary" && !saved?.completedAt) return { ...current, mode: "step" };
    return current;
  }
  if (requested) return { stepId: requested, mode: "step" };
  const stepId = saved && stepIds.includes(saved.currentStepId) ? saved.currentStepId : stepIds[0];
  return { stepId, mode: saved?.completedAt ? "summary" : "step" };
}

/** A remote uncheck must not leave a stale claim that every step is complete. */
export function showsPracticeSummary(view: PracticeView, saved?: SavedPosition): boolean {
  return view.mode === "summary" && Boolean(saved?.completedAt);
}
