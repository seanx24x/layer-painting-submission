import assert from "node:assert/strict";
import test from "node:test";
import { constrainLight, DEFAULT_LIGHT, LIGHT_PRESETS, lightDirection, lightExposure, lightFromHandle, lightHandlePosition, moveLightWithKey, paintBand } from "./light-placement";

test("light directions stay normalized, above the form and in the front hemisphere", () => {
  for (const azimuth of [-80, -35, 0, 35, 80]) for (const elevation of [10, 50, 80]) {
    const direction = lightDirection({ azimuth, elevation });
    assert.ok(Math.abs(Math.hypot(...direction) - 1) < 1e-12);
    assert.ok(direction[1] > 0 && direction[2] > 0);
    assert.equal(Math.sign(direction[0]), Math.sign(azimuth));
  }
});

test("presets and handle coordinates preserve the exact same light", () => {
  for (const preset of LIGHT_PRESETS) {
    const handle = lightHandlePosition(preset);
    assert.deepEqual(lightFromHandle(handle.x, handle.y), { azimuth: preset.azimuth, elevation: preset.elevation });
  }
  assert.deepEqual(lightFromHandle(-5, 9), { azimuth: -80, elevation: 10 });
  assert.deepEqual(lightFromHandle(5, -9), { azimuth: 80, elevation: 80 });
});

test("lighting and painting bands respond to actual surface normals", () => {
  const left = { azimuth: -70, elevation: 15 }, right = { azimuth: 70, elevation: 15 };
  assert.equal(paintBand(lightExposure([-1, 0, 0], left)), "highlight");
  assert.equal(paintBand(lightExposure([-1, 0, 0], right)), "shadow");
  assert.equal(paintBand(lightExposure([1, 0, 0], right)), "highlight");
  assert.equal(lightExposure([0, 0, -1], left), 0);
  assert.equal(lightExposure([0, 0, 0], left), 0);
  assert.ok(Math.abs(lightExposure(lightDirection(DEFAULT_LIGHT), DEFAULT_LIGHT) - 1) < 1e-12);
  assert.equal(paintBand(.22), "midtone");
  assert.equal(paintBand(.72), "highlight");
});

test("keyboard movement supports coarse, fine and bounded adjustments", () => {
  assert.deepEqual(moveLightWithKey(DEFAULT_LIGHT, "ArrowRight"), { azimuth: -30, elevation: 50 });
  assert.deepEqual(moveLightWithKey(DEFAULT_LIGHT, "ArrowUp", true), { azimuth: -35, elevation: 51 });
  assert.deepEqual(moveLightWithKey({ azimuth: 80, elevation: 80 }, "ArrowRight"), { azimuth: 80, elevation: 80 });
  assert.deepEqual(moveLightWithKey({ azimuth: -80, elevation: 10 }, "ArrowDown"), { azimuth: -80, elevation: 10 });
  assert.equal(moveLightWithKey(DEFAULT_LIGHT, "Tab"), null);
  assert.deepEqual(constrainLight({ azimuth: NaN, elevation: Infinity }), DEFAULT_LIGHT);
});
