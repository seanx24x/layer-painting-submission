import assert from "node:assert/strict";
import test from "node:test";
import { guides, type GuidePaint } from "./guides";
import { materialInstructions } from "./material-instructions";

const paint: GuidePaint = { id: "leadbelcher", name: "Leadbelcher", hex: "#888D91", role: "Metal" };

test("every published materials action retains its exact instruction and declared paint", () => {
  const materialSteps = guides.flatMap(guide => guide.steps.filter(step => step.id === "materials").map(step => ({ guide, step })));
  assert.equal(materialSteps.length, 34);
  for (const { guide, step } of materialSteps) {
    const rows = materialInstructions(step, guide.paints);
    assert.equal(rows.map(row => row.text).join(" "), step.action, guide.id);
    assert.ok(rows.every(row => row.kind === "material"), `${guide.id} has an unmapped materials instruction`);
    for (const row of rows) {
      if (row.kind !== "material") continue;
      assert.ok(step.paintIds.includes(row.paint.id), `${guide.id} uses a paint outside this step`);
      assert.equal(row.text, `Use ${row.paint.name} for ${row.area}`);
      assert.equal(row.paint, guide.paints.find(candidate => candidate.id === row.paint.id));
    }
  }
});

test("repeated paints stay attached to every distinct material action", () => {
  for (const [guideId, paintName] of [["deathwatch-veteran", "Leadbelcher"], ["death-guard-plague-marine", "Rakarth Flesh"]]) {
    const guide = guides.find(item => item.id === guideId)!;
    const step = guide.steps.find(item => item.id === "materials")!;
    const rows = materialInstructions(step, guide.paints).filter(row => row.kind === "material" && row.paint.name === paintName);
    assert.equal(rows.length, 2, guideId);
    assert.notEqual(rows[0].text, rows[1].text);
  }
});

test("unrecognised prose and undeclared paints remain unchanged rather than being guessed", () => {
  const action = "Let the first area dry. Use Leadbelcher for exposed metal. Use Ironbreaker for raised edges. Apply Leadbelcher to the blade.";
  const rows = materialInstructions({ id: "materials", action, paintIds: [paint.id] }, [paint]);
  assert.deepEqual(rows.map(row => row.kind), ["explanation", "material", "explanation", "explanation"]);
  assert.equal(rows.map(row => row.text).join(" "), action);
  assert.equal(materialInstructions({ id: "materials", action: "Use Leadbelcher for metal.", paintIds: [] }, [paint])[0].kind, "explanation");
  assert.deepEqual(materialInstructions({ id: "shade", action, paintIds: [paint.id] }, [paint]), []);
});

test("ambiguous exact names fail closed without losing the instruction", () => {
  const rows = materialInstructions({ id: "materials", action: "Use Leadbelcher for exposed metal.", paintIds: [paint.id, "other-range"] }, [paint, { ...paint, id: "other-range" }]);
  assert.deepEqual(rows, [{ kind: "explanation", text: "Use Leadbelcher for exposed metal." }]);
});
