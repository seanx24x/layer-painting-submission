import { strict as assert } from "node:assert";
import { test } from "node:test";
import { guides } from "./guides";
import { lessonExamples } from "./lesson-examples";
import { lessonChapters } from "./painting-lesson";
import { TECHNIQUE_ORDER } from "./painting-techniques";
import { studyContextFromHref } from "./study-context";
import { isTechniqueLessonId, resolveTechniqueLocation, techniqueChapter, techniqueHref } from "./technique-navigation";

test("every authored legacy chapter resolves to a canonical lesson and chapter", () => {
  for (const id of TECHNIQUE_ORDER) {
    for (const chapter of lessonChapters(id)) {
      const target = resolveTechniqueLocation({ hash: `#${id}/${chapter.id}` });
      assert.equal(target.lessonId, chapter.id === "light" ? "light" : id);
      assert.equal(target.chapterId, chapter.id === "light" ? "place" : chapter.id);
      const url = new URL(target.href, "https://layer.example");
      assert.equal(url.pathname, `/techniques/${target.lessonId}`);
      assert.equal(url.searchParams.get("chapter"), target.chapterId);
    }
  }
  assert.equal(resolveTechniqueLocation({ hash: "#layers" }).chapterId, "prepare");
  assert.equal(techniqueHref("layers", { chapter: "light" }), "/techniques/light?chapter=place");
});

test("canonical chapter selection wins while legacy entries retain their explicit destination", () => {
  assert.equal(resolveTechniqueLocation({ lesson: "edges", chapter: "stage-3", hash: "#layers/load" }).chapterId, "stage-3");
  assert.equal(resolveTechniqueLocation({ hash: "#recess/stage-2", fallbackLesson: "layers", fallbackChapter: "load" }).lessonId, "recess");
  assert.equal(resolveTechniqueLocation({ fallbackLesson: "layers", fallbackChapter: "load" }).chapterId, "load");
  assert.equal(resolveTechniqueLocation().chapterId, "prepare");
  assert.equal(techniqueChapter("drybrush", "missing").id, "stage-1");
});

test("guide entry preserves the authored example, safe return path and selected material", () => {
  let entries = 0;
  for (const guide of guides) for (const step of guide.steps) {
    const example = lessonExamples(guide.id, step.id)[0];
    if (!example) continue;
    const from = `/paint/${guide.slug}?step=${step.id}`;
    const material = studyContextFromHref(from)?.context?.options[example.technique]?.at(-1)?.id;
    assert.ok(material);
    const target = resolveTechniqueLocation({ from, material });
    assert.equal(target.lessonId, example.technique);
    assert.equal(target.chapterId, example.chapterId);
    assert.equal(target.returnHref, from);
    assert.equal(target.material, material);
    const params = new URL(target.href, "https://layer.example").searchParams;
    assert.equal(params.get("from"), from);
    assert.equal(params.get("material"), material);
    entries++;
  }
  assert.ok(entries > 150, "cover the guide collection, not just one fixture");
});

test("moving to the light foundation retains a valid guide material for the return journey", () => {
  const from = "/paint/ultramarines-classic?step=base";
  const material = studyContextFromHref(from)!.context!.options.layers![0].id;
  const target = resolveTechniqueLocation({ hash: "#layers/light", from, material });
  assert.equal(target.lessonId, "light");
  assert.equal(target.material, material);
  assert.equal(target.returnHref, from);
});

test("malformed lesson links never create unknown chapters or unsafe return routes", () => {
  for (const hash of ["#layers/missing", "#layers/load/extra", "#layers/", "#%", "#unknown", "#constructor", "#__proto__/place"]) {
    const result = resolveTechniqueLocation({ hash });
    assert.equal(result.lessonId, "layers", hash);
    assert.equal(result.chapterId, "prepare", hash);
  }
  for (const lesson of ["constructor", "__proto__", "/edges", "LIGHT", "light?from=https://example.com"]) {
    assert.equal(isTechniqueLessonId(lesson), false);
    assert.equal(resolveTechniqueLocation({ lesson }).lessonId, "layers");
  }
  for (const from of ["https://example.com", "//example.com", "/paint/missing", "/paint/ultramarines-classic?step=missing", "/paint/ultramarines-classic?step=base&next=https://example.com"]) {
    const target = resolveTechniqueLocation({ from, material: "blue-armour:macragge-blue" });
    assert.equal(target.returnHref, undefined);
    assert.equal(target.material, undefined);
    assert.equal(target.href, "/techniques/layers?chapter=prepare");
  }
  assert.equal(resolveTechniqueLocation({ lesson: "edges", chapter: "missing" }).chapterId, "stage-1");
  assert.equal(resolveTechniqueLocation({ from: "/paint/ultramarines-classic?step=base", material: "invented-paint" }).material, undefined);
  assert.equal(techniqueHref("layers", { material: "blue-armour:macragge-blue" }), "/techniques/layers?chapter=prepare");
});
