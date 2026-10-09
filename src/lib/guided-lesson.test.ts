import { strict as assert } from "node:assert";
import { test } from "node:test";
import { chapterContactTime, chapterResultTime, lessonCheckpoints, nearestLessonCheckpoint, nextGuidedMoment, phasesForChapter, resolveGuidedFocus, type GuidedMoment } from "./guided-lesson";
import { lessonChapters } from "./painting-lesson";
import { FLAT_STROKES, flatPaintFrame } from "./flat-painting";
import { WORKSHOPS } from "./workshop";

const techniques = ["layers", "edges", "recess", "drybrush"] as const;

test("each tutorial visits every authored chapter and ends after its final practice invitation", () => {
  for (const technique of techniques) {
    const chapters = lessonChapters(technique);
    const expected = chapters.flatMap(chapter => phasesForChapter(technique, chapter.id).map(phase => ({ chapterId: chapter.id, phase })));
    const visited: GuidedMoment[] = [];
    let moment: GuidedMoment | null = { chapterId: chapters[0].id, phase: "watch" };
    while (moment) {
      visited.push(moment);
      assert.ok(visited.length <= expected.length, "the guided sequence must not cycle");
      moment = nextGuidedMoment(technique, moment.chapterId, moment.phase);
    }
    assert.deepEqual(visited, expected);
    assert.equal(visited.at(-1)?.phase, "practice");
    assert.equal(visited.at(-1)?.chapterId, chapters.at(-1)?.id);
  }
});

test("preparation chapters omit experiments while every painting chapter includes them", () => {
  for (const chapterId of ["light", "prepare", "load"]) {
    assert.deepEqual(phasesForChapter("layers", chapterId), ["watch", "practice"]);
    assert.equal(nextGuidedMoment("layers", chapterId, "explore"), null);
  }
  for (const technique of techniques) {
    for (const chapter of lessonChapters(technique)) {
      if (technique === "layers" && ["light", "prepare", "load"].includes(chapter.id)) continue;
      assert.deepEqual(phasesForChapter(technique, chapter.id), ["watch", "explore", "compare", "practice"]);
    }
  }
});

test("each contact checkpoint belongs to the current chapter and its actual stroke", () => {
  for (const technique of techniques) {
    for (const chapter of lessonChapters(technique)) {
      const contact = chapterContactTime(technique, chapter.id);
      const result = chapterResultTime(technique, chapter.id);
      assert.ok(contact >= chapter.start && contact < chapter.end);
      assert.ok(result >= contact && result < chapter.end);
      const strokes = FLAT_STROKES[technique].filter(stroke => stroke.start >= chapter.start && stroke.end <= chapter.end);
      if (strokes.length) {
        assert.ok(strokes.some(stroke => contact > stroke.start && contact < stroke.end));
        assert.ok(result >= strokes.at(-1)!.end, "comparison includes all marks from its own chapter");
      } else if (chapter.id === "light") {
        assert.equal(contact, chapter.start);
      } else {
        assert.ok(contact > chapter.start, "preparation stills show the action rather than duplicate the untouched starting frame");
      }
    }
  }
});

test("reduced-motion preparation checkpoints expose the test stroke and excess removal", () => {
  assert.equal(chapterContactTime("layers", "prepare"), 20.3);
  assert.equal(chapterContactTime("layers", "load"), 29.2);
});

test("entering still mode chooses the nearest authored checkpoint without changing the lesson", () => {
  for (const technique of techniques) {
    for (const chapter of lessonChapters(technique)) {
      const points = lessonCheckpoints(technique, chapter.id);
      for (const point of points) {
        assert.equal(nearestLessonCheckpoint(technique, chapter.id, point.value), point.value);
        assert.equal(nearestLessonCheckpoint(technique, chapter.id, point.value + .01), point.value);
      }
      assert.equal(nearestLessonCheckpoint(technique, chapter.id, Number.NaN), chapter.start);
      for (let time = chapter.start; time < chapter.end; time += .73) {
        const nearest = nearestLessonCheckpoint(technique, chapter.id, time);
        assert.ok(points.some(point => point.value === nearest));
        assert.equal(Math.abs(nearest - time), Math.min(...points.map(point => Math.abs(point.value - time))));
      }
    }
  }
  assert.deepEqual(lessonCheckpoints("layers", "missing"), []);
  assert.equal(nearestLessonCheckpoint("layers", "missing", 50), 0);
});

test("painted result checkpoints show completed marks with the brush lifted fully out of view", () => {
  for (const technique of techniques) {
    for (const chapter of lessonChapters(technique)) {
      if (!phasesForChapter(technique, chapter.id).includes("explore")) continue;
      const result = flatPaintFrame(technique, chapterResultTime(technique, chapter.id));
      assert.equal(result.brush.contact, false, `${technique}/${chapter.id} must end contact`);
      assert.equal(result.brush.opacity, 0, `${technique}/${chapter.id} must finish the release fade`);
    }
  }
});

test("coach workshop actions preserve their reviewed chapters and resolve to the requested phase", () => {
  for (const technique of techniques) {
    const chapterId = WORKSHOPS[technique].chapter;
    for (const phase of ["explore", "compare"] as const) {
      assert.deepEqual(resolveGuidedFocus(technique, chapterId, phase), { chapterId, phase });
    }
    for (const chapter of lessonChapters(technique)) {
      assert.deepEqual(resolveGuidedFocus(technique, chapter.id), { chapterId: chapter.id, phase: "watch" });
    }
  }
  assert.deepEqual(resolveGuidedFocus("layers", "prepare", "explore"), { chapterId: "prepare", phase: "watch" });
  assert.deepEqual(resolveGuidedFocus("layers", "light", "compare"), { chapterId: "light", phase: "watch" });
});

test("invalid chapter links cannot advance or become workshop entry points", () => {
  for (const technique of techniques) {
    for (const invalid of ["missing", "", "constructor"]) {
      assert.deepEqual(phasesForChapter(technique, invalid), []);
      assert.equal(nextGuidedMoment(technique, invalid, "practice"), null);
      assert.equal(resolveGuidedFocus(technique, invalid, "explore"), null);
      assert.equal(chapterContactTime(technique, invalid), 0);
      assert.equal(chapterResultTime(technique, invalid), 0);
    }
  }
});
