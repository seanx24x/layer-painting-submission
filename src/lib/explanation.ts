import { z } from "zod";
import type { GuideStep } from "./guides";

export const DEFAULT_EXPLANATION_MODEL = "google/gemini-2.5-flash-lite";
export const MAX_EXPLANATION_BODY_BYTES = 2_048;

const identifier = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const explanationRequestSchema = z
  .object({
    guideSlug: identifier,
    stepId: identifier,
    mode: z.enum(["simple", "detailed"]),
  })
  .strict();

export const explanationOutputSchema = z
  .object({
    explanation: z
      .string()
      .trim()
      .min(1)
      .max(700)
      .refine(
        (value) => !/[<>`]|https?:\/\/|www\./i.test(value),
        "Use plain text without markup or links.",
      ),
  })
  .strict();

export type ExplanationRequest = z.infer<typeof explanationRequestSchema>;
export type ExplanationMode = ExplanationRequest["mode"];
export interface ExplanationResponse {
  kind: "ai" | "fallback";
  explanation: string;
  sourceIds: string[];
  retryable: boolean;
}

export const explanationInstructions = [
  "Rewrite the supplied reviewed miniature-painting step. It is your only source.",
  "Use only the facts in action, detail and lookFor. Preserve the action and any conditions or precautions.",
  "Do not add paints, equipment, techniques, amounts, ratios, drying times, safety advice or explanations of causes that are absent from those fields.",
  "Do not claim to inspect the miniature, verify the result, or complete a step.",
  "Use friendly, direct English and plain text, without headings, lists, markdown, links or citations.",
  "Keep the explanation within 700 characters. Return only the requested structured object.",
].join(" ");

export function explanationPrompt(
  step: GuideStep,
  mode: ExplanationMode,
): string {
  const direction =
    mode === "simple"
      ? "Explain this step in one or two short, simple sentences."
      : "Explain the supplied action, detail and visual goal in up to four short sentences. Do not pad sparse source material.";
  return `${direction}\nReviewed step:\n${JSON.stringify({
    action: step.action,
    detail: step.detail,
    lookFor: step.lookFor,
  })}`;
}

/** Syntax validation only; Gateway validates availability of an operator override. */
export function explanationModel(override: string | undefined): string | null {
  if (override === undefined || override.trim() === "")
    return DEFAULT_EXPLANATION_MODEL;
  const model = override.trim();
  return model.length <= 160 &&
    /^[a-z0-9][a-z0-9.-]*\/[a-z0-9][a-z0-9._:-]*$/.test(model)
    ? model
    : null;
}

export function reviewedExplanation(
  step: GuideStep,
  retryable = false,
): ExplanationResponse {
  return {
    kind: "fallback",
    explanation: step.simpleExplanation,
    sourceIds: [...step.sourceIds],
    retryable,
  };
}

function generationIsRetryable(error: unknown): boolean {
  // GatewayError and APICallError both expose statusCode/isRetryable. Inspect
  // only those fields and bounded causes; never return provider messages/data.
  let current = error;
  for (let depth = 0; depth < 4; depth++) {
    if (typeof current !== "object" || current === null) break;
    if (
      "statusCode" in current &&
      typeof current.statusCode === "number" &&
      [400, 401, 402, 403, 404].includes(current.statusCode)
    ) return false;
    if ("isRetryable" in current && current.isRetryable === false) return false;
    current = "cause" in current ? current.cause : undefined;
  }
  return true;
}

/** The generator never controls source references or session progress. */
export async function explainStep(
  step: GuideStep,
  mode: ExplanationMode,
  generate: (prompt: string) => Promise<unknown>,
): Promise<ExplanationResponse> {
  try {
    const output = explanationOutputSchema.parse(
      await generate(explanationPrompt(step, mode)),
    );
    return {
      kind: "ai",
      explanation: output.explanation,
      sourceIds: [...step.sourceIds],
      retryable: false,
    };
  } catch (error) {
    return reviewedExplanation(step, generationIsRetryable(error));
  }
}

/** Bound actual bytes, including streamed requests without Content-Length. */
export async function readExplanationRequest(
  request: Request,
): Promise<ExplanationRequest | null> {
  const lengthHeader = request.headers.get("content-length");
  if (
    lengthHeader !== null &&
    (!/^\d+$/.test(lengthHeader) ||
      Number(lengthHeader) > MAX_EXPLANATION_BODY_BYTES)
  ) {
    return null;
  }
  if (!request.body) return null;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_EXPLANATION_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(body);
    const parsed = explanationRequestSchema.safeParse(JSON.parse(decoded));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
