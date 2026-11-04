const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const { test } = require("node:test");
const { createStudygramServer } = require("../server/index");
const { PASSAGES } = require("../server/wisdom-passages");

function growthEndpoint(model) {
  const server = createStudygramServer(model);
  return input => new Promise(resolve => {
    const request = Object.assign(Readable.from([Buffer.from(JSON.stringify(input))]), {
      url: "/api/growth", method: "POST", headers: { "content-type": "application/json", host: "localhost" },
      socket: { remoteAddress: "127.0.0.1" },
    });
    const headers = new Headers();
    const response = {
      setHeader: (name, value) => headers.set(name, value),
      writeHead(status, values) {
        this.status = status;
        for (const [name, value] of Object.entries(values)) headers.set(name, value);
      },
      end(body) { resolve(new Response(body, { status: this.status, headers })); },
    };
    server.emit("request", request, response);
  });
}

const prompt = { kind: "prompt", level: "Beginner", completed: 0 };
const encouragement = { kind: "encouragement", activity: "writing", count: 1, days: 1 };
const lesson = {
  kind: "recall", explanation: "  A derivative measures change.  ",
  context: { type: "lesson", title: "Rates of change", points: ["  The derivative is an instantaneous rate.  "] },
};
const feedback = {
  understood: "You identified that a derivative measures change.",
  misconception: "",
  followUp: "How does an instantaneous rate differ from an average rate?",
  nextStep: "Compare the slope of a secant and a tangent on the same curve.",
};

test("Growth projects only selected prompt settings and numeric activity metrics", async () => {
  const requests = [];
  const post = growthEndpoint(async ({ input }) => {
    requests.push(input);
    return JSON.stringify(input.kind === "prompt"
      ? { prompt: "Describe a city you can hear before you can see it." }
      : { message: "You made time to write today. Try another short session when you’re ready." });
  });
  const privateFields = { draft: "my writing draft", journal: "my journal entry", profile: { name: "my name" } };
  const suggested = await post({
    ...prompt, ...privateFields, interest: "  Cities  ", approach: " ", goal: "Practice imagery", unrelated: true,
  });
  assert.equal(suggested.status, 200);
  assert.equal(suggested.headers.get("cache-control"), "no-store");
  assert.deepEqual(await suggested.json(), { prompt: "Describe a city you can hear before you can see it." });

  const encouraged = await post({ ...encouragement, ...privateFields, text: "my personal note" });
  assert.equal(encouraged.status, 200);
  assert.deepEqual(await encouraged.json(), { message: "You made time to write today. Try another short session when you’re ready." });
  assert.deepEqual(requests, [
    { kind: "prompt", interest: "Cities", goal: "Practice imagery", level: "Beginner", completed: 0 },
    { kind: "encouragement", activity: "writing", count: 1, days: 1 },
  ]);
});

test("Growth recall supplies only lesson points or the server’s reviewed passage", async () => {
  const requests = [];
  const post = growthEndpoint(async ({ input }) => {
    requests.push(input);
    return JSON.stringify(feedback);
  });

  const response = await post({ ...lesson, context: { ...lesson.context, journal: "private" } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), feedback);
  assert.deepEqual(requests[0], {
    kind: "recall", explanation: "A derivative measures change.",
    context: { type: "lesson", title: "Rates of change", points: ["The derivative is an instantaneous rate."] },
  });

  for (const id of ["gita", "bible"]) {
    const passage = await post({
      kind: "recall", explanation: "This is my interpretation.",
      context: { type: "passage", id, text: "A forged quotation.", reference: "A false reference." },
    });
    assert.equal(passage.status, 200, id);
    const { text, reference, edition } = PASSAGES[id];
    assert.deepEqual(requests.at(-1), {
      kind: "recall", explanation: "This is my interpretation.",
      context: { type: "passage", id, text, reference, edition },
    });
  }
});

test("Growth rejects invalid input before calling the model", async () => {
  let modelCalls = 0;
  const post = growthEndpoint(async () => { modelCalls += 1; return "{}"; });
  for (const input of [
    [], { kind: "unknown" }, { ...prompt, level: "expert" }, { ...prompt, completed: -1 },
    { ...prompt, interest: "a".repeat(161) }, { ...prompt, goal: { text: "private" } },
    { ...encouragement, activity: "draft" }, { ...encouragement, count: 1_000_001 },
    { ...encouragement, days: "1" }, { ...encouragement, days: 36_601 },
    { ...lesson, explanation: " " }, { ...lesson, explanation: "a".repeat(2001) },
    { ...lesson, context: { type: "passage", id: "constructor" } },
    { ...lesson, context: { ...lesson.context, title: "a".repeat(121) } },
    { ...lesson, context: { ...lesson.context, points: [" "] } },
    { ...lesson, context: { ...lesson.context, points: Array(7).fill("A lesson point.") } },
    { ...lesson, context: { ...lesson.context, points: ["a".repeat(501)] } },
  ]) {
    assert.equal((await post(input)).status, 400, JSON.stringify(input));
  }
  assert.equal(modelCalls, 0);
});

test("Growth requires the exact bounded output fields for each kind", async () => {
  const cases = [
    [prompt, { message: "A response for the wrong activity." }],
    [prompt, { prompt: " " }],
    [encouragement, { message: "Keep going.", score: 100 }],
    [encouragement, { message: "a".repeat(501) }],
    [lesson, { ...feedback, misconception: null }],
    [lesson, { ...feedback, understood: "" }],
    [lesson, { ...feedback, nextStep: undefined }],
    [lesson, { ...feedback, rank: "Advanced" }],
  ];
  let output;
  const post = growthEndpoint(async () => JSON.stringify(output));
  for (const [input, result] of cases) {
    output = result;
    assert.equal((await post(input)).status, 502, JSON.stringify(result));
  }
});

test("Growth inherits the adult demo gate even with a Meta key configured", async t => {
  const demo = process.env.STUDYGRAM_ADULT_DEMO;
  const key = process.env.MODEL_API_KEY;
  t.after(() => {
    if (demo === undefined) delete process.env.STUDYGRAM_ADULT_DEMO;
    else process.env.STUDYGRAM_ADULT_DEMO = demo;
    if (key === undefined) delete process.env.MODEL_API_KEY;
    else process.env.MODEL_API_KEY = key;
  });
  process.env.STUDYGRAM_ADULT_DEMO = "0";
  process.env.MODEL_API_KEY = "growth-test-key";
  const fetchMock = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected Meta request"); });
  const post = growthEndpoint();
  assert.equal((await post(prompt)).status, 503);
  assert.equal(fetchMock.mock.callCount(), 0);
});
