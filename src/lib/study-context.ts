import { guides, type Guide, type GuideStep } from "./guides";
import { lessonExamples } from "./lesson-examples";
import { studyPaletteOptions, type StudyPaletteOption } from "./study-palette";
import type { TechniqueId } from "./technique-study-types";

export type StudyContext = {
  faction: string;
  stepTitle: string;
  options: Partial<Record<TechniqueId, StudyPaletteOption[]>>;
};

export function guideStudyContext(guide: Guide, step: GuideStep): StudyContext {
  const techniques = [...new Set(lessonExamples(guide.id, step.id).map(example => example.technique))];
  return {
    faction: guide.faction,
    stepTitle: step.title,
    options: Object.fromEntries(techniques.map(technique => [technique, studyPaletteOptions(guide, step, technique)])),
  };
}

/** Resolve only authored painting routes, retaining the same step in the full lesson. */
export function studyContextFromHref(from?: string) {
  if (typeof from !== "string") return undefined;
  const match = from.match(/^\/paint\/([a-z0-9-]+)(?:\?step=([a-z0-9-]+))?$/);
  const guide = match && guides.find(guide => guide.slug === match[1]);
  const step = guide?.steps.find(step => step.id === match?.[2]) ?? (!match?.[2] ? guide?.steps[0] : undefined);
  if (!guide || !step) return undefined;
  const example = lessonExamples(guide.id, step.id)[0];
  return {
    returnHref: from!,
    context: example ? guideStudyContext(guide, step) : undefined,
    example,
  };
}
