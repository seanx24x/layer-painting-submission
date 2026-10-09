import type { GuidePaint, GuideStep } from "./guides";

export type MaterialInstruction =
  | { kind: "material"; text: string; paint: GuidePaint; area: string }
  | { kind: "explanation"; text: string };

/** The materials authoring template explicitly names its paint. Only recognise
 * that exact grammar and paints declared by the step; do not infer names, roles,
 * aliases or positional relationships. Unknown prose stays intact in the lesson.
 */
export function materialInstructions(
  step: Pick<GuideStep, "id" | "action" | "paintIds">,
  palette: readonly GuidePaint[],
): MaterialInstruction[] {
  if (step.id !== "materials") return [];
  const paints = palette.filter(paint => step.paintIds.includes(paint.id));
  return step.action.split(/(?<=[.!?])\s+/).map(text => {
    const matches = paints.filter(paint => text.startsWith(`Use ${paint.name} for `));
    if (matches.length !== 1) return { kind: "explanation", text };
    const paint = matches[0];
    const area = text.slice(`Use ${paint.name} for `.length);
    if (!area.trim()) return { kind: "explanation", text };
    return { kind: "material", text, paint, area };
  });
}
