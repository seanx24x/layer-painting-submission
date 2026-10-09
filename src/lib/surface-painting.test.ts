import assert from "node:assert/strict";
import test from "node:test";
import { FLAT_STROKES } from "./flat-painting";
import { chapterContactTime, chapterResultTime } from "./guided-lesson";
import { lessonChapters } from "./painting-lesson";
import type { StudyPalette } from "./study-palette";
import type { TechniqueId } from "./technique-study-types";
import { evaluateSurfacePainting, SURFACE_STROKES } from "./surface-painting";

const techniques: TechniqueId[] = ["layers", "edges", "recess", "drybrush"];
const experiment = (amount: number, reference = false) => ({ amount, reference, light: -35, lighting: false });

test("every painting chapter has a prepared start, active contact and completed new marks", () => {
  for (const technique of techniques) {
    for (const chapter of lessonChapters(technique)) {
      const strokes = SURFACE_STROKES[technique].filter((stroke) => stroke.start >= chapter.start && stroke.end <= chapter.end);
      if (!strokes.length) continue;
      const before = evaluateSurfacePainting({ technique, time: chapter.start });
      const contact = evaluateSurfacePainting({ technique, time: chapterContactTime(technique, chapter.id) });
      const result = evaluateSurfacePainting({ technique, time: chapterResultTime(technique, chapter.id) });
      const ids = new Set(strokes.map((stroke) => stroke.id));
      assert.equal(before.chapterId, chapter.id);
      assert.equal(contact.chapterId, chapter.id);
      assert.equal(result.chapterId, chapter.id);
      assert.ok(before.passes.filter((pass) => ids.has(pass.id)).every((pass) => pass.progress === 0), `${technique}/${chapter.id}: starts already painted`);
      assert.ok(contact.passes.some((pass) => ids.has(pass.id) && pass.progress > 0 && pass.progress < 1 && pass.width > 0 && pass.opacity > 0), `${technique}/${chapter.id}: contact is blank`);
      assert.ok(result.passes.filter((pass) => ids.has(pass.id)).every((pass) => pass.progress === 1 && pass.width > 0), `${technique}/${chapter.id}: result is unfinished`);
      const earlier = new Set(SURFACE_STROKES[technique].filter((stroke) => stroke.end < chapter.start).map((stroke) => stroke.id));
      assert.ok(before.passes.filter((pass) => earlier.has(pass.id)).every((pass) => pass.progress === 1), `${technique}/${chapter.id}: loses prepared coats`);
    }
  }
});

test("legacy chapter contact times and paint coat identities remain attached to the authored sequence", () => {
  for (const technique of techniques) {
    assert.deepEqual(SURFACE_STROKES[technique].map(({ id, start, end, coat }) => ({ id, start, end, coat })), FLAT_STROKES[technique].map(({ id, start, end, coat }) => ({ id, start, end, coat })));
  }
  for (const [time, chapterId, preparation] of [[10, "prepare", "mix"], [25, "load", "load"]] as const) {
    const before = evaluateSurfacePainting({ technique: "layers", time });
    const contact = evaluateSurfacePainting({ technique: "layers", time: chapterContactTime("layers", chapterId) });
    const result = evaluateSurfacePainting({ technique: "layers", time: chapterResultTime("layers", chapterId) });
    assert.equal(before.phase, "preparation");
    assert.equal(before.preparation, preparation);
    assert.equal(before.preparationProgress, 0);
    assert.ok(contact.preparationProgress > 0 && contact.preparationProgress < 1);
    assert.equal(result.preparationProgress, 1);
    assert.ok(result.passes.every((pass) => pass.progress === 0));
  }
  const loadContact = evaluateSurfacePainting({ technique: "layers", time: 29.2 });
  assert.ok(loadContact.preparationUnloadProgress > 0);
  assert.equal(loadContact.preparationTestProgress, 0, "remove excess before testing the next mark");
  const light = evaluateSurfacePainting({ technique: "layers", time: 5, experiment: { ...experiment(.4), light: 55, lighting: true } });
  assert.equal(light.phase, "light");
  assert.equal(light.light, 55);
  assert.equal(light.lighting, true);
});

test("drying holds the earlier layer steady before the next distinct coat starts", () => {
  for (const [start, end, nextCoat] of [[55, 59.1, 1], [70, 72.1, 2]] as const) {
    const first = evaluateSurfacePainting({ technique: "layers", time: start });
    const last = evaluateSurfacePainting({ technique: "layers", time: end });
    assert.equal(first.drying, true);
    assert.equal(last.drying, true);
    assert.deepEqual(last.passes, first.passes);
    assert.ok(first.passes.filter((pass) => pass.coat >= nextCoat).every((pass) => pass.progress === 0));
  }
});

test("each technique reconstructs identical paint after reverse seeking and parameter changes", () => {
  for (const technique of techniques) {
    for (const stroke of SURFACE_STROKES[technique]) {
      const time = (stroke.start + stroke.end) / 2;
      const input = { technique, time, experiment: experiment(.7), detail: true };
      const expected = evaluateSurfacePainting(input);
      evaluateSurfacePainting({ technique, time: 80, experiment: experiment(0) });
      evaluateSurfacePainting({ technique, time: 0, experiment: experiment(1) });
      assert.deepEqual(evaluateSurfacePainting(input), expected);
    }
    const time = technique === "layers" ? 53.7 : 21.9;
    const controlled = evaluateSurfacePainting({ technique, time, experiment: experiment(.4), detail: true });
    const reference = evaluateSurfacePainting({ technique, time, experiment: experiment(.95, true), detail: true });
    assert.deepEqual(reference, controlled, `${technique}: comparison must keep the same chapter and framing`);
    const heavy = evaluateSurfacePainting({ technique, time, experiment: experiment(1) });
    const light = evaluateSurfacePainting({ technique, time, experiment: experiment(0) });
    assert.ok(heavy.passes[0].width > light.passes[0].width);
    assert.deepEqual(heavy.passes.map(({ from, to }) => ({ from, to })), light.passes.map(({ from, to }) => ({ from, to })));
  }
});

test("guide paint identities and repeated colours survive every stage, separately from wash deposition", () => {
  const repeated = { id: "same-paint", name: "The guide's repeated paint", hex: "#CC78A9" };
  const palette: StudyPalette = { base: { id: "base", name: "The guide's red surface", hex: "#991419" }, coats: [repeated, repeated, repeated] };
  const before = JSON.stringify(palette);
  for (const technique of techniques) {
    for (const time of [0, 8, 15, 23, 54, 69, 79]) {
      const frame = evaluateSurfacePainting({ technique, time, palette });
      assert.equal(frame.base, palette.base.hex);
      assert.deepEqual(frame.coats, [repeated.hex, repeated.hex, repeated.hex]);
      assert.deepEqual(frame.depositedCoats, technique === "recess" ? ["#7a0911", "#7a0911", "#7a0911"] : frame.coats);
    }
  }
  assert.equal(JSON.stringify(palette), before);
});

test("later geometry passes refine the ridge, join the channels and narrow the drybrush contact", () => {
  const edges = evaluateSurfacePainting({ technique: "edges", time: 24 });
  assert.ok(edges.passes.every((pass) => pass.from[0] === .5 && pass.to[0] === .5));
  assert.ok(edges.passes.find((pass) => pass.coat === 1)!.width < edges.passes[0].width);
  assert.ok(edges.passes.filter((pass) => pass.coat === 2).every((pass) => Math.abs(pass.to[1] - pass.from[1]) < .05));
  const recess = evaluateSurfacePainting({ technique: "recess", time: 24 });
  const first = recess.passes.filter((pass) => pass.coat === 0);
  assert.ok(first.every((pass) => Math.min(Math.hypot(pass.from[0] - .5, pass.from[1] - .5), Math.hypot(pass.to[0] - .5, pass.to[1] - .5)) > .05), "first channels leave the centre to connect");
  const join = recess.passes.find((pass) => pass.coat === 1)!;
  assert.ok(join.from[1] > .5 && join.to[1] < .5, "second pass connects through the centre");
  const drybrush = evaluateSurfacePainting({ technique: "drybrush", time: 24 });
  assert.ok(drybrush.passes.find((pass) => pass.coat === 2)!.width < drybrush.passes.find((pass) => pass.coat === 1)!.width);
});

test("invalid clock inputs and a newly touching stroke cannot introduce a painted jump", () => {
  for (const technique of techniques) {
    const stroke = SURFACE_STROKES[technique][0];
    const atContact = evaluateSurfacePainting({ technique, time: stroke.start }).passes[0];
    const justAfter = evaluateSurfacePainting({ technique, time: stroke.start + .001 }).passes[0];
    assert.equal(atContact.progress, 0);
    assert.equal(atContact.width, 0);
    assert.ok(justAfter.width < stroke.width * .001);
    assert.equal(evaluateSurfacePainting({ technique, time: NaN }).time, 0);
    assert.equal(evaluateSurfacePainting({ technique, time: -100 }).time, 0);
    assert.equal(evaluateSurfacePainting({ technique, time: 1000 }).time, technique === "layers" ? 80 : 24);
  }
});
