const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");

function sampleContent() {
  return vm.runInNewContext(readFileSync("js/sample-study.js", "utf8") + "\nKMAP_SAMPLE.content");
}

test("Meta requests require demo mode and send the key only in the server header", async t => {
  const { generateText } = require("../server/model");
  const original = Object.fromEntries(
    ["STUDYGRAM_ADULT_DEMO", "MODEL_API_KEY", "META_MODEL"].map(name => [name, process.env[name]]),
  );
  t.after(() => {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  process.env.STUDYGRAM_ADULT_DEMO = "0";
  process.env.MODEL_API_KEY = "test-only-key";
  process.env.META_MODEL = "test-model";
  const fetchMock = t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.meta.ai/v1/chat/completions");
    assert.equal(options.headers.Authorization, "Bearer test-only-key");
    const body = JSON.parse(options.body);
    assert.equal(body.model, "test-model");
    assert.equal(body.messages[1].content, '{"name":"K-maps"}');
    assert.doesNotMatch(options.body, /test-only-key/);
    return new Response(JSON.stringify({ choices: [{ message: { content: "test reply" } }] }));
  });
  const input = { instructions: "Generate a lesson", input: { name: "K-maps" } };
  await assert.rejects(generateText(input), error => error.status === 503);
  assert.equal(fetchMock.mock.callCount(), 0);
  process.env.STUDYGRAM_ADULT_DEMO = "1";
  assert.equal(await generateText(input), "test reply");
});

test("new and legacy study sets keep stable IDs and source notes", () => {
  const records = new Map([["sg_topics", '[{"id":42,"name":"K-maps","originalSummary":"Source"}]']]);
  const localStorage = {
    getItem: key => records.get(key),
    setItem: (key, value) => records.set(key, value),
  };
  const context = vm.createContext({ localStorage });
  vm.runInContext(readFileSync("js/storage.js", "utf8"), context);
  assert.equal(vm.runInContext("Storage.getTopicById('42').sourceText", context), "Source");
  const id = vm.runInContext("Storage.saveStudySet({ name: 'Algebra', sourceText: 'Notes' }).id", context);
  assert.equal(vm.runInContext(`Storage.getTopicById(${id}).sourceText`, context), "Notes");
  assert.notEqual(id, 42);
});

test("a topic opened directly gets a study-set ID and reuses its generated quiz", async () => {
  const context = vm.createContext({
    window: { location: { protocol: "http:" } },
    fetch: async () => new Response(JSON.stringify(sampleContent())),
    Storage: { saveStudySet: topic => ({ ...topic, id: 77 }) },
  });
  vm.runInContext(readFileSync("js/ai.js", "utf8"), context);
  const result = await vm.runInContext(`(async () => {
    const topic = { name: "K-maps" };
    const content = await loadStudyContent(topic);
    return topic.id === 77 && (await loadStudyContent(topic)) === content;
  })()`, context);
  assert.equal(result, true);
});

test("adaptive quiz advances when correct and retries the same concept when incorrect", () => {
  const context = vm.createContext({});
  vm.runInContext(readFileSync("js/quiz-order.js", "utf8"), context);
  assert.equal(vm.runInContext(`(() => {
    const questions = [
      { concept: "edges", difficulty: "easy" },
      { concept: "edges", difficulty: "easy" },
      { concept: "groups", difficulty: "medium" },
    ];
    const seen = new Set([0]);
    return [nextQuizIndex(questions, seen, 0, true), nextQuizIndex(questions, seen, 0, false)].join(",");
  })()`, context), "2,1");
});

test("the opening question has a same-concept retry when the bank provides one", () => {
  const context = vm.createContext({});
  vm.runInContext(readFileSync("js/quiz-order.js", "utf8"), context);
  assert.equal(vm.runInContext(`nextQuizIndex([
    { concept: "groups", difficulty: "easy" },
    { concept: "edges", difficulty: "easy" },
    { concept: "edges", difficulty: "easy" },
    { concept: "simplification", difficulty: "medium" },
  ], new Set())`, context), 1);
});

test("server serves the student pages and validates the three AI flows", async t => {
  const { createStudygramServer } = require("../server/index");
  const received = [];
  const server = createStudygramServer(async ({ input }) => {
    received.push(input);
    if (input.name === "Malformed") return "{";
    if (input.name === "Incomplete") return JSON.stringify({ scenes: [], questions: [] });
    if (input.name === "Timeout") throw new DOMException("Timeout", "TimeoutError");
    if (input.name) return JSON.stringify(sampleContent());
    if (input.message) return JSON.stringify({
      reply: "Okay, where did it get messy?",
      studyQuestion: true,
      studySet: null,
      checkIn: null,
    });
    return JSON.stringify({
      topics: ["K-maps"],
      encouragement: "One tough class doesn’t mean you’re cooked.",
      studyTip: "Try one small grid first.",
      mood: "📖",
    });
  });
  t.after(() => server.close());
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, data) => fetch(base + "/api/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  assert.match(await (await fetch(base)).text(), /New Study Set/);
  assert.match(await (await fetch(base + "/pages/study.html")).text(), /study-file/);
  for (const path of ["/pages/teacher.html", "/js/gemini.js", "/server/model.js", "/.env"]) {
    assert.equal((await fetch(base + path)).status, 404);
  }
  const request = { name: "K-maps", sourceText: "First and last columns touch.", focus: "wraparound" };
  const generated = await post("study-set", request);
  assert.equal(generated.status, 200);
  assert.equal((await generated.json()).questions.length, 6);
  assert.deepEqual(received[0], request);
  assert.equal((await post("study-set", { name: "Malformed" })).status, 502);
  assert.equal((await post("study-set", { name: "Incomplete" })).status, 502);
  assert.equal((await post("study-set", { name: "Timeout" })).status, 504);
  assert.equal((await post("study-set", { name: "" })).status, 400);
  assert.equal((await post("study-set", { name: "Long", sourceText: "a".repeat(150000) })).status, 413);
  assert.equal((await post("diary", { entry: "I learned about K-maps." })).status, 200);
  const lily = await post("lily", { message: "K-maps cooked me.", questionCount: 0, history: [] });
  assert.equal(lily.status, 200);
  assert.equal((await lily.json()).studyQuestion, true);
});

test("typed Lily saves a check-in with consent and resumes a queued request", async () => {
  const handlers = {};
  const nodes = {
    "lily-status": {},
    "lily-start": {},
    "lily-input": { value: "", maxLength: 3000 },
    "lily-form": {
      querySelector: () => ({}),
      addEventListener: (event, callback) => { handlers[event] = callback; },
    },
  };
  let day = "first day";
  const notes = new Map();
  let destination;
  const context = vm.createContext({
    window: { location: { assign: url => { destination = url; } } },
    document: { getElementById: id => nodes[id] },
    Storage: { getStudentProfile: () => null },
    localStorage: {
      getItem: key => notes.get(key),
      setItem: (key, value) => notes.set(key, value),
      removeItem: key => notes.delete(key),
    },
    Date: class { toDateString() { return day; } },
    clearTimeout,
    setTimeout,
    getLilyReply: async () => ({
      reply: "That sounds rough. Is there someone you trust who could help?",
      studyQuestion: false,
      studySet: null,
      checkIn: "trusted_adult",
    }),
  });
  vm.runInContext(readFileSync("js/lily.js", "utf8"), context);
  async function send(message) {
    nodes["lily-input"].value = message;
    handlers.submit({ preventDefault() {} });
    await new Promise(setImmediate);
  }
  await send("Hey Lily, someone bullied me.");
  assert.match(nodes["lily-status"].textContent, /check in tomorrow/);
  assert.equal(notes.size, 0);
  await send("yeah");
  assert.deepEqual(JSON.parse([...notes.values()][0]), { day, step: "trusted_adult" });
  day = "second day";
  await send("open quiz");
  assert.match(nodes["lily-status"].textContent, /talk to someone you trust/);
  assert.equal(destination, undefined);
  await send("skip");
  assert.equal(destination, "pages/quiz.html");
  assert.equal(notes.size, 0);
});
