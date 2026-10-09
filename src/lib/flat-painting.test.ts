import assert from "node:assert/strict";
import test from "node:test";
import { FLAT_STROKES, flatContactWidth, flatDepositedPaint, flatLayerPassOpacity, flatPaintFrame, flatPalette, flatSceneViewBox, flatStrokeDirection, flatStrokePoint, flatSurfacePoint, flatTint } from "./flat-painting";
import type { TechniqueId } from "./technique-study-types";
import type { StudyPalette } from "./study-palette";

const ids: TechniqueId[] = ["layers", "edges", "recess", "drybrush"];
const experiment = (amount: number) => ({ amount, reference: false, light: -31, lighting: false });

test("flat lessons have deterministic, reversible marks and aligned contact", () => {
  for (const id of ids) {
    for (const stroke of FLAT_STROKES[id]) {
      const time = (stroke.start + stroke.end) / 2;
      const before = flatPaintFrame(id, time);
      flatPaintFrame(id, 80);
      const after = flatPaintFrame(id, time);
      assert.deepEqual(after, before, `${id} reverse seek must reconstruct identical marks`);
      assert.ok(after.brush.contact);
      const expected = flatStrokePoint(stroke, .5);
      assert.ok(Math.abs(after.brush.point.x - expected.x) < .001);
      assert.ok(Math.abs(after.brush.point.y - expected.y) < .001);
      assert.ok(after.marks.find(mark => mark.stroke.id === stroke.id)?.path.length);
      assert.ok(after.marks.every(mark => !mark.path.includes("NaN")));
    }
  }
});

test("load and pressure change both tip and deposited mark without moving the path", () => {
  for (const id of ids) {
    const stroke = FLAT_STROKES[id][0], time = (stroke.start + stroke.end) / 2;
    const light = flatPaintFrame(id, time, experiment(0));
    const heavy = flatPaintFrame(id, time, experiment(1));
    assert.deepEqual(light.brush.point, heavy.brush.point);
    assert.ok(heavy.brush.width > light.brush.width, id);
    assert.ok(heavy.marks[0].width > light.marks[0].width, id);
    const reference = flatPaintFrame(id, time, { ...experiment(1), reference: true });
    assert.deepEqual(reference, flatPaintFrame(id, time, experiment(.4)));
  }
});

test("preparation and drying are explicit and use established lesson boundaries", () => {
  for (const [time, phase] of [[0, "light"], [10, "mix"], [25, "load"], [35, "paint"]] as const) {
    assert.equal(flatPaintFrame("layers", time).phase, phase);
  }
  assert.equal(flatPaintFrame("layers", 56).dry, true);
  assert.equal(flatPaintFrame("layers", 61).dry, false);
  assert.equal(flatPaintFrame("layers", 71).dry, true);
  for (const id of ids.slice(1)) assert.equal(flatPaintFrame(id, 0).phase, "paint");
});

test("guide paints survive illustration rendering and detail keeps geometry related", () => {
  const palette: StudyPalette = {
    base: { id: "black", name: "Black", hex: "#121212" },
    coats: [{ id: "red", name: "Red", hex: "#ff4433" }, { id: "yellow", name: "Yellow", hex: "#ffee33" }, { id: "white", name: "White", hex: "#ffffee" }],
  };
  for (const id of ids) assert.deepEqual(flatPalette(id, palette), { base: "#121212", coats: ["#ff4433", "#ffee33", "#ffffee"] });
  assert.deepEqual(flatSurfacePoint({ x: 380, y: 240 }, true), { x: 360, y: 267 });
  assert.deepEqual(flatSurfacePoint({ x: 380, y: 240 }, false), { x: 380, y: 240 });
});

test("recess washes darken light, black and saturated surfaces at every load", () => {
  const channels = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  const cases = [
    { base: "#E0E0E0", wash: "#D1CBCD" }, // Corax White / Soulblight Grey
    { base: "#000000", wash: "#8C7E7C" }, // Abaddon Black / Nuln Oil
    { base: "#991419", wash: "#CC78A9" }, // Mephiston Red / Carroburg Crimson
    { base: "#EEF1EB", wash: "#758D83" }, // Authored neutral illustration
  ];
  for (const { base, wash } of cases) {
    const deposited = flatDepositedPaint("recess", base, wash);
    for (const amount of [0, .4, 1]) {
      for (const stroke of FLAT_STROKES.recess) {
        const frame = flatPaintFrame("recess", stroke.end, experiment(amount));
        const mark = frame.marks.find(item => item.stroke.id === stroke.id)!;
        const visible = channels(flatTint(base, deposited, mark.opacity));
        assert.ok(visible.every((channel, i) => channel <= channels(base)[i]), `${base} + ${wash}, load ${amount}`);
      }
    }
    for (const technique of ["layers", "edges", "drybrush"] as const) assert.equal(flatDepositedPaint(technique, base, wash), wash);
  }
  assert.equal(flatDepositedPaint("recess", "#991419", "#CC78A9"), "#7a0911");
  assert.equal(flatDepositedPaint("recess", "#000000", "#8C7E7C"), "#000000");
});


test("the brush lifts out continuously before long drying pauses", () => {
  const strokes = FLAT_STROKES.layers;
  for (let i = 0; i < strokes.length - 1; i++) {
    const current = strokes[i], next = strokes[i + 1];
    if (next.start - current.end < 3.5) continue;
    const touching = flatPaintFrame("layers", current.end).brush;
    const lifting = flatPaintFrame("layers", current.end + .001).brush;
    const lifted = flatPaintFrame("layers", current.end + .35).brush;
    const gone = flatPaintFrame("layers", current.end + .7).brush;
    assert.ok(lifting.opacity > .999);
    assert.equal(lifting.coat, touching.coat);
    assert.ok(Math.hypot(lifting.point.x - touching.point.x, lifting.point.y - touching.point.y) < .01);
    assert.ok(lifted.point.y < touching.point.y);
    assert.ok(lifted.opacity < lifting.opacity && lifted.opacity > 0);
    assert.equal(gone.opacity, 0);
  }
});


test("bristle contact spans the same curve-normal footprint as the deposited ribbon", () => {
  for (const id of ids) {
    for (const stroke of FLAT_STROKES[id]) {
      for (const portion of [.15, .5, .85]) {
        for (const amount of [0, .4, 1]) {
          const frame = flatPaintFrame(id, stroke.start + (stroke.end - stroke.start) * portion, experiment(amount));
          const mark = frame.marks.find(item => item.stroke.id === stroke.id)!;
          const tangent = flatStrokeDirection(stroke, mark.progress);
          assert.ok(Math.abs(frame.brush.width - flatContactWidth(stroke, mark.progress, mark.width)) < .00001);
          const radians = frame.brush.angle * Math.PI / 180;
          // The brush's local Y axis follows the stroke. Its X axis is the contact edge.
          assert.ok(Math.abs(-Math.sin(radians) - tangent.x) < .00001);
          assert.ok(Math.abs(Math.cos(radians) - tangent.y) < .00001);
        }
      }
    }
  }
});

test("completed deposits stay fixed as the brush leaves and later strokes arrive", () => {
  for (const id of ids) {
    const stroke = FLAT_STROKES[id][0];
    const deposited = flatPaintFrame(id, stroke.end).marks[0];
    for (const time of [stroke.end + .05, stroke.end + .3, 80]) {
      assert.deepEqual(flatPaintFrame(id, time).marks[0], deposited);
    }
  }
});

test("display palette values cannot mutate another scene's defaults", () => {
  for (const id of ids) {
    const original = flatPalette(id);
    const copy = flatPalette(id);
    copy.base = "#000000";
    copy.coats[0] = "#ffffff";
    assert.deepEqual(flatPalette(id), original);
  }
});

test("wide stages preserve teaching scale and narrow stages retain the whole form", () => {
  for (const [width, height] of [[1200, 480], [700, 450], [320, 300]]) {
    const [x, y, viewWidth, viewHeight] = flatSceneViewBox(width, height, false, false).split(" ").map(Number);
    assert.ok(Math.abs(viewWidth / viewHeight - width / height) < .0001);
    assert.ok(280 / viewHeight >= .6 && 280 / viewHeight <= .7);
    assert.ok(x <= 240 && x + viewWidth >= 520);
    assert.ok(y <= 100 && y + viewHeight >= 380);
  }
});


test("a second controlled coat evens out first-coat overlap while excess stays visibly uneven", () => {
  const composite = (under: number, over: number) => 1 - (1 - under) * (1 - over);
  const at = (amount: number) => {
    const frame = flatPaintFrame("layers", 69, experiment(amount));
    const coverage = (coat: 0 | 1, passes: 1 | 2) => {
      const pass = flatLayerPassOpacity(coat, amount);
      const opacity = frame.marks.find(mark => mark.stroke.coat === coat)!.opacity;
      return opacity * (passes === 1 ? pass : composite(pass, pass));
    };
    const first = [coverage(0, 1), coverage(0, 2)];
    const second = [composite(first[0], coverage(1, 1)), composite(first[1], coverage(1, 2))];
    return { first, second };
  };
  const controlled = at(.4), excess = at(1);
  const firstVariation = controlled.first[1] - controlled.first[0];
  const secondVariation = controlled.second[1] - controlled.second[0];
  assert.ok(firstVariation > 0, "first-coat overlaps remain perceptible");
  assert.ok(secondVariation < firstVariation / 2, "a second coat reduces striping rather than reinforcing it");
  assert.ok(secondVariation < .025, "the finished controlled coat is visually even");
  assert.ok(controlled.second[0] > controlled.first[0], "dry coats build coverage");
  assert.ok(excess.first[1] - excess.first[0] > firstVariation * 2, "an overloaded first coat remains clearly uneven");
});
