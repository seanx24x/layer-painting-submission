import { generateText, Output } from "ai";
import { guides } from "@/lib/guides";
import { explanationModel } from "@/lib/explanation";
import { answerCoach, coachInstructions, coachOutputSchema, readCoachRequest, reviewedCoachReply } from "@/lib/coach";

export const runtime = "nodejs";
export const maxDuration = 20;
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  const input = await readCoachRequest(request);
  if (!input) return Response.json({ error: "Choose a lesson and ask a question of 500 characters or fewer." }, { status: 400, headers });
  const guide = guides.find((candidate) => candidate.id === input.guideId);
  const step = guide?.steps.find((candidate) => candidate.id === input.stepId);
  if (!guide || !step) return Response.json({ error: "This lesson step is unavailable." }, { status: 400, headers });
  const model = explanationModel(process.env.AI_GATEWAY_MODEL);
  const authenticated = Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL === "1");
  if (!model || !authenticated) return Response.json(reviewedCoachReply(guide, step, input.question), { headers });
  const result = await answerCoach(guide, step, input.question, async (prompt) => {
    const { output } = await generateText({
      model, instructions: coachInstructions, prompt,
      output: Output.object({ schema: coachOutputSchema }),
      reasoning: "none", maxOutputTokens: 550, maxRetries: 0,
      timeout: 15_000, abortSignal: request.signal,
    });
    return output;
  });
  return Response.json(result, { headers });
}
