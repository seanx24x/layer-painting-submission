import { getGuide } from "@/lib/guides";
import {
  readExplanationRequest,
  reviewedExplanation,
} from "@/lib/explanation";

export const runtime = "nodejs";
const responseHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  const input = await readExplanationRequest(request);
  if (!input) {
    return Response.json(
      { error: "Choose a guide, step and explanation style." },
      { status: 400, headers: responseHeaders },
    );
  }

  const guide = getGuide(input.guideSlug);
  const step = guide?.steps.find((candidate) => candidate.id === input.stepId);
  if (!step) {
    return Response.json(
      { error: "This guide or step is unavailable." },
      { status: 400, headers: responseHeaders },
    );
  }

  // Older clients retain a useful response; this retired UI endpoint no longer
  // invokes a model or exposes an unreviewed rewrite of physical instructions.
  return Response.json(reviewedExplanation(step), { headers: responseHeaders });
}
