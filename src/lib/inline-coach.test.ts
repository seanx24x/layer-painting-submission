import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getGuide, guides } from "./guides";
import { lessonExamples } from "./lesson-examples";

const coach = (async () => {
  const styles = registerHooks({
    load(url, context, nextLoad) {
      return url.endsWith(".css")
        ? { format: "module", source: "export {};", shortCircuit: true }
        : nextLoad(url, context);
    },
  });
  try { return (await import("../components/PaintingCoach")).PaintingCoach; }
  finally { styles.deregister(); }
})();

test("the painting coach exposes help and its composer inline without a modal trigger", async () => {
  const Coach = await coach;
  const guide = getGuide("ultramarines-classic")!;
  const html = renderToStaticMarkup(createElement(Coach, { guide, step: guide.steps[0], onShowExample: () => {} }));
  assert.match(html, /<section class="painting-coach" aria-labelledby=/);
  assert.match(html, /<h2[^>]*>Help with this step<\/h2>/);
  assert.match(html, /painting-coach-badge[\s\S]*?>AI<\/span>/);
  assert.match(html, /My coat looks patchy/);
  assert.match(html, /How much paint goes on the brush\?/);
  assert.match(html, /<textarea[^>]*aria-describedby=/);
  assert.match(html, /Your notes stay private/);
  assert.doesNotMatch(html, /role="dialog"|painting-coach-overlay|painting-coach-trigger|aria-haspopup="dialog"/);
  assert.equal((html.match(/<button/g) ?? []).length, 3, "two suggested questions and one composer action");
});

test("all step types get two questions and no unrequested demonstration action", async () => {
  const Coach = await coach;
  for (const guide of guides) {
    for (const step of guide.steps) {
      const html = renderToStaticMarkup(createElement(Coach, { guide, step, onShowExample: () => {} }));
      const suggested = html.match(/<div class="painting-coach-prompts"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
      assert.equal((suggested.match(/<button/g) ?? []).length, 2, `${guide.id}/${step.id}`);
      assert.doesNotMatch(html, /class="painting-coach-example"/, "Show me appears only after a reviewed response");
      if (!lessonExamples(guide.id, step.id).length) {
        assert.doesNotMatch(suggested, /coat looks patchy|highlight is too wide|shade spreads|much pressure/);
      }
    }
  }
});
