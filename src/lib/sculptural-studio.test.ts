import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_STUDIO_STATE, DRY_STROKES, LAYER_STROKES, STROKE_FEATHER, STROKE_TIP_ASPECT, STUDIES,
  edgeHighlightWidth, getStudyPhase, layerCoverage, layerOpacity, reliefHeight, renderState,
  sampleLightAngles, strokeCoverage, strokeProgress, studyDuration,
} from "./sculptural-studio";

const samples = Array.from({ length: 11 }, (_, index) => index / 10);
const coverageSnapshot = (time: number, amount = .4) =>
  samples.flatMap(u => samples.map(v => layerCoverage(time, amount, u, v)));

test("paint is absent before contact and advances along the authored surface path", () => {
  for (const stroke of [...LAYER_STROKES, ...DRY_STROKES]) {
    for (const time of [0, stroke.start - .001, stroke.start]) {
      assert.equal(strokeCoverage(stroke, time, ...stroke.from), 0);
      assert.equal(strokeCoverage(stroke, time, ...stroke.to), 0);
    }
    const middle = (stroke.start + stroke.end) / 2;
    assert.ok(strokeCoverage(stroke, middle, ...stroke.from) > 0);
    assert.equal(strokeCoverage(stroke, middle, ...stroke.to), 0, "paint must not reach the end ahead of contact");
    assert.equal(strokeCoverage(stroke, stroke.end, ...stroke.to), 1);
    assert.equal(strokeProgress(stroke, stroke.start - 1), 0);
    assert.equal(strokeProgress(stroke, stroke.end + 1), 1);
  }
  assert.ok(coverageSnapshot(0).every(value => value === 0));
  const first = LAYER_STROKES[0];
  assert.equal(strokeCoverage(first, first.start + .001, first.from[0] + first.width * .5, first.from[1]), 0, "first contact must not flash a full-width patch");
  assert.ok(strokeCoverage(first, first.start + .3, first.from[0] + first.width * .5, first.from[1]) > 0, "contact should open smoothly to the authored width");
});

test("reverse seeking and changed paint load reconstruct the same coverage", () => {
  for (const time of [1.4, 3, 6.4, 9, studyDuration("layers")]) {
    const expected = coverageSnapshot(time);
    coverageSnapshot(studyDuration("layers"), 1);
    coverageSnapshot(0, 0);
    assert.deepEqual(coverageSnapshot(time), expected);
  }
  const low = coverageSnapshot(studyDuration("layers"), .1);
  const high = coverageSnapshot(studyDuration("layers"), .9);
  assert.ok(high.every((value, index) => value >= low[index]));
  assert.ok(high.some((value, index) => value > low[index]));
});

test("the same stroke gains opacity on its dry second coat without changing its footprint", () => {
  const u = .5, v = .5;
  const firstPass = layerCoverage(LAYER_STROKES[0].end, .4, u, v);
  const secondCoat = layerCoverage(studyDuration("layers"), .4, u, v);
  assert.ok(firstPass > 0 && firstPass < 1, "the first coat must remain translucent");
  assert.ok(secondCoat > firstPass && secondCoat < 1, "separate coats must accumulate while retaining translucency");
  const first = coverageSnapshot(LAYER_STROKES[0].end), second = coverageSnapshot(studyDuration("layers"));
  assert.deepEqual(first.map(value => value > 0), second.map(value => value > 0), "both coats must follow the same area");
  assert.equal(layerCoverage(studyDuration("layers"), .4, .1, .9), 0, "primer outside the stroke stays untouched");
});

test("the drying interval changes the explanation without depositing more paint", () => {
  const held = coverageSnapshot(5.5);
  for (const time of [5.5, 6, 6.8, 7.399]) {
    assert.deepEqual(coverageSnapshot(time), held);
    const phase = getStudyPhase("layers", time);
    assert.equal(phase.label, "Let the first coat dry");
    assert.match(phase.description, /fully dry/);
  }
  assert.equal(getStudyPhase("layers", 7.4).label, "Second coat");
  assert.ok(coverageSnapshot(8.5).some((value, index) => value > held[index]));
});

test("reference comparison fixes application while retaining inspection and lighting choices", () => {
  for (const study of STUDIES) {
    const input = Object.freeze({
      ...DEFAULT_STUDIO_STATE, study: study.id, reference: true,
      time: 1.2, amount: .95, close: true, form: "block" as const,
      lightAzimuth: 22, lightElevation: 68, paintMap: false,
    });
    const reference = renderState(input);
    assert.equal(reference.time, study.id === "light" ? input.time : studyDuration(study.id));
    assert.equal(reference.amount, study.id === "light" ? input.amount : .4);
    assert.equal(reference.close, input.close);
    assert.equal(reference.form, input.form);
    assert.equal(reference.lightAzimuth, input.lightAzimuth);
    assert.equal(reference.lightElevation, input.lightElevation);
    assert.equal(reference.paintMap, study.id === "light" ? true : input.paintMap);
    assert.equal(input.time, 1.2, "comparison must not overwrite the user's timeline");
    assert.equal(input.amount, .95, "comparison must not overwrite the user's adjustment");
    const restored = renderState({ ...input, reference: false });
    assert.equal(restored.time, input.time);
    assert.equal(restored.amount, input.amount);
    assert.equal(restored.paintMap, input.paintMap);
    if (study.id === "light") assert.deepEqual(sampleLightAngles(reference), sampleLightAngles(input), "a painting-plan comparison must use the same light direction");
  }
});

test("bounded timeline inputs and all sampled paint coverage stay finite", () => {
  for (const study of STUDIES) {
    for (const value of [-100, 0, .4, 100, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = renderState({ ...DEFAULT_STUDIO_STATE, study: study.id, time: value, amount: value });
      assert.ok(Number.isFinite(state.time) && state.time >= 0 && state.time <= study.duration);
      assert.ok(Number.isFinite(state.amount) && state.amount >= 0 && state.amount <= 1);
    }
  }
  for (const time of [0, .8, 1.001, 3, 5.4, 7.4, 9, 14]) {
    for (const amount of [0, .4, 1]) {
      assert.ok(coverageSnapshot(time, amount).every(value => Number.isFinite(value) && value >= 0 && value <= 1));
    }
  }
});

test("stone relief retains consistent high and low points regardless of sampling order", () => {
  const points = samples.flatMap(u => samples.map(v => [u, v] as const));
  const expected = points.map(([u, v]) => reliefHeight(u, v));
  const reversed = [...points].reverse().map(([u, v]) => reliefHeight(u, v)).reverse();
  assert.deepEqual(reversed, expected);
  assert.ok(expected.every(height => Number.isFinite(height) && height > 0 && height < .3));
  assert.ok(Math.max(...expected) - Math.min(...expected) > .1, "relief needs distinct crests and valleys");
  for (const [u, v] of points) {
    assert.ok(Math.abs(reliefHeight(u + .00001, v) - reliefHeight(u, v)) < .001, "adjacent samples must form a continuous surface");
  }
});

test("light movement is reversible, bounded and returns to the chosen direction", () => {
  const start = sampleLightAngles(DEFAULT_STUDIO_STATE);
  const middle = sampleLightAngles({ ...DEFAULT_STUDIO_STATE, time: 5 });
  const end = sampleLightAngles({ ...DEFAULT_STUDIO_STATE, time: 10 });
  assert.ok(middle.azimuth > start.azimuth);
  assert.equal(middle.elevation, start.elevation);
  assert.ok(Math.abs(end.azimuth - start.azimuth) < 1e-10);
  assert.deepEqual(sampleLightAngles({ ...DEFAULT_STUDIO_STATE, time: 5 }), middle);
  for (const lightAzimuth of [-1000, -80, 0, 80, 1000]) {
    for (const lightElevation of [-1000, 10, 45, 80, 1000]) {
      const light = sampleLightAngles({ ...DEFAULT_STUDIO_STATE, time: 5, lightAzimuth, lightElevation });
      assert.ok(Number.isFinite(light.azimuth) && light.azimuth >= -80 && light.azimuth <= 80);
      assert.ok(Number.isFinite(light.elevation) && light.elevation >= 10 && light.elevation <= 80);
    }
  }
});


test("pressure widens the edge while controlled coats retain a visible second pass", () => {
  const widths = samples.map(edgeHighlightWidth);
  assert.ok(widths.every((width, index) => width > 0 && (!index || width > widths[index - 1])));
  assert.ok(edgeHighlightWidth(1) > edgeHighlightWidth(.4) * 4, "firm pressure should visibly spread onto the faces");
  assert.equal(edgeHighlightWidth(-1), edgeHighlightWidth(0));
  assert.equal(edgeHighlightWidth(2), edgeHighlightWidth(1));
  for (const amount of samples) {
    const first = layerCoverage(LAYER_STROKES[0].end, amount, .5, .5);
    const result = layerCoverage(studyDuration("layers"), amount, .5, .5);
    assert.ok(result - first > .2, "the second coat should remain perceptibly different across the control range");
    assert.ok(layerOpacity(amount) < 1);
  }
});


test("layer stroke ends stay shorter than their width without changing the central deposit", () => {
  const stroke = LAYER_STROKES[0];
  const dx = stroke.to[0] - stroke.from[0], dy = stroke.to[1] - stroke.from[1];
  const length = Math.hypot(dx, dy), distance = stroke.width * .6;
  const beyond = [stroke.to[0] + dx / length * distance, stroke.to[1] + dy / length * distance];
  const side = [.5 - dy / length * distance, .5 + dx / length * distance];
  assert.equal(strokeCoverage(stroke, stroke.end, beyond[0], beyond[1], stroke.width, STROKE_FEATHER, STROKE_TIP_ASPECT), 0);
  assert.ok(strokeCoverage(stroke, stroke.end, side[0], side[1], stroke.width, STROKE_FEATHER, STROKE_TIP_ASPECT) > .95);
});
