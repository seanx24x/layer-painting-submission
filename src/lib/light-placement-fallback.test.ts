import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LightPlacementFallback } from "../components/LightPlacementFallback";
import { DEFAULT_LIGHT, PAINT_BANDS, type LightStudyState } from "./light-placement";

const renderFallback = (state: LightStudyState) => renderToStaticMarkup(createElement(LightPlacementFallback, { state, id: "fallback-check" }));

test("WebGL-independent fallback renders both forms and both light views deterministically", () => {
  for (const surface of ["sphere", "block"] as const) for (const view of ["light", "paint"] as const) {
    const state = { ...DEFAULT_LIGHT, surface, view }, output = renderFallback(state);
    assert.ok(output.startsWith('<svg class="light-fallback"'));
    assert.ok(!output.includes("NaN") && !output.includes("undefined"));
    assert.ok(output.includes(surface === "sphere" ? '<rect' : '<path'));
    assert.equal(renderFallback(state), output);
    const moved = renderFallback({ ...state, azimuth: 70, elevation: 15 });
    assert.notEqual(moved, output, `${surface}/${view} must respond to light placement without WebGL`);
    if (view === "paint" && surface === "sphere") for (const colour of Object.values(PAINT_BANDS)) assert.ok(output.includes(colour));
  }
});
