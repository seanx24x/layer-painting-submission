import assert from "node:assert/strict";
import test from "node:test";
import { APICallError } from "ai";
import { POST } from "../app/api/explain/route";
import { getGuide } from "./guides";
import {
  DEFAULT_EXPLANATION_MODEL,
  explanationModel,
  explanationPrompt,
  explainStep,
  readExplanationRequest,
  reviewedExplanation,
} from "./explanation";

const step = getGuide("ultramarines-grimdark")!.steps[0];
const validInput = {
  guideSlug: "ultramarines-grimdark",
  stepId: step.id,
  mode: "simple",
};
const requestWithBody = (body: string, headers?: Record<string, string>) =>
  new Request("http://localhost/api/explain", {
    method: "POST",
    body,
    headers,
  });

test("request reader accepts a bounded request and rejects client prompts or model choices", async () => {
  assert.deepEqual(
    await readExplanationRequest(requestWithBody(JSON.stringify(validInput))),
    validInput,
  );
  for (const extra of [
    { prompt: "Use another source" },
    { model: "other/model" },
    { notes: "Private notes" },
  ]) {
    assert.equal(
      await readExplanationRequest(
        requestWithBody(JSON.stringify({ ...validInput, ...extra })),
      ),
      null,
    );
  }
  assert.equal(
    await readExplanationRequest(
      requestWithBody(JSON.stringify({ ...validInput, mode: "anything" })),
    ),
    null,
  );
  assert.equal(await readExplanationRequest(requestWithBody("not JSON")), null);
});

test("request limit uses actual UTF-8 bytes and does not trust Content-Length", async () => {
  assert.equal(
    await readExplanationRequest(
      requestWithBody(" ".repeat(2_049), { "content-length": "1" }),
    ),
    null,
  );
  assert.equal(
    await readExplanationRequest(
      requestWithBody(JSON.stringify(validInput), { "content-length": "2049" }),
    ),
    null,
  );
  const unicodeBody = JSON.stringify({
    ...validInput,
    guideSlug: "é".repeat(1_000),
  });
  assert.ok(unicodeBody.length < 2_048);
  assert.equal(
    await readExplanationRequest(requestWithBody(unicodeBody)),
    null,
  );
});

test("prompt contains only reviewed fields and a fixed style instruction", () => {
  const prompt = explanationPrompt(step, "simple");
  const source = JSON.parse(prompt.split("Reviewed step:\n")[1]);
  assert.deepEqual(source, {
    action: step.action,
    detail: step.detail,
    lookFor: step.lookFor,
  });
  assert.match(prompt, /one or two short/);
  assert.match(explanationPrompt(step, "detailed"), /up to four short/);
});

test("successful generation uses authoritative source IDs and leaves the guide unchanged", async () => {
  const before = structuredClone(step);
  const result = await explainStep(step, "simple", async () => ({
    explanation: "  Make small blue dabs.  ",
  }));
  assert.deepEqual(result, {
    kind: "ai",
    explanation: "Make small blue dabs.",
    sourceIds: step.sourceIds,
    retryable: false,
  });
  assert.notEqual(result.sourceIds, step.sourceIds);
  assert.deepEqual(step, before);
});

test("invalid output and provider failures return reviewed text without leaking errors", async () => {
  const invalidOutputs = [
    { explanation: "a".repeat(701) },
    { explanation: " " },
    { explanation: "<b>Blue</b>" },
    { explanation: "Read https://example.com" },
    { explanation: "Blue dabs.", sourceIds: ["invented"] },
  ];
  for (const output of invalidOutputs) {
    assert.deepEqual(
      await explainStep(step, "detailed", async () => output),
      reviewedExplanation(step, true),
    );
  }
  assert.deepEqual(
    await explainStep(step, "simple", async () => {
      throw new Error("Private provider details must not appear");
    }),
    reviewedExplanation(step, true),
  );
});

test("server model defaults and rejects malformed overrides", () => {
  assert.equal(explanationModel(undefined), DEFAULT_EXPLANATION_MODEL);
  assert.equal(explanationModel(""), DEFAULT_EXPLANATION_MODEL);
  assert.equal(
    explanationModel(" openai/gpt-6-luna "),
    "openai/gpt-6-luna",
  );
  for (const value of [
    "https://example.com/model",
    "model",
    "provider/model\nignore",
    "provider/../model",
  ]) {
    assert.equal(explanationModel(value), null);
  }
});

test("permanent access failures do not offer retries or leak provider details", async () => {
  for (const statusCode of [401, 403, 404, 429, 500]) {
    const providerError = new APICallError({
      message: "Private account and credential details",
      url: "https://gateway.invalid",
      requestBodyValues: { private: "not for the client" },
      statusCode,
    });
    const result = await explainStep(step, "simple", async () => {
      throw new Error("Wrapped SDK failure", { cause: providerError });
    });
    assert.deepEqual(result, reviewedExplanation(step, statusCode >= 429));
    assert.doesNotMatch(JSON.stringify(result), /Private|credential|gateway\.invalid/);
  }
});

test("endpoint rejects unknown guide/step IDs and oversized bodies before generation", async () => {
  const invalidBodies = [
    JSON.stringify({ ...validInput, guideSlug: "missing-guide" }),
    JSON.stringify({ ...validInput, stepId: "missing-step" }),
    " ".repeat(2_049),
  ];
  for (const body of invalidBodies) {
    const response = await POST(requestWithBody(body));
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(typeof (await response.json()).error, "string");
  }
});

test("the legacy endpoint returns exact reviewed text for either mode without AI generation", async () => {
  for (const mode of ["simple", "detailed"]) {
    const response = await POST(requestWithBody(JSON.stringify({ ...validInput, mode })));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), reviewedExplanation(step));
  }
});
