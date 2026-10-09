import { guides } from "./guides";
import type { TechniqueId } from "./technique-study-types";

export type LessonExample = {
  id: string;
  technique: TechniqueId;
  chapterId: string;
  label: string;
  note?: string;
  workshop?: "explore" | "compare";
};

const workshopExamples: readonly LessonExample[] = (["layers", "edges", "recess", "drybrush"] as const).flatMap(technique => (["explore", "compare"] as const).map(workshop => ({
  id: `${technique}-${workshop}`, technique, chapterId: technique === "layers" ? "first-coat" : "stage-1", workshop,
  label: `${workshop === "explore" ? "Experiment with" : "Compare"} ${technique === "layers" || technique === "recess" ? "paint load" : "brush pressure"}`,
})));
const examples: readonly LessonExample[] = [
  ...workshopExamples,
  { id: "prepare-paint", technique: "layers", chapterId: "prepare", label: "Prepare a smooth test stroke" },
  { id: "load-brush", technique: "layers", chapterId: "load", label: "Load, unload and test the brush" },
  { id: "first-coat", technique: "layers", chapterId: "first-coat", label: "Watch a thin first coat" },
  { id: "second-coat", technique: "layers", chapterId: "second-coat", label: "Build coverage with a second coat" },
  { id: "recess-placement", technique: "recess", chapterId: "stage-1", label: "Place shade in a recess" },
  { id: "raised-edge", technique: "edges", chapterId: "stage-1", label: "Follow a raised edge" },
  { id: "fine-edge", technique: "edges", chapterId: "stage-2", label: "Make the next highlight finer" },
  {
    id: "drybrush-contact", technique: "drybrush", chapterId: "stage-1", label: "Skim the raised texture",
    note: "Watch the light contact on the raised surface. This studio uses a controlled-moisture method; follow this guide’s paper-towel preparation for its recipe.",
  },
  {
    id: "drybrush-light", technique: "drybrush", chapterId: "stage-3", label: "Keep the final highlights restrained",
    note: "Practise restrained contact with Moot Green. For this guide, brush from top to bottom.",
  },
];

// Deliberate editorial links, not inference from broad technique names. Oil
// washes, spill cleanup, airbrushing and varnishing have no matching simulation.
const stepExamples: Record<string, readonly string[]> = {
  "ultramarines-classic/base": ["first-coat", "prepare-paint", "load-brush", "second-coat"],
  "ultramarines-classic/shade": ["recess-placement"],
  "ultramarines-classic/edge": ["raised-edge"],
  "ultramarines-classic/fine": ["fine-edge", "raised-edge"],
  "salamanders-classic/base": ["first-coat", "prepare-paint", "load-brush", "second-coat"],
  "salamanders-classic/recover": ["drybrush-contact"],
  "salamanders-classic/light": ["drybrush-light"],
};

export function getLessonExample(id: string): LessonExample | undefined {
  return examples.find((example) => example.id === id);
}

export function lessonExamples(guideId: string, stepId: string): LessonExample[] {
  const authored = guides.find((guide) => guide.id === guideId)?.steps.find((step) => step.id === stepId)?.exampleIds;
  const matched = (stepExamples[`${guideId}/${stepId}`] ?? authored ?? []).flatMap((id) => {
    const example = getLessonExample(id);
    return example ? [example] : [];
  });
  const techniques = new Set(matched.map(example => example.technique));
  return [...matched, ...workshopExamples.filter(example => techniques.has(example.technique))];
}

export function lessonExample(guideId: string, stepId: string): LessonExample | undefined {
  return lessonExamples(guideId, stepId)[0];
}
