import { PAINTING_TECHNIQUES, type PaintingStage } from "./painting-techniques";
import type { TechniqueId } from "./technique-study-types";
import type { StudyPalette } from "./study-palette";

export type LessonChapter = PaintingStage & { id: string; camera: "overview" | "palette" | "contact" | "inspect" };
const chapter = (id: string, name: string, detail: string, start: number, end: number, instruction: string, cue: string, camera: LessonChapter["camera"], colour = "#285cdf"): LessonChapter => ({ id, name, detail, start, end, instruction, cue, camera, colour });
export const LAYER_CHAPTERS: readonly LessonChapter[] = [
  chapter("light", "Find the light", "Plan where the brightness belongs", 0, 10, "Imagine a light above and to the left. The upper surface faces it; the underside turns away. Keep this direction in mind when you add highlights. Your desk lamp helps you see; this is the light you choose to paint.", "Choose the light before the highlight.", "overview", "#c8c5bc"),
  chapter("prepare", "Prepare the paint", "Judge the mark, not a magic ratio", 10, 25, "Mix a little water into your paint on the palette, then test a stroke. For this layer, look for smooth coverage with the fine surface texture still visible. Add water gradually: different paints need different amounts. An opaque paint can still be thin.", "Smooth flow. Fine texture still visible.", "palette"),
  chapter("load", "Load and test", "Thin paint, controlled brush", 25, 35, "Load the brush, then draw off excess liquid on the palette and reform the point. Test a short stroke before touching the model. A bead that floods the surface means there is too much liquid on the brush, even if the mixture is right.", "Remove the excess. Keep the point.", "palette"),
  chapter("first-coat", "Lay the first coat", "Let the surface show through", 35, 55, "Pull a light, controlled stroke across the surface and lift away. Overlap the next pass without scrubbing the same spot. Some primer showing through is expected; do not chase complete coverage while the coat is drying.", "Contact. Pull. Lift.", "contact"),
  chapter("second-coat", "Dry, then build coverage", "Same paint. A more even finish.", 55, 70, "Let the first coat dry before adding another. The time jump here is illustrative, not a drying timer. Repeat the same paint in light passes: the finish becomes more opaque without changing the paint colour.", "Same paint. More coverage.", "contact"),
  chapter("depth", "Add depth and inspect", "Keep the shadows; lift the light", 70, 80, "Once the base is dry, add a restrained lighter layer to the upper-left region. Leave the lower surface darker. Compare the first coat, second coat and finished highlight to see the difference between coverage and brightness.", "Lighter paint only where it belongs.", "inspect", "#599ddd"),
];
export function lessonChapters(id: TechniqueId): readonly LessonChapter[] {
  return id === "layers" ? LAYER_CHAPTERS : PAINTING_TECHNIQUES[id].stages.map((s, i) => ({ ...s, id: `stage-${i + 1}`, start: i === 0 ? 0 : s.start, end: i === 2 ? 24 : PAINTING_TECHNIQUES[id].stages[i + 1].start, camera: "contact" }));
}
/** Keep the teaching language honest when a guide repeats one named paint. */
export function paletteLessonChapters(id: TechniqueId, palette?: StudyPalette): readonly LessonChapter[] {
  const chapters = lessonChapters(id);
  if (!palette) return chapters;
  return chapters.map((chapter, index) => {
    const paint = palette.coats[id === "layers" ? (index < 4 ? 0 : index === 4 ? 1 : 2) : index];
    const result = { ...chapter, colour: paint.hex };
    if (id === "layers" && chapter.id === "depth" && palette.coats[2].id === palette.coats[0].id) {
      return { ...result, name: "Refine and inspect", detail: "A controlled final pass", instruction: `Once the previous coat is dry, practise a restrained final pass with ${paint.name}. Keep the application thin and preserve the surface detail. This step uses the same paint throughout; follow the guide for later highlights.`, cue: "Same paint. A controlled final pass." };
    }
    if (id === "edges" && index > 0 && paint.id === palette.coats[index-1].id) {
      return { ...result, instruction: index === 1 ? `Use ${paint.name} again for a finer pass. Let the earlier paint dry, keep the line narrow and avoid building a ridge.` : `Use tiny touches of ${paint.name} on selected light-facing corners. Keep the marks small and inspect the result before adding more.` };
    }
    if (id === "drybrush" && index === 2 && paint.id === palette.coats[1].id) {
      return { ...result, instruction: `Use very little ${paint.name} for the final passes. Focus on the highest texture and let the previous passes dry before building more coverage.`, cue: "Less paint. Less contact." };
    }
    return result;
  });
}
export function chapterIndex(chapters: readonly LessonChapter[], time: number) {
  return Math.max(0, chapters.findLastIndex(c => time >= c.start));
}
export function advanceLesson(time: number, delta: number, speed: number, duration: number, stopAt?: number) {
  const limit = stopAt ?? duration;
  const next = Math.min(limit, time + Math.max(0, delta) * speed);
  return { time: next, stopped: next >= limit };
}
export function lessonLocation(hash: string): { id: TechniqueId; time: number } | null {
  const [id, slug, ...extra] = hash.replace(/^#/, "").split("/");
  if (extra.length || !Object.hasOwn(PAINTING_TECHNIQUES, id)) return null;
  const typed = id as TechniqueId;
  if (slug === undefined) return { id: typed, time: 0 };
  const c = lessonChapters(typed).find(c => c.id === slug);
  return c ? { id: typed, time: c.start } : null;
}
export function lessonCue(time: number, fallback: string) {
  if (time < 10) return time < 3 ? "Imagine a light above and to the left." : time < 6 ? "Upper planes face the light." : "Preserve the shadow underneath.";
  if (time < 25) return time < 15 ? "Add a little water. Mix thoroughly." : time < 20 ? "Test the paint on a textured surface." : "A smooth stroke; the texture remains.";
  if (time < 35) return time < 28 ? "Load the brush." : time < 31 ? "Draw off the excess and reform the point." : "Test a controlled stroke before painting.";
  if (time >= 55 && time < 60) return "Let the first coat dry. Time passes here.";
  if (time >= 70 && time < 72) return "Basecoat dry. Now change to a lighter paint.";
  return fallback;
}
export const LESSON_SOURCES = [
  { name: "Ángel Giráldez · preparation, dilution and layers", url: "https://www.redgrasscreative.com/wp-content/uploads/2023/06/redgrass-free-painting-book-V2-2023-1-1.pdf" },
  { name: "Roman Lappat · planning light and shadow", url: "https://massivevoodoo.blogspot.com/2010/08/tutorial-zenithal-lightning-work-order.html" },
  { name: "Richard Gray · moisture, glazes and light placement", url: "https://richardgraycreations.com/how-to-paint-a-saturnine-dreadnought-imperial-fists-part-1/" },
  { name: "Artis Opus · controlled drybrush moisture", url: "https://store.artis-opus.com/products/dampening-pad-preorder" },
];

export const CHAPTER_OUTCOMES: Record<string, string> = {
  light: "You can point to the light-facing area and the shadow underneath.",
  prepare: "The test stroke flows smoothly without forming a puddle.",
  load: "The brush leaves a controlled mark, without a bead of liquid.",
  "first-coat": "Some primer remains visible. The surface detail is still clear.",
  "second-coat": "Coverage improves without hiding surface detail.",
  depth: "The lighter area follows your chosen light direction.",
};
