import type { Guide, GuideStep } from "./guides";
import { coachResponseSchema, reviewedCoachReply, type CoachResponse } from "./coach";
import { lessonExamples } from "./lesson-examples";

/** A cancelled conversation stays silent; transport failures use authored notes. */
export async function requestCoachReply(
  guide: Guide,
  step: GuideStep,
  question: string,
  signal: AbortSignal,
  options: { fetcher?: typeof fetch; timeoutSignal?: AbortSignal } = {},
): Promise<CoachResponse | null> {
  if (signal.aborted) return null;
  try {
    const response = await (options.fetcher ?? fetch)("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guideId: guide.id, stepId: step.id, question }),
      signal: AbortSignal.any([signal, options.timeoutSignal ?? AbortSignal.timeout(18_000)]),
    });
    if (!response.ok) throw new Error("Coach unavailable");
    const result = coachResponseSchema.parse(await response.json());
    if (signal.aborted) return null;
    if (result.exampleId && !lessonExamples(guide.id, step.id).some(example => example.id === result.exampleId)) throw new Error("Unknown example");
    return result;
  } catch {
    return signal.aborted ? null : reviewedCoachReply(guide, step, question, true);
  }
}
