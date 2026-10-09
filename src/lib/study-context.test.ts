import { strict as assert } from "node:assert";
import { test } from "node:test";
import { guides } from "./guides";
import { lessonExamples } from "./lesson-examples";
import { guideStudyContext, studyContextFromHref } from "./study-context";
import { paletteLessonChapters } from "./painting-lesson";

test("every authored demonstration retains its exact step palette when expanded", () => {
  let count = 0;
  for (const guide of guides) for (const step of guide.steps) {
    const examples = lessonExamples(guide.id, step.id);
    if (!examples.length) continue;
    const href = `/paint/${guide.slug}?step=${step.id}`;
    const expanded = studyContextFromHref(href);
    assert.equal(expanded?.returnHref, href);
    assert.deepEqual(expanded?.context, guideStudyContext(guide, step));
    assert.equal(expanded?.example?.technique, examples[0].technique);
    for (const example of examples) assert.ok(expanded?.context?.options[example.technique]?.length, `${guide.id}/${step.id}/${example.id}`);
    count++;
  }
  assert.ok(count > 150);
});

test("invalid or unrelated return routes never provide a guide palette", () => {
  for (const href of [undefined, "https://example.com", "//example.com", "/paint/missing", "/paint/salamanders-classic?step=missing", "/paint/salamanders-classic?step=base&other=1"]) {
    assert.equal(studyContextFromHref(href), undefined);
  }
});

test("a one-paint layer lesson does not instruct the user to introduce an unlisted highlight", () => {
  const target = studyContextFromHref("/paint/salamanders-classic?step=base")!;
  const palette = target.context!.options.layers![0].palette;
  const chapters = paletteLessonChapters("layers", palette);
  assert.equal(chapters.at(-1)?.name, "Refine and inspect");
  assert.ok(chapters.at(-1)?.instruction.includes(palette.coats[0].name));
  assert.ok(!chapters.map(chapter => chapter.instruction).join(" ").includes("blue"));
});
