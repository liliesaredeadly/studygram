const assert = require("node:assert/strict");
const { once } = require("node:events");
const { test } = require("node:test");
const { createStudygramServer } = require("../server/index");
const { generateText } = require("../server/model");

function environment(t, values = {}) {
  const original = Object.fromEntries(Object.keys(values).map(name => [name, process.env[name]]));
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  t.after(() => {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
}

async function openServer(t, model) {
  const server = createStudygramServer(model, {}, {}, { databasePath: ":memory:" });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, headers = {}) => fetch(base + path, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: base, ...headers },
    body: JSON.stringify(body),
  });
  async function register(username) {
    const response = await post("/api/community/register", { username, password: "meta-connection-test-password" });
    assert.equal(response.status, 201);
    return { cookie: response.headers.get("set-cookie").split(";")[0], ...(await response.json()).user };
  }
  return { base, post, register };
}

function metaNetwork(t, handler) {
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", (url, options) => {
    if (String(url).startsWith("https://api.meta.ai/")) return handler(String(url), options);
    return originalFetch(url, options);
  });
}

const credentials = (user, key = "personal-meta-key") => ({
  Cookie: user.cookie, "X-Studygram-Meta-Key": key, "X-Studygram-Meta-Adult": "1",
});
const completion = value => new Response(JSON.stringify({
  id: "test-completion", object: "chat.completion", created: 1, model: "muse-spark-1.3",
  choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(value) }, finish_reason: "stop" }],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
}));
const modelInput = { instructions: "Return a lesson", input: { name: "Algebra" } };

test("a server environment key never replaces a missing personal key", async t => {
  environment(t, { STUDYGRAM_ADULT_DEMO: "1", MODEL_API_KEY: "shared-key-must-not-be-used" });
  t.mock.method(globalThis, "fetch", async () => assert.fail("Missing personal key reached Meta"));
  await assert.rejects(generateText(modelInput), { status: 428, code: "META_CONNECTION_REQUIRED" });
});

test("concurrent generations keep each key outside the prompt and the shared environment", async t => {
  environment(t, { STUDYGRAM_ADULT_DEMO: "1", MODEL_API_KEY: "unused-shared-key", META_MODEL: "muse-spark-1.3" });
  const pending = [];
  t.mock.method(globalThis, "fetch", (url, options) => new Promise(resolve => {
    assert.equal(url, "https://api.meta.ai/v1/chat/completions");
    assert.equal(options.redirect, "error");
    assert.doesNotMatch(options.body, /first-key|second-key|unused-shared-key/);
    pending.push({ authorization: options.headers.Authorization, resolve });
    if (pending.length === 2) {
      for (const request of pending.reverse()) request.resolve(completion({ draft: request.authorization }));
    }
  }));
  const replies = await Promise.all([
    generateText({ ...modelInput, apiKey: "first-key" }),
    generateText({ ...modelInput, apiKey: "second-key" }),
  ]);
  assert.deepEqual(replies.map(reply => JSON.parse(reply).draft), ["Bearer first-key", "Bearer second-key"]);
  assert.equal(process.env.MODEL_API_KEY, "unused-shared-key");
});

test("malformed personal keys are rejected before contacting Meta", async t => {
  environment(t, { STUDYGRAM_ADULT_DEMO: "1", MODEL_API_KEY: undefined });
  t.mock.method(globalThis, "fetch", async () => assert.fail("Invalid key reached Meta"));
  for (const apiKey of ["has spaces", "line\nbreak", "tab\tkey", "non-ascii-\u00e9", "x".repeat(2049), ["array-key"]]) {
    await assert.rejects(generateText({ ...modelInput, apiKey }), { status: 422, code: "META_KEY_INVALID" });
  }
});

test("Meta provider failures expose fixed actionable errors rather than the provider body", async t => {
  environment(t, { STUDYGRAM_ADULT_DEMO: "1" });
  let status;
  t.mock.method(globalThis, "fetch", async () => new Response("sensitive provider body: personal-meta-key", { status }));
  for (const [providerStatus, expectedStatus, code] of [
    [401, 422, "META_KEY_REJECTED"], [402, 422, "META_BILLING_REQUIRED"],
    [403, 403, "META_PERMISSION_DENIED"], [404, 422, "META_MODEL_UNAVAILABLE"],
    [429, 429, "META_RATE_LIMITED"], [500, 502, "META_UNAVAILABLE"],
  ]) {
    status = providerStatus;
    await assert.rejects(generateText({ ...modelInput, apiKey: "personal-meta-key" }), error => {
      assert.equal(error.status, expectedStatus);
      assert.equal(error.code, code);
      assert.doesNotMatch(error.message, /sensitive provider body|personal-meta-key/);
      return true;
    });
  }
});

test("connection configuration exposes only operator enablement and the model", async t => {
  environment(t, { STUDYGRAM_ADULT_DEMO: "0", META_MODEL: "configured-model", MODEL_API_KEY: "must-stay-private" });
  const { base } = await openServer(t);
  const response = await fetch(base + "/api/meta-connection");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { enabled: false, model: "configured-model" });
});

test("connecting checks only server-controlled model metadata and never saves or returns the key", async t => {
  environment(t, { STUDYGRAM_ADULT_DEMO: "1", META_MODEL: "muse-spark-1.3" });
  const { base, post, register } = await openServer(t);
  const user = await register("meta-owner");
  let requests = 0;
  metaNetwork(t, async (url, options) => {
    requests++;
    assert.equal(url, "https://api.meta.ai/v1/models/muse-spark-1.3");
    assert.equal(options.method, "GET");
    assert.equal(options.headers.Authorization, "Bearer personal-meta-key");
    assert.equal(options.body, undefined);
    assert.equal(options.redirect, "error");
    return new Response(JSON.stringify({ id: "muse-spark-1.3", object: "model", created: 1, owned_by: "meta" }));
  });
  const response = await post("/api/meta-connection", { accountId: user.id, model: "untrusted-model" }, credentials(user));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { connected: true, model: "muse-spark-1.3" });
  assert.equal(requests, 1);
  const privateState = await fetch(base + "/api/community/private-state", { headers: { Cookie: user.cookie } });
  assert.deepEqual((await privateState.json()).data, {});
});

test("connecting requires an active matching account, valid key and adult confirmation", async t => {
  environment(t, { STUDYGRAM_ADULT_DEMO: "1" });
  const { post, register } = await openServer(t);
  const user = await register("meta-guards");
  metaNetwork(t, async () => assert.fail("Rejected connection reached Meta"));
  const cases = [
    [{ accountId: user.id }, { "X-Studygram-Meta-Key": "key", "X-Studygram-Meta-Adult": "1" }, 401, undefined],
    [{ accountId: user.id + 1 }, credentials(user), 409, undefined],
    [{}, credentials(user), 409, undefined],
    [{ accountId: user.id }, { Cookie: user.cookie, "X-Studygram-Meta-Adult": "1" }, 428, "META_CONNECTION_REQUIRED"],
    [{ accountId: user.id }, { Cookie: user.cookie, "X-Studygram-Meta-Key": "key" }, 428, "META_ADULT_REQUIRED"],
    [{ accountId: user.id }, credentials(user, "has spaces"), 422, "META_KEY_INVALID"],
    [{ accountId: user.id }, credentials(user, "x".repeat(2049)), 422, "META_KEY_INVALID"],
  ];
  for (const [body, headers, status, code] of cases) {
    const response = await post("/api/meta-connection", body, headers);
    assert.equal(response.status, status);
    if (code) assert.equal((await response.json()).code, code);
  }
});

test("adult confirmation cannot enable the operator-disabled Meta service", async t => {
  environment(t, { STUDYGRAM_ADULT_DEMO: "0" });
  const { post, register } = await openServer(t);
  const user = await register("meta-disabled");
  metaNetwork(t, async () => assert.fail("Disabled service reached Meta"));
  for (const [path, body] of [["/api/meta-connection", {}], ["/api/diary-draft", { entry: "Notes" }]]) {
    const response = await post(path, { ...body, accountId: user.id }, credentials(user));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "META_DISABLED");
  }
});

test("every AI task rejects a stale account before invoking an injected model", async t => {
  const { post, register } = await openServer(t, async () => assert.fail("Wrong account reached model"));
  const user = await register("meta-isolation");
  const tasks = [
    ["study-set", { name: "Algebra" }],
    ["lily", { message: "Help with algebra", history: [], questionCount: 0 }],
    ["diary", { entry: "Studied algebra" }], ["diary-draft", { entry: "Studied algebra" }],
    ["explore", { category: "science", message: "What is evaporation?" }],
    ["growth", { kind: "prompt", level: "Beginner", completed: 0 }],
    ["pursuit", { kind: "plan", interest: "Football", answers: { ageBand: "adult" } }],
  ];
  for (const [task, input] of tasks) {
    const response = await post(`/api/${task}`, { ...input, accountId: user.id + 1 }, credentials(user));
    assert.equal(response.status, 409, task);
  }
});

test("the real AI route requires each account's own credential and keeps prompts isolated", async t => {
  environment(t, { STUDYGRAM_ADULT_DEMO: "1", MODEL_API_KEY: "shared-key-must-not-be-used" });
  const { post, register } = await openServer(t);
  const first = await register("meta-first");
  const second = await register("meta-second");
  const requests = [];
  metaNetwork(t, async (_url, options) => {
    const input = JSON.parse(JSON.parse(options.body).messages[1].content);
    requests.push({ authorization: options.headers.Authorization, input });
    assert.doesNotMatch(options.body, /first-personal-key|second-personal-key|accountId|shared-key/);
    return completion({ draft: `Draft for ${input.entry}` });
  });
  const anonymous = await post("/api/diary-draft", { entry: "Notes" }, credentials({ cookie: "" }));
  assert.equal(anonymous.status, 401);
  const disconnected = await post("/api/diary-draft", { entry: "Notes", accountId: first.id }, {
    Cookie: first.cookie, "X-Studygram-Meta-Adult": "1",
  });
  assert.equal(disconnected.status, 428);
  assert.equal(requests.length, 0);
  const responses = await Promise.all([
    post("/api/diary-draft", { entry: "First notes", accountId: first.id }, credentials(first, "first-personal-key")),
    post("/api/diary-draft", { entry: "Second notes", accountId: second.id }, credentials(second, "second-personal-key")),
  ]);
  assert.deepEqual(await Promise.all(responses.map(response => response.json())), [
    { draft: "Draft for First notes" }, { draft: "Draft for Second notes" },
  ]);
  assert.deepEqual(requests.sort((a, b) => a.input.entry.localeCompare(b.input.entry)), [
    { authorization: "Bearer first-personal-key", input: { entry: "First notes" } },
    { authorization: "Bearer second-personal-key", input: { entry: "Second notes" } },
  ]);
});

test("connection and generation errors retain safe codes and never sign out a rejected-key user", async t => {
  environment(t, { STUDYGRAM_ADULT_DEMO: "1" });
  const { post, register } = await openServer(t);
  const user = await register("meta-errors");
  let failure = 401;
  metaNetwork(t, async () => {
    if (failure === "timeout") throw new DOMException("private timeout details", "TimeoutError");
    if (failure === "network") throw new Error("private network details personal-meta-key");
    if (failure === "invalid-json") return new Response("private provider text");
    if (failure === "wrong-model") return new Response(JSON.stringify({ id: "different-model" }));
    return new Response("private provider body personal-meta-key", { status: failure });
  });
  for (const [value, status, code] of [
    [401, 422, "META_KEY_REJECTED"], [402, 422, "META_BILLING_REQUIRED"], [403, 403, "META_PERMISSION_DENIED"],
    [404, 422, "META_MODEL_UNAVAILABLE"], [429, 429, "META_RATE_LIMITED"],
    ["timeout", 504, "META_TIMEOUT"], ["network", 502, "META_UNAVAILABLE"],
    ["invalid-json", 502, "META_UNAVAILABLE"], ["wrong-model", 502, "META_UNAVAILABLE"],
  ]) {
    failure = value;
    const response = await post("/api/meta-connection", { accountId: user.id }, credentials(user));
    assert.equal(response.status, status, String(value));
    const body = await response.json();
    assert.equal(body.code, code, String(value));
    assert.doesNotMatch(JSON.stringify(body), /private|personal-meta-key/);
  }
  failure = 401;
  const generation = await post("/api/diary-draft", { entry: "Notes", accountId: user.id }, credentials(user));
  assert.equal(generation.status, 422);
  assert.equal((await generation.json()).code, "META_KEY_REJECTED");
});
