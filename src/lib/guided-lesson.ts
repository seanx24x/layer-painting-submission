import { lessonChapters, type LessonChapter } from "./painting-lesson";
import { FLAT_STROKES } from "./flat-painting";
import type { TechniqueId } from "./technique-study-types";

export type GuidedPhase = "watch" | "explore" | "compare" | "practice";
export type GuidedMoment = { chapterId: string; phase: GuidedPhase };

const PAINT_PHASES: readonly GuidedPhase[] = ["watch", "explore", "compare", "practice"];
const PREPARATION_PHASES: readonly GuidedPhase[] = ["watch", "practice"];

function chapterFor(technique: TechniqueId, chapterId: string) {
  return lessonChapters(technique).find(chapter => chapter.id === chapterId);
}

function strokesFor(technique: TechniqueId, chapter: LessonChapter) {
  return FLAT_STROKES[technique].filter(stroke => stroke.start >= chapter.start && stroke.end <= chapter.end);
}

/** Experiments belong to chapters with authored surface contact, never preparation. */
export function phasesForChapter(technique: TechniqueId, chapterId: string): readonly GuidedPhase[] {
  const chapter = chapterFor(technique, chapterId);
  if (!chapter) return [];
  return strokesFor(technique, chapter).length ? PAINT_PHASES : PREPARATION_PHASES;
}

/** Moving through a lesson does not mark any physical practice as completed. */
export function nextGuidedMoment(technique: TechniqueId, chapterId: string, phase: GuidedPhase): GuidedMoment | null {
  const phases = phasesForChapter(technique, chapterId);
  const phaseIndex = phases.indexOf(phase);
  if (phaseIndex < 0) return null;
  const nextPhase = phases[phaseIndex + 1];
  if (nextPhase) return { chapterId, phase: nextPhase };
  const chapters = lessonChapters(technique);
  const nextChapter = chapters[chapters.findIndex(chapter => chapter.id === chapterId) + 1];
  return nextChapter ? { chapterId: nextChapter.id, phase: "watch" } : null;
}

/** A paused experiment shows genuine contact inside this chapter's first stroke. */
export function chapterContactTime(technique: TechniqueId, chapterId: string): number {
  const chapter = chapterFor(technique, chapterId);
  if (!chapter) return 0;
  // These moments show the palette test and excess removal without requiring motion.
  if (technique === "layers" && chapterId === "prepare") return 20.3;
  if (technique === "layers" && chapterId === "load") return 29.2;
  const stroke = strokesFor(technique, chapter)[0];
  return stroke ? (stroke.start + stroke.end) / 2 : chapter.start;
}

/** Finish the authored marks and lift, while staying on this side of the next chapter. */
export function chapterResultTime(technique: TechniqueId, chapterId: string): number {
  const chapter = chapterFor(technique, chapterId);
  if (!chapter) return 0;
  const lastStroke = strokesFor(technique, chapter).at(-1);
  return Math.min(chapter.end - .001, lastStroke ? lastStroke.end + .7 : chapter.end - .001);
}

/** Still mode always lands on an authored teaching moment, never an arbitrary frame. */
export function lessonCheckpoints(technique: TechniqueId, chapterId: string) {
  const chapter = chapterFor(technique, chapterId);
  if (!chapter) return [];
  const contact = chapterContactTime(technique, chapterId);
  return [
    { label: "Before", value: chapter.start },
    ...(contact > chapter.start ? [{ label: "Contact", value: contact }] : []),
    { label: "Result", value: chapterResultTime(technique, chapterId) },
  ];
}

export function nearestLessonCheckpoint(technique: TechniqueId, chapterId: string, time: number) {
  const checkpoints = lessonCheckpoints(technique, chapterId);
  if (!checkpoints.length) return 0;
  const current = Number.isFinite(time) ? time : checkpoints[0].value;
  return checkpoints.reduce((nearest, point) => Math.abs(point.value - current) < Math.abs(nearest.value - current) ? point : nearest).value;
}

/** Reviewed coach actions retain chapter identity and resolve into the guided sequence. */
export function resolveGuidedFocus(
  technique: TechniqueId,
  chapterId: string,
  workshop?: "explore" | "compare",
): GuidedMoment | null {
  const phases = phasesForChapter(technique, chapterId);
  if (!phases.length) return null;
  return { chapterId, phase: workshop && phases.includes(workshop) ? workshop : "watch" };
}

/** Coach entry is a paused demonstration, never a physical-practice completion. */
export function resolveLessonEntry(
  technique: TechniqueId,
  chapterId: string,
  workshop?: "explore" | "compare",
) {
  const moment = resolveGuidedFocus(technique, chapterId, workshop);
  if (!moment) return null;
  return {
    ...moment,
    time: moment.phase === "watch" ? chapterFor(technique, chapterId)!.start : chapterResultTime(technique, chapterId),
    amount: moment.phase === "compare" ? .85 : .4,
    reference: false,
  };
}
