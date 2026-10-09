import { strict as assert } from "node:assert";
import { test } from "node:test";
import { paletteTechniqueChapter, TECHNIQUE_LESSONS, TECHNIQUE_LESSON_ORDER, TECHNIQUE_LESSON_SOURCES } from "./technique-lessons";
import { TECHNIQUE_ORDER } from "./painting-techniques";
import { lessonChapters } from "./painting-lesson";
import { guides } from "./guides";
import { lessonExamples } from "./lesson-examples";
import { studyPaletteOptions, type StudyPalette } from "./study-palette";

test("every technique chapter has a starting state, action, outcome, recovery and verified sources", () => {
  assert.deepEqual(TECHNIQUE_LESSON_ORDER, ["light", ...TECHNIQUE_ORDER]);
  assert.equal(new Set(TECHNIQUE_LESSON_ORDER).size, Object.keys(TECHNIQUE_LESSONS).length);
  const sourceIds = new Set(TECHNIQUE_LESSON_SOURCES.map(source => source.id));
  assert.equal(sourceIds.size, TECHNIQUE_LESSON_SOURCES.length);
  for (const source of TECHNIQUE_LESSON_SOURCES) {
    assert.equal(new URL(source.url).protocol, "https:");
    assert.match(source.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Number.isFinite(Date.parse(source.verifiedAt)));
  }
  let count = 0;
  for (const id of TECHNIQUE_LESSON_ORDER) {
    const lesson = TECHNIQUE_LESSONS[id];
    assert.equal(lesson.id, id);
    assert.ok(lesson.label && lesson.outcome && lesson.intro);
    assert.equal(new Set(lesson.chapters.map(chapter => chapter.id)).size, lesson.chapters.length);
    for (const chapter of lesson.chapters) {
      for (const field of ["title", "prepared", "instruction", "lookFor", "mistake", "practice"] as const) {
        assert.ok(chapter[field].trim(), `${id}/${chapter.id} needs ${field}`);
      }
      assert.ok(chapter.sourceIds.length, `${id}/${chapter.id} needs a teaching reference`);
      for (const sourceId of chapter.sourceIds) assert.ok(sourceIds.has(sourceId), `${id}/${chapter.id}: ${sourceId}`);
      count++;
    }
  }
  assert.equal(count, 17);
});

test("brush chapter IDs remain compatible and the light foundation has its own sequence", () => {
  for (const id of TECHNIQUE_ORDER) {
    assert.deepEqual(TECHNIQUE_LESSONS[id].chapters.map(chapter => chapter.id), lessonChapters(id).filter(chapter => chapter.id !== "light").map(chapter => chapter.id));
  }
  assert.deepEqual(TECHNIQUE_LESSONS.light.chapters.map(chapter => chapter.id), ["place", "read", "paint"]);
});

test("guide chapter instructions name the exact selected paint while keeping the prepared state", () => {
  const originals = JSON.stringify(TECHNIQUE_LESSONS);
  let count = 0;
  for (const guide of guides) for (const step of guide.steps) {
    const techniques = new Set(lessonExamples(guide.id, step.id).map(example => example.technique));
    for (const technique of techniques) for (const { palette } of studyPaletteOptions(guide, step, technique)) {
      TECHNIQUE_LESSONS[technique].chapters.forEach((chapter, index) => {
        const result = paletteTechniqueChapter(technique, chapter, palette);
        const expected = palette.coats[technique === "layers" ? index < 3 ? 0 : index === 3 ? 1 : 2 : index];
        assert.ok(result.instruction.includes(expected.name), `${guide.id}/${step.id}/${technique}/${chapter.id}: ${expected.name}`);
        assert.equal(result.id, chapter.id);
        assert.equal(result.prepared, chapter.prepared, "palette attribution must not replace the required preparation");
        assert.deepEqual(result.sourceIds, chapter.sourceIds);
        count++;
      });
    }
  }
  assert.ok(count > 500, "inspect the full collection and multi-material options");
  assert.equal(JSON.stringify(TECHNIQUE_LESSONS), originals, "shared lesson data stays immutable");
});

test("repeated paints adapt the entire teaching card rather than only its instruction", () => {
  const paint = { id: "test-coat", name: "Authored coat", hex: "#526070" };
  const palette: StudyPalette = { base: { id: "test-base", name: "Authored base", hex: "#203040" }, coats: [paint, paint, paint] };
  for (const [technique, chapterId] of [["layers", "depth"], ["edges", "stage-2"], ["edges", "stage-3"], ["drybrush", "stage-3"]] as const) {
    const chapter = TECHNIQUE_LESSONS[technique].chapters.find(chapter => chapter.id === chapterId)!;
    const adapted = paletteTechniqueChapter(technique, chapter, palette);
    for (const field of ["title", "instruction", "lookFor", "mistake", "practice"] as const) {
      assert.notEqual(adapted[field], chapter[field], `${technique}/${chapterId}: adapt ${field}`);
    }
    assert.doesNotMatch(`${adapted.title} ${adapted.instruction} ${adapted.lookFor} ${adapted.practice}`, /lighter|brighter|two distinct/i);
    assert.equal(adapted.prepared, chapter.prepared);
  }
});

test("different named paints with equal screen swatches keep their authored highlight sequence", () => {
  const palette: StudyPalette = {
    base: { id: "base", name: "Base paint", hex: "#222222" },
    coats: [
      { id: "first", name: "First highlight paint", hex: "#555555" },
      { id: "second", name: "Second highlight paint", hex: "#555555" },
      { id: "third", name: "Final highlight paint", hex: "#555555" },
    ],
  };
  for (const technique of TECHNIQUE_ORDER) for (const chapter of TECHNIQUE_LESSONS[technique].chapters) {
    const result = paletteTechniqueChapter(technique, chapter, palette);
    assert.equal(result.title, chapter.title, "matching screen hex values must not collapse distinct paints");
    assert.equal(result.lookFor, chapter.lookFor);
    assert.equal(result.practice, chapter.practice);
  }
  const partial: StudyPalette = { ...palette, coats: [palette.coats[0], palette.coats[1], palette.coats[1]] };
  assert.notEqual(paletteTechniqueChapter("edges", TECHNIQUE_LESSONS.edges.chapters[2], partial).title, TECHNIQUE_LESSONS.edges.chapters[2].title);
  assert.notEqual(paletteTechniqueChapter("drybrush", TECHNIQUE_LESSONS.drybrush.chapters[2], partial).title, TECHNIQUE_LESSONS.drybrush.chapters[2].title);
});

test("standalone lessons and light chapters do not acquire guide paint instructions", () => {
  const paint = { id: "test", name: "Test paint", hex: "#123456" };
  const palette: StudyPalette = { base: paint, coats: [paint, paint, paint] };
  for (const id of TECHNIQUE_LESSON_ORDER) for (const chapter of TECHNIQUE_LESSONS[id].chapters) {
    assert.equal(paletteTechniqueChapter(id, chapter), chapter);
  }
  for (const chapter of TECHNIQUE_LESSONS.light.chapters) {
    assert.equal(paletteTechniqueChapter("light", chapter, palette), chapter);
  }
});
