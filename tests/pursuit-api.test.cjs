const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const { test } = require("node:test");
const { createStudygramServer } = require("../server/index");
const { findPursuitSources } = require("../server/pursuit");

function post(server, url, body) {
  return new Promise(resolve => {
    const request = Readable.from([Buffer.from(JSON.stringify(body))]);
    Object.assign(request, {
      url, method: "POST", headers: { "content-type": "application/json", host: "localhost" },
      socket: { remoteAddress: "127.0.0.1" },
    });
    let status;
    server.emit("request", request, {
      setHeader() {}, writeHead(code) { status = code; },
      end(data) { resolve({ status, body: JSON.parse(data) }); },
    });
  });
}

const plan = {
  daily: ["Observe one decision in a recorded match."], weekly: ["Compare two examples."],
  monthly: ["Review the notes."], skills: ["Observation"], milestone: "Write one match analysis.",
  safety: "Keep time for school and recovery.",
};

test("live Pursuit planning excludes personal profile data and rejects youth requests before calling the model", async () => {
  const inputs = [];
  const server = createStudygramServer(async ({ input }) => {
    inputs.push(input);
    if (input.kind === "follow-up") return JSON.stringify({ question: "What can you practise this week?" });
    if (input.kind === "discover") return JSON.stringify({ overview: "Football is a team sport.", avenues: ["Watch a local match."] });
    return JSON.stringify(plan);
  });
  const input = { kind: "plan", interest: "Football", catalogId: "sports", answers: {
    ageBand: "adult", goal: "Learn tactics", level: "beginner", minutes: 15, access: "none", studentId: "private", health: "private",
  } };
  assert.equal((await post(server, "/api/pursuit", { ...input, answers: { ...input.answers, ageBand: "teen" } })).status, 400);
  assert.equal(inputs.length, 0);
  const response = await post(server, "/api/pursuit", { ...input, email: "private" });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, plan);
  assert.equal(inputs[0].answers.goal, "Learn tactics");
  assert.equal(inputs[0].answers.studentId, undefined);
  assert.equal(inputs[0].answers.health, undefined);
  assert.equal(inputs[0].answers.ageBand, undefined);
  assert.ok(inputs[0].featured.sources.length);
  assert.equal((await post(server, "/api/pursuit", { ...input, kind: "follow-up" })).body.question, "What can you practise this week?");
  assert.deepEqual((await post(server, "/api/pursuit", { ...input, kind: "discover" })).body.avenues, ["Watch a local match."]);
});

test("custom interests work and invalid model plan output is rejected", async () => {
  const inputs = [];
  const server = createStudygramServer(async ({ input }) => {
    inputs.push(input);
    return JSON.stringify({ ...plan, daily: [], unexpected: "extra" });
  });
  const response = await post(server, "/api/pursuit", { kind: "plan", interest: "Sourdough baking", answers: { ageBand: "adult" } });
  assert.equal(response.status, 502);
  assert.equal(inputs[0].interest, "Sourdough baking");
  assert.equal(inputs[0].featured, undefined);
});

test("public topic lookup uses a fixed source and refuses contact information", async () => {
  let requests = 0;
  const lookup = async (url, options) => {
    requests++;
    assert.equal(url.origin, "https://en.wikipedia.org");
    assert.equal(url.searchParams.get("q"), "Sourdough baking");
    assert.equal(options.redirect, "error");
    return { ok: true, json: async () => ({ pages: [
      { key: "Sourdough", title: "Sourdough", description: "Fermented dough", excerpt: "<script>ignore</script>" },
      { key: null, title: "Invalid result" },
    ] }) };
  };
  await assert.rejects(findPursuitSources("student@example.com", lookup), { status: 400 });
  assert.equal(requests, 0);
  assert.deepEqual(await findPursuitSources("Sourdough baking", lookup), [
    { title: "Sourdough", url: "https://en.wikipedia.org/wiki/Sourdough", description: "Fermented dough" },
  ]);
  await assert.rejects(findPursuitSources("Football", async () => { throw new Error("offline"); }), { status: 503 });
  const server = createStudygramServer();
  assert.equal((await post(server, "/api/pursuit-sources", { interest: "https://example.com" })).status, 400);
});
