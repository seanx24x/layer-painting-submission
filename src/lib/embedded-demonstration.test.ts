import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chapterResultTime, phasesForChapter, resolveLessonEntry } from "./guided-lesson";
import { advanceLesson, lessonChapters } from "./painting-lesson";
import { describeExperiment, experimentFactors, WORKSHOPS } from "./workshop";
import type { TechniqueId } from "./technique-study-types";

// Render the real player without a browser or a replacement component. Only the
// stylesheet import is ignored; focus, scrolling and playback remain runtime QA.
const player = (async () => {
  const styles = registerHooks({
    load(url, context, nextLoad) {
      return url.endsWith(".css")
        ? { format: "module", source: "export {};", shortCircuit: true }
        : nextLoad(url, context);
    },
  });
  try { return (await import("../components/ShapePaintingStudy")).ShapePaintingStudy; }
  finally { styles.deregister(); }
})();

async function renderPlayer(technique: TechniqueId, chapterId: string, embedded = true) {
  const Player = await player;
  type PlayerProps = NonNullable<Parameters<typeof Player>[0]>;
  return renderToStaticMarkup(createElement<PlayerProps>(Player, {
    embedded, initialTechnique: technique, initialChapterId: chapterId,
  }));
}

function buttonLabels(markup: string) {
  return [...markup.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)]
    .map(match => match[1].replace(/<[^>]+>/g, "").trim());
}

const techniques = ["layers", "edges", "recess", "drybrush"] as const;

test("every embedded chapter has one demonstration and no parallel curriculum or practice action", async () => {
  for (const technique of techniques) {
    for (const chapter of lessonChapters(technique)) {
      const html = await renderPlayer(technique, chapter.id);
      const buttons = buttonLabels(html);
      assert.match(html, /aria-label="Painting technique player"/);
      assert.match(html, /data-phase="watch" data-playing="false"/);
      assert.doesNotMatch(html, /aria-label="Lesson chapters"|class="guided-eyebrow"|class="guided-steps"|aria-label="Step progress"/);
      assert.equal(buttons.some(label => /Continue|Next step|Revisit the lesson|Try it with your brush|Mark.*(?:complete|practised)/.test(label)), false, `${technique}/${chapter.id} must not advance or complete the parent guide`);
      if (chapter.id !== "light") assert.ok(buttons.includes("Watch demo"));
      const adjust = buttons.filter(label => label.startsWith("Change "));
      assert.equal(adjust.length, phasesForChapter(technique, chapter.id).includes("explore") ? 1 : 0);
      assert.equal(buttons.includes("Your setting"), false, "comparison stays behind the adjustment disclosure");
      assert.doesNotMatch(html, /class="guided-heading"|class="guided-instruction"/, "the guide owns the instruction heading");
      assert.match(html, /class="embedded-technique-heading"/, "the panel keeps its compact technique identity");
      if (chapter.id !== "light") {
        assert.match(html, /aria-label="Demonstration checkpoints"/);
        assert.ok(buttons.includes("Before") && buttons.includes("Result"), "still views remain directly available alongside playback");
        if (phasesForChapter(technique, chapter.id).includes("explore")) assert.ok(buttons.includes("Application"));
        assert.match(html, /Show still views/);
        assert.match(html, /Half speed/);
      }
    }
  }
});

test("preparation stays playback-only and the light example exposes only its relevant control", async () => {
  for (const chapter of ["prepare", "load"]) {
    const html = await renderPlayer("layers", chapter);
    assert.match(html, /Demo options/);
    assert.ok(buttonLabels(html).includes("Watch demo"));
    assert.doesNotMatch(html, /Change paint amount|Compare paint application|Examine paint application/);
    assert.match(html, /Demo progress/);
    assert.equal((html.match(/type="range"/g) ?? []).length, 1, "only seeking is available during preparation");
  }
  const light = await renderPlayer("layers", "light");
  assert.match(light, /Painted light direction/);
  assert.equal((light.match(/type="range"/g) ?? []).length, 1);
  assert.doesNotMatch(light, /Demo options|Change paint amount|Compare paint application/);
  assert.equal(buttonLabels(light).includes("Watch demo"), false);
});

test("teaching captions stay HTML text instead of shrinking with the artwork", async () => {
  const preparing = await renderPlayer("layers", "prepare");
  const loading = await renderPlayer("layers", "load");
  const light = await renderPlayer("layers", "light");
  for (const html of [preparing, loading, light, await renderPlayer("edges", "stage-1")]) {
    assert.equal((html.match(/class="surface-painting-scene"/g) ?? []).length, 1, "one surface demonstration is mounted");
    const svg = html.match(/<div class="surface-painting-fallback"[^>]*>(<svg\b[\s\S]*?<\/svg>)/)?.[1];
    assert.ok(svg, "the surface scene provides its own readable fallback");
    assert.doesNotMatch(svg, /<text\b/);
    assert.match(html, /class="guided-stage-footer/);
  }
  assert.match(preparing, /<span>On the palette<\/span><span>Test the mark<\/span>/);
  assert.match(loading, /<span>Load &amp; unload<\/span><span>Test the mark<\/span>/);
  assert.match(light, /<label[^>]*>Painted light direction<\/label>/);
  assert.match(await renderPlayer("edges", "stage-1"), /class="guided-view-state">Before<\/span>/);
});

test("standalone study still exposes every authored chapter and its own navigation", async () => {
  for (const technique of techniques) {
    const chapters = lessonChapters(technique);
    const html = await renderPlayer(technique, chapters[0].id, false);
    assert.match(html, /aria-label="Lesson chapters"/);
    assert.match(html, /aria-label="Step progress"/);
    assert.match(html, /Lesson steps/);
    assert.ok(buttonLabels(html).includes("Continue"));
    assert.equal((html.match(/aria-current="step"/g) ?? []).length, 1);
    const nav = html.match(/<nav aria-label="Lesson chapters">([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(nav);
    assert.equal(buttonLabels(nav).length, chapters.length);
  }
});

test("embedded painting keeps its drying checkpoint without the repeated footer", async () => {
  const warning = "Time is compressed. Let each real coat dry before the next.";
  const secondCoat = await renderPlayer("layers", "second-coat");
  assert.match(secondCoat, /class="guided-view-state">Let the coat dry<\/span>/, "the drying pause remains readable in the stage footer");
  assert.equal(secondCoat.includes(warning), false);
  for (const technique of techniques) {
    const paintingChapter = lessonChapters(technique).find(chapter => phasesForChapter(technique, chapter.id).includes("explore"));
    assert.ok(paintingChapter);
    assert.equal((await renderPlayer(technique, paintingChapter.id)).includes('class="guided-footnote"'), false, `${technique} has no embedded footnote`);
    assert.ok((await renderPlayer(technique, paintingChapter.id, false)).includes("Illustrated timing. Let each real coat dry before the next."), `${technique} retains standalone drying guidance`);
  }
  for (const chapter of ["prepare", "load", "light"]) {
    assert.equal((await renderPlayer("layers", chapter)).includes(warning), false, `${chapter} is not a paint application`);
  }
});

test("coach adjustments enter the reviewed chapter's finished mark and start on the user's mark", () => {
  for (const technique of techniques) {
    const chapterId = WORKSHOPS[technique].chapter;
    const explore = resolveLessonEntry(technique, chapterId, "explore");
    const compare = resolveLessonEntry(technique, chapterId, "compare");
    assert.ok(explore && compare);
    assert.deepEqual(explore, { chapterId, phase: "explore", time: chapterResultTime(technique, chapterId), amount: .4, reference: false });
    assert.deepEqual(compare, { ...explore, phase: "compare", amount: .85 });
    const displayed = { ...compare, light: 0, lighting: false };
    assert.equal(experimentFactors(technique, displayed).amount, .85);
    assert.equal(experimentFactors(technique, { ...displayed, reference: true }).amount, .4);
    assert.notEqual(describeExperiment(technique, compare.amount, false), describeExperiment(technique, compare.amount, true));
    assert.equal(describeExperiment(technique, compare.amount, true), WORKSHOPS[technique].outcome);
  }
});

test("watching stays inside its chapter and coach links cannot enter physical practice or unsupported experiments", () => {
  for (const technique of techniques) {
    for (const chapter of lessonChapters(technique)) {
      const entry = resolveLessonEntry(technique, chapter.id);
      assert.deepEqual(entry, { chapterId: chapter.id, phase: "watch", time: chapter.start, amount: .4, reference: false });
      const result = chapterResultTime(technique, chapter.id);
      assert.deepEqual(advanceLesson(entry!.time, 999, 1, result, result), { time: result, stopped: true });
      assert.ok(result < chapter.end, "finishing a demonstration cannot enter the next chapter");
      for (const action of ["explore", "compare"] as const) {
        const target = resolveLessonEntry(technique, chapter.id, action);
        assert.ok(target);
        assert.notEqual(target.phase, "practice");
        if (!phasesForChapter(technique, chapter.id).includes("explore")) assert.deepEqual(target, entry);
      }
    }
    assert.equal(resolveLessonEntry(technique, "missing", "compare"), null);
  }
});
