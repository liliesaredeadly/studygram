const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { request } = require("node:http");
const { createStudygramServer } = require("../server/index");

async function openServer(t, model, transport) {
  const server = createStudygramServer(model, {}, {}, { databasePath: ":memory:" }, transport);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test("serves a nonce-bound page, denies reserved admin paths, and keeps private files off the web", async t => {
  const base = await openServer(t);
  const page = await fetch(base + "/pages/login.html");
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("x-frame-options"), "DENY");
  assert.equal(page.headers.get("cache-control"), "no-store");
  const policy = page.headers.get("content-security-policy");
  const nonce = /'nonce-([A-Za-z0-9+/]+)'/.exec(policy)[1];
  assert.match(policy, /script-src-attr 'none'/);
  assert.match(policy, /frame-ancestors 'none'/);
  const markup = await page.text();
  assert.ok(markup.includes(`<script nonce="${nonce}"`));
  assert.doesNotMatch(markup, /\son(?:click|submit|error|load|keydown)\s*=/i);
  for (const path of ["/admin", "/pages/admin.html", "/api/admin/reports", "/pages/%61dmin.html", "/.env", "/.studygram-community.sqlite", "/server/community-moderate.js"]) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
  const rebound = await new Promise((resolve, reject) => {
    request(base, { headers: { Host: "untrusted.example" } }, response => {
      response.resume();
      resolve(response.statusCode);
    }).on("error", reject).end();
  });
  assert.equal(rebound, 421);
});

test("rejects cross-origin and malformed AI forms and returns a generic service error", async t => {
  let calls = 0;
  const base = await openServer(t, async () => {
    calls += 1;
    throw Object.assign(new Error("internal provider detail"), { status: 502 });
  });
  const post = (body, headers = {}) => fetch(base + "/api/diary-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
  assert.equal((await post('{"entry":"notes"}', { Origin: "https://untrusted.example" })).status, 403);
  assert.equal((await post('{"entry":"notes"}', { "Sec-Fetch-Site": "cross-site" })).status, 403);
  assert.equal((await post("null")).status, 400);
  assert.equal((await post("[]")).status, 400);
  assert.equal((await post('{"entry":[]}')).status, 400);
  assert.equal((await post(JSON.stringify({ entry: "a".repeat(140_000) }))).status, 413);
  assert.equal(calls, 0);
  const response = await post('{"entry":"notes"}', { Origin: base });
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /temporarily unavailable/);
  assert.equal(calls, 1);
});

test("a deployment can require an account before a request reaches the AI provider", async t => {
  const base = await openServer(t, async () => assert.fail("anonymous request reached the provider"), { requireAccount: true });
  const response = await fetch(base + "/api/diary-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: '{"entry":"notes"}',
  });
  assert.equal(response.status, 401);
});
