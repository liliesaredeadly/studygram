const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createStudygramServer } = require("../server/index");

test("Cinematic Wisdom serves its local flow without calling the model", async t => {
  let modelCalls = 0;
  const server = createStudygramServer(async () => { modelCalls += 1; });
  t.after(() => server.close());
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  const endpoint = `${base}/api/wisdom`;
  const post = body => fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  assert.equal((await fetch(endpoint)).status, 405);
  assert.equal((await fetch(endpoint, { method: "POST", body: "plain text" })).status, 415);
  assert.equal((await post({ message: "", tradition: "gita" })).status, 400);

  const message = "I studied hard and failed my exam.";
  const offer = await post({ message });
  assert.equal(offer.status, 200);
  assert.equal(offer.headers.get("cache-control"), "no-store");
  assert.equal((await offer.json()).kind, "choose_tradition");

  const experience = await post({ message, tradition: "gita" });
  assert.equal(experience.status, 200);
  const deck = await experience.json();
  assert.equal(deck.kind, "experience");
  assert.equal(deck.cards.length, 5);
  assert.equal(deck.cards[2].source.reference, "Bhagavad Gita 2.47");

  const urgent = await post({ message: "I am going to hurt myself tonight.", tradition: "gita" });
  const support = await urgent.json();
  assert.equal(support.kind, "support_now");
  assert.equal(support.cards, undefined);
  assert.equal(modelCalls, 0);

  assert.match(await (await fetch(base)).text(), /href="pages\/wisdom\.html"/);
  for (const path of ["/pages/wisdom.html", "/wisdom.css", "/js/wisdom.js", "/js/wisdom-scenes.js"]) {
    assert.equal((await fetch(base + path)).status, 200, path);
  }
  assert.equal((await fetch(`${base}/server/wisdom-passages.js`)).status, 404);
});
