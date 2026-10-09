import assert from "node:assert/strict";
import test from "node:test";
import { getGuide } from "./guides";
import { reviewedCoachReply, type CoachResponse } from "./coach";
import { requestCoachReply } from "./coach-request";

const guide = getGuide("ultramarines-classic")!;
const step = guide.steps[0];
const question = "How do I load the brush?";
const valid: CoachResponse = {
  kind: "ai", answer: "Draw off excess liquid on the palette and reform the point.",
  nextAction: "Test a short stroke before touching the model.",
  exampleId: "load-brush", sources: guide.sources, retryable: false,
};
const signal = () => new AbortController().signal;

test("coach transport sends only the current lesson and question, preserving validated server recovery", async () => {
  let calls = 0;
  for (const reply of [valid, reviewedCoachReply(guide, step, question, false)]) {
    const result = await requestCoachReply(guide, step, question, signal(), {
      fetcher: async (url, init) => {
        calls++;
        assert.equal(url, "/api/coach");
        assert.equal(init?.method, "POST");
        assert.deepEqual(JSON.parse(String(init?.body)), { guideId: guide.id, stepId: step.id, question });
        assert.ok(init?.signal);
        return Response.json(reply);
      },
    });
    assert.deepEqual(result, reply);
  }
  assert.equal(calls, 2);
});

test("network, HTTP, JSON and invalid lesson examples use the same reviewed recovery without leaking errors", async () => {
  const failures: (typeof fetch)[] = [
    async () => { throw new Error("Private gateway configuration"); },
    async () => new Response("Provider is unavailable", { status: 503 }),
    async () => new Response("Not JSON", { status: 200 }),
    async () => Response.json({ ...valid, answer: "<script>not plain text</script>" }),
    async () => Response.json({ ...valid, exampleId: "drybrush-contact" }),
    async () => Response.json({ ...valid, exampleId: "missing-example" }),
  ];
  for (const fetcher of failures) {
    const result = await requestCoachReply(guide, step, question, signal(), { fetcher });
    assert.deepEqual(result, reviewedCoachReply(guide, step, question, true));
    assert.doesNotMatch(JSON.stringify(result), /Private gateway|Provider is unavailable|Not JSON|script/);
  }
});

test("a request timeout recovers with authored guidance and remains retryable", async () => {
  const timeout = new AbortController();
  const result = requestCoachReply(guide, step, question, signal(), {
    timeoutSignal: timeout.signal,
    fetcher: async (_url, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason), { once: true });
    }),
  });
  timeout.abort(new DOMException("Timed out", "TimeoutError"));
  assert.deepEqual(await result, reviewedCoachReply(guide, step, question, true));
});

test("closing before or during a request cancels silently rather than adding a fallback answer", async () => {
  const closed = new AbortController();
  closed.abort();
  let calls = 0;
  assert.equal(await requestCoachReply(guide, step, question, closed.signal, {
    fetcher: async () => { calls++; return Response.json(valid); },
  }), null);
  assert.equal(calls, 0);

  const active = new AbortController();
  const result = requestCoachReply(guide, step, question, active.signal, {
    fetcher: async (_url, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason), { once: true });
    }),
  });
  active.abort();
  assert.equal(await result, null);
});

test("a late response after cancellation cannot replace a reopened conversation's answer", async () => {
  const oldRequest = new AbortController();
  let finishOld!: (response: Response) => void;
  const oldResult = requestCoachReply(guide, step, question, oldRequest.signal, {
    // Some transports can finish despite abort. Guard the parsed response too.
    fetcher: () => new Promise(resolve => { finishOld = resolve; }),
  });
  oldRequest.abort();
  const nextResult = await requestCoachReply(guide, step, "What should I look for?", signal(), {
    fetcher: async () => Response.json({ ...valid, answer: "Keep the surface texture visible." }),
  });
  finishOld(Response.json(valid));
  assert.equal(await oldResult, null);
  assert.equal(nextResult?.answer, "Keep the surface texture visible.");
});

test("cancellation while the response body is decoding also stays silent", async () => {
  const controller = new AbortController();
  let started!: () => void;
  const bodyStarted = new Promise<void>(resolve => { started = resolve; });
  let finishBody!: (body: CoachResponse) => void;
  const response = Response.json(valid);
  response.json = async () => {
    started();
    return new Promise(resolve => { finishBody = resolve; });
  };
  const result = requestCoachReply(guide, step, question, controller.signal, { fetcher: async () => response });
  await bodyStarted;
  controller.abort();
  finishBody(valid);
  assert.equal(await result, null);
});
