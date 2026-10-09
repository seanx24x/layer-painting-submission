import { strict as assert } from "node:assert";
import { test } from "node:test";
import { LAYER_CHAPTERS, advanceLesson, chapterIndex, lessonChapters, lessonLocation } from "./painting-lesson";
import { paintStrokes } from "./shape-paint-motion";

test("chapters cover the entire lesson with no gaps and resolve at boundaries", () => {
  for (const id of ["layers", "edges", "recess", "drybrush"] as const) {
    const chapters = lessonChapters(id);
    assert.equal(chapters[0].start, 0);
    chapters.forEach((chapter, i) => {
      assert.ok(chapter.end > chapter.start);
      assert.equal(chapterIndex(chapters, chapter.start), i);
      if (i) assert.equal(chapters[i-1].end, chapter.start);
    });
    assert.equal(chapters.at(-1)!.end, id === "layers" ? 80 : 24);
  }
});
test("paint along clamps exactly to the next boundary, then resumes forward", () => {
  assert.deepEqual(advanceLesson(9.98, .1, 1, 80, 10), { time: 10, stopped: true });
  const chapter = LAYER_CHAPTERS[chapterIndex(LAYER_CHAPTERS, 10)];
  assert.deepEqual(advanceLesson(10, 1, .5, 80, chapter.end), { time: 10.5, stopped: false });
  assert.deepEqual(advanceLesson(79.9, 1, 1, 80), { time: 80, stopped: true });
});
test("chapter links are validated and all published chapters resolve", () => {
  for (const c of LAYER_CHAPTERS) assert.deepEqual(lessonLocation(`#layers/${c.id}`), { id: "layers", time: c.start });
  for (const bad of ["#nope/light", "#layers/missing", "#toString/light", "#constructor/light"]) assert.equal(lessonLocation(bad), null);
});
test("homepage technique links open their own lesson from the beginning", () => {
  for (const id of ["layers", "edges", "recess", "drybrush"] as const) {
    assert.deepEqual(lessonLocation(`#${id}`), { id, time: 0 });
  }
  for (const bad of ["#unknown", "#constructor", "#edges/", "#edges/stage-1/extra"]) {
    assert.equal(lessonLocation(bad), null);
  }
});
test("paint starts after preparation and camera settling, with drying gaps", () => {
  assert.ok(paintStrokes.every(s => s.start >= 37));
  assert.ok(paintStrokes.filter(s => s.layer === 0).every(s => s.end < 55));
  assert.ok(paintStrokes.filter(s => s.layer === 1).every(s => s.start >= 60 && s.end < 70));
  assert.ok(paintStrokes.filter(s => s.layer === 2).every(s => s.start >= 72 && s.end < 78));
  const first = paintStrokes.filter(s => s.layer === 0);
  const second = paintStrokes.filter(s => s.layer === 1);
  first.forEach((s,i) => { assert.equal(s.longitude, second[i].longitude); assert.equal(s.width, second[i].width); });
});
