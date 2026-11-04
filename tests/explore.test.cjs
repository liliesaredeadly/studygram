const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test } = require("node:test");
const { createContext, runInContext } = require("node:vm");
const { createStudygramServer } = require("../server/index");
const { normalizeStoryboard } = require("../server/reel-timeline");

test("the Explore companion sends only the question and verified category context to the model", async t => {
  const requests = [];
  const server = createStudygramServer(async ({ input }) => {
    requests.push(input);
    return JSON.stringify({ reply: "Start with a simple sensor and output.", steps: ["Sketch a robot."], extra: "ignore" });
  });
  t.after(() => server.close());
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = body => fetch(`${base}/api/explore`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });

  const response = await post({ category: "technology", message: "How do I build a robot?", profile: "private" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reply: "Start with a simple sensor and output.", steps: ["Sketch a robot."] });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].category, "Technology");
  assert.equal(requests[0].message, "How do I build a robot?");
  assert.ok(requests[0].sources.length);
  assert.equal(requests[0].profile, undefined);
  assert.equal((await post({ category: "unknown", message: "hello" })).status, 400);
  assert.equal(requests.length, 1);
  for (const path of ["/pages/explore.html", "/explore.css", "/js/explore-actions.js"]) {
    assert.equal((await fetch(base + path)).status, 200, path);
  }
});

test("each Explore category supplies a renderable reel and questions for the adaptive quiz", () => {
  const categories = [...require("../js/explore-humanities"), ...require("../js/explore-stem")];
  assert.deepEqual(categories.map(category => category.id), ["defence", "arts", "music", "literature", "science", "technology", "research"]);
  for (const category of categories) {
    assert.ok(category.discover.length && category.explore.length && category.careers.length);
    assert.ok(category.people.length && category.project.steps.length && category.sources.length);
    assert.equal(normalizeStoryboard({ name: category.lesson.title, scenes: category.lesson.scenes }).scenes.length, 3);
    assert.ok(category.questions.length >= 3);
    for (const question of category.questions) {
      assert.equal(new Set(question.options).size, 4);
      assert.ok(question.options[question.correctIndex]);
    }
  }
});

test("Explore reuses a saved set and keeps an explicit companion subject when live AI is offline", async () => {
  const saved = new Map();
  const destinations = [];
  const requests = [];
  const context = createContext({
    localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) },
    window: { location: { assign: href => destinations.push(href) } },
    requestStudygramAI: async (_endpoint, input) => { requests.push(input); throw new Error("Offline"); },
  });
  for (const name of ["storage", "explore-humanities", "explore-stem", "explore-actions"]) {
    runInContext(readFileSync(resolve(__dirname, "../js", `${name}.js`), "utf8"), context);
  }
  runInContext("ExploreActions.openLesson(EXPLORE_STEM[0]); ExploreActions.openQuiz(EXPLORE_STEM[0]);", context);
  const [topic] = JSON.parse(saved.get("sg_topics"));
  assert.equal(JSON.parse(saved.get("sg_topics")).length, 1);
  assert.deepEqual(destinations, [`lesson.html?topicId=${topic.id}`, `quiz.html?topicId=${topic.id}`]);

  const explicit = await runInContext('ExploreActions.ask({ category: "technology", message: "What should a researcher know about AI?" })', context);
  const automatic = await runInContext('ExploreActions.ask({ category: "", message: "How can I build my first robot?" })', context);
  assert.equal(requests[0].category, "technology");
  assert.equal(explicit.category, "Technology");
  assert.equal(automatic.mode, "guide");
  assert.match(automatic.reply, /simulat/i);
});
