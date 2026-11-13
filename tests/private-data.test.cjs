const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const { DatabaseSync } = require("node:sqlite");
const { createCommunityAuth } = require("../server/community-auth");
const { createCommunityHandler } = require("../server/community");
const { createPrivateData } = require("../server/private-data");

test("private data is scoped to the account and detects simultaneous writes", async t => {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  db.exec("PRAGMA foreign_keys = ON");
  const auth = createCommunityAuth(db);
  const first = (await auth.register({ username: "first", password: "first-testing-password" })).user.id;
  const second = (await auth.register({ username: "second", password: "second-testing-password" })).user.id;
  const store = createPrivateData(db);
  const save = (key, version, value) => ({ accountId: first, changes: { [key]: { version, value } } });

  const entry = '[{"text":"A private diary entry"}]';
  assert.deepEqual(store.write(first, save("sg_diary", 0, entry)), { sg_diary: 1 });
  assert.deepEqual(store.read(second), {});
  assert.deepEqual(store.read(first), { sg_diary: { version: 1, value: entry } });
  assert.throws(() => store.write(second, save("sg_diary", 1, "[]")), { status: 409 });
  assert.throws(() => store.write(first, save("sg_diary", 0, "[]")), { status: 409 });
  assert.throws(() => store.write(first, save("constructor", 0, "{}")), { status: 400 });
  assert.throws(() => store.write(first, save("sg_diary", 1, "{}")), { status: 400 });
  assert.deepEqual(store.write(first, save("sg_diary", 1, null)), { sg_diary: 2 });
  assert.deepEqual(store.read(first), { sg_diary: { version: 2, value: null } });
});

test("private state routes trust the session and refuse cross-site reads or writes", async t => {
  const origin = "http://localhost:3011";
  const service = createCommunityHandler({ databasePath: ":memory:" }, {
    readInput: request => request.input,
    respond: (_response, status, body) => ({ status, body }),
  });
  t.after(() => service.close());
  function call(route, method, cookie, input, headers = {}) {
    const path = `/api/community${route}`;
    const received = new Map();
    const request = {
      method, input, url: path,
      headers: { host: "localhost:3011", origin, cookie, "content-type": "application/json", ...headers },
      socket: { localPort: 3011, remoteAddress: "127.0.0.1" },
    };
    const response = Object.assign(new EventEmitter(), { setHeader: (key, value) => received.set(key, value) });
    return service.handle(request, response, path).then(result => ({ ...result, received }))
      .finally(() => response.emit("finish"));
  }
  const register = username => call("/register", "POST", "", { username, password: "private-testing-password" });
  const a = await register("learner-a");
  const b = await register("learner-b");
  const cookieA = a.received.get("Set-Cookie").split(";")[0];
  const cookieB = b.received.get("Set-Cookie").split(";")[0];
  const input = { accountId: a.body.user.id, changes: { sg_diary: { value: '[{"text":"only for A"}]', version: 0 } } };
  assert.equal((await call("/private-state", "PATCH", cookieA, input)).status, 200);
  const reading = await call("/private-state", "GET", cookieA);
  assert.match(reading.body.data.sg_diary.value, /only for A/);
  assert.equal(reading.received.get("Cache-Control"), "no-store");
  assert.deepEqual((await call("/private-state", "GET", cookieB)).body.data, {});
  assert.deepEqual((await call("/private-state", "GET")).body, { user: null, data: {} });
  await assert.rejects(call("/private-state", "PATCH", cookieB, input), { status: 409 });
  await assert.rejects(call("/private-state", "PATCH", cookieA, input, { origin: "https://other.example" }), { status: 403 });
  await assert.rejects(call("/private-state", "GET", cookieA, undefined, { "sec-fetch-site": "same-site" }), { status: 403 });
  await call("/logout", "POST", cookieA, {});
  assert.deepEqual((await call("/private-state", "GET", cookieA)).body, { user: null, data: {} });
  await assert.rejects(call("/private-state", "PATCH", cookieA, input), { status: 401 });
});

test("browser state reads only the authenticated snapshot and clears it when the account changes", async () => {
  const local = new Map([["sg_diary", '[{"text":"old browser diary"}]']]);
  const calls = [];
  const events = new Map();
  const document = { addEventListener() {}, documentElement: { style: {} } };
  let reloads = 0;
  const window = {
    location: { pathname: "/index.html", reload: () => { reloads++; } },
    addEventListener: (name, listener) => events.set(name, listener),
  };
  let changeAccount;
  class BroadcastChannel {
    addEventListener(_name, listener) { changeAccount = listener; }
  }
  const session = runInNewContext(`${readFileSync("js/private-session.js", "utf8")}\nStudygramPrivateSession`, {
    AbortSignal, BroadcastChannel, document, window, setTimeout, clearTimeout, queueMicrotask,
    localStorage: {
      getItem: key => local.get(key) ?? null,
      removeItem: key => local.delete(key),
    },
    fetch: async (_path, options) => {
      calls.push(options);
      const body = options.method === "GET" ? { user: { id: 7 }, data: {} } : { versions: { sg_diary: 1 } };
      return { ok: true, json: async () => body };
    },
  });
  await session.ready;
  assert.equal(session.get("sg_diary"), null);
  assert.equal(session.hasLegacy(), false);
  assert.equal(await session.importLegacy(), false);
  local.set("sg_community_achievement_owner", "7");
  assert.equal(session.hasLegacy(), true);
  assert.equal(await session.importLegacy(), true);
  assert.match(session.get("sg_diary"), /old browser diary/);
  assert.equal(local.has("sg_diary"), false);
  assert.equal(JSON.parse(calls[1].body).accountId, 7);
  events.get("pagehide")();
  assert.equal(document.documentElement.style.visibility, "hidden");
  changeAccount({ data: "session-changed" });
  assert.equal(reloads, 1);
  assert.equal(session.get("sg_diary"), null);
});

function openSession({ fetch, pathname = '/pages/diary.html' }) {
  const navigations = [];
  const listeners = new Map();
  const nodes = [];
  const makeNode = tag => ({ tag, children: [], style: {},
    setAttribute(name, value) { this[name] = value; },
    removeAttribute(name) { delete this[name]; },
    append(...children) { this.children.push(...children); },
    addEventListener(name, handler) { this[name] = handler; },
    focus() {},
  });
  const body = makeNode('body');
  body.children.push(makeNode('main'));
  const document = { body, hidden: false, documentElement: { style: {} },
    addEventListener() {}, createElement(tag) { const node = makeNode(tag); nodes.push(node); return node; } };
  const window = { location: { pathname, search: '', hash: '',
    assign: url => navigations.push(url), replace: url => navigations.push(url),
    reload: () => navigations.push('reload') },
    addEventListener: (name, fn) => listeners.set(name, fn) };
  const session = runInNewContext(`${readFileSync('js/private-session.js', 'utf8')}\nStudygramPrivateSession`, {
    window, document, fetch, AbortSignal, setTimeout, clearTimeout, queueMicrotask,
  });
  return { session, navigations, listeners, nodes, document };
}

test('a failed session check offers retry instead of sending every protected page to login', async () => {
  for (const page of ['study', 'lesson', 'quiz', 'diary', 'growth', 'pursuit', 'focus', 'login']) {
    const { session, navigations, nodes } = openSession({ pathname: `/pages/${page}.html`,
      fetch: async () => { throw new TypeError('Network unavailable'); } });
    await session.ready;
    assert.equal(session.unavailable(), true);
    assert.deepEqual(navigations, []);
    const retry = nodes.find(node => node.tag === 'button');
    assert.ok(retry, 'offer a way to retry the session check');
    retry.click();
    assert.deepEqual(navigations, ['reload']);
  }
});

test('repeated account-required actions navigate to sign in only once', async () => {
  const { session, navigations } = openSession({ pathname: '/index.html',
    fetch: async () => ({ ok: true, json: async () => ({ user: null, data: {} }) }) });
  await session.ready;
  assert.equal(session.requireAccount(), false);
  assert.equal(session.requireAccount(), false);
  assert.equal(navigations.length, 1);
});

test('rate limits do not become login redirects, and a confirmed signed-out session still requires login', async () => {
  const failed = openSession({ fetch: async () => ({ ok: false, status: 429,
    json: async () => ({ error: 'Try again shortly.' }) }) });
  await failed.session.ready;
  assert.deepEqual(failed.navigations, []);
  assert.equal(failed.document.body.children[0].inert, true);
  let initialized = false;
  await failed.session.start(() => { initialized = true; });
  assert.equal(initialized, false);
  const signedOut = openSession({ fetch: async () => ({ ok: true,
    json: async () => ({ user: null, data: {} }) }) });
  await signedOut.session.ready;
  assert.deepEqual(signedOut.navigations, ['/pages/login.html?return=%2Fpages%2Fdiary.html']);
});
