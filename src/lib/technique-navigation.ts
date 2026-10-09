import { TECHNIQUE_LESSONS, type TechniqueChapter, type TechniqueLessonId } from "./technique-lessons";
import { studyContextFromHref } from "./study-context";

export type TechniqueLinkOptions = { chapter?: string; from?: string; material?: string };
export type TechniqueLocationInput = TechniqueLinkOptions & {
  lesson?: string;
  hash?: string;
  fallbackLesson?: TechniqueLessonId;
  fallbackChapter?: string;
};
export type TechniqueLocation = {
  lessonId: TechniqueLessonId;
  chapterId: string;
  returnHref?: string;
  material?: string;
  href: string;
};

export function isTechniqueLessonId(value: unknown): value is TechniqueLessonId {
  return typeof value === "string" && Object.hasOwn(TECHNIQUE_LESSONS, value);
}

export function techniqueChapter(id: TechniqueLessonId, chapter?: string): TechniqueChapter {
  const chapters = TECHNIQUE_LESSONS[id].chapters;
  return chapters.find(item => item.id === chapter) ?? chapters[0];
}

function safeContext(lesson: TechniqueLessonId, from?: string, material?: string) {
  const target = studyContextFromHref(from);
  const options = lesson === "light"
    ? Object.values(target?.context?.options ?? {}).flat()
    : target?.context?.options[lesson] ?? [];
  return {
    returnHref: target?.returnHref,
    material: options.some(option => option.id === material) ? material : undefined,
  };
}

/** Only authored painting steps and their material IDs may travel through links. */
export function techniqueHref(id: TechniqueLessonId, options: TechniqueLinkOptions = {}): string {
  const migrated = id === "layers" && options.chapter === "light";
  const lesson = migrated ? "light" : id;
  const chapter = techniqueChapter(lesson, migrated ? "place" : options.chapter);
  const context = safeContext(lesson, options.from, options.material);
  const params = new URLSearchParams({ chapter: chapter.id });
  if (context.returnHref) params.set("from", context.returnHref);
  if (context.material) params.set("material", context.material);
  return `/techniques/${lesson}?${params.toString()}`;
}

function legacyLocation(hash?: string): { lessonId: TechniqueLessonId; chapterId: string } | undefined {
  if (!hash) return undefined;
  const [id, chapter, ...extra] = hash.replace(/^#/, "").split("/");
  if (extra.length || !isTechniqueLessonId(id)) return undefined;
  if (id === "layers" && chapter === "light") return { lessonId: "light", chapterId: "place" };
  if (chapter !== undefined && !TECHNIQUE_LESSONS[id].chapters.some(item => item.id === chapter)) return undefined;
  return { lessonId: id, chapterId: techniqueChapter(id, chapter).id };
}

/**
 * Explicit canonical selection wins over a legacy hash. A valid old hash wins
 * over the supplied entry point; otherwise the authored guide example is used.
 * Invalid chapters fall back within the selected lesson without inventing IDs.
 */
export function resolveTechniqueLocation(input: TechniqueLocationInput = {}): TechniqueLocation {
  const context = studyContextFromHref(input.from);
  const legacy = legacyLocation(input.hash);
  let lessonId: TechniqueLessonId;
  let chapter: string | undefined;
  if (isTechniqueLessonId(input.lesson)) {
    lessonId = input.lesson;
    chapter = input.chapter;
  } else if (legacy) {
    lessonId = legacy.lessonId;
    chapter = legacy.chapterId;
  } else if (isTechniqueLessonId(input.fallbackLesson)) {
    lessonId = input.fallbackLesson;
    chapter = input.fallbackChapter;
  } else {
    lessonId = context?.example?.technique ?? "layers";
    chapter = context?.example?.chapterId;
  }
  if (lessonId === "layers" && chapter === "light") {
    lessonId = "light";
    chapter = "place";
  }
  const chapterId = techniqueChapter(lessonId, chapter).id;
  const safe = safeContext(lessonId, input.from, input.material);
  return {
    lessonId,
    chapterId,
    ...safe,
    href: techniqueHref(lessonId, { chapter: chapterId, from: safe.returnHref, material: safe.material }),
  };
}
