const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");

function browser(options = {}) {
  const records = new Map();
  let member = { id: 7 };
  const calls = [];
  const context = vm.createContext({
    window: {
      location: { protocol: "https:" },
      sessionStorage: {
        getItem: key => records.get(key) ?? null,
        setItem: (key, value) => {
          if (options.storageBlocked) throw new Error("storage blocked");
          records.set(key, value);
        },
        removeItem: key => records.delete(key),
      },
    },
    StudygramPrivateSession: { ready: Promise.resolve(), user: () => member },
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (options.fetch) return options.fetch(url, init);
      return new Response(JSON.stringify(url === "/api/meta-connection"
        ? { connected: true, model: "muse-spark-1.3" }
        : { reply: "Study reply" }));
    },
    AbortSignal,
  });
  vm.runInContext(readFileSync("js/ai.js", "utf8"), context);
  return { context, records, calls, setMember: value => { member = value; } };
}

test("AI requires a personal connection while source lookup never receives credentials", async () => {
  const app = browser();
  await assert.rejects(vm.runInContext('requestStudygramAI("lily", {message:"hello"})', app.context), /Settings/i);
  assert.equal(app.calls.length, 0);
  await vm.runInContext('requestStudygramAI("pursuit-sources", {interest:"robotics"})', app.context);
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].init.headers["X-Studygram-Meta-Key"], undefined);
});

test("connected key goes only in the request header and is bound to the signed-in account", async () => {
  const app = browser();
  await vm.runInContext('StudygramMetaConnection.connect("personal-key-for-seven", true)', app.context);
  const validation = app.calls[0];
  assert.equal(validation.url, "/api/meta-connection");
  assert.equal(validation.init.headers["X-Studygram-Meta-Key"], "personal-key-for-seven");
  assert.equal(validation.init.headers["X-Studygram-Meta-Adult"], "1");
  assert.deepEqual(JSON.parse(validation.init.body), { accountId: 7 });
  await vm.runInContext('requestStudygramAI("lily", {message:"hello"})', app.context);
  const generation = app.calls[1];
  assert.equal(generation.init.headers["X-Studygram-Meta-Key"], "personal-key-for-seven");
  assert.deepEqual(JSON.parse(generation.init.body), { message: "hello", accountId: 7 });
  assert.doesNotMatch(JSON.stringify(vm.runInContext('StudygramMetaConnection.current()', app.context)), /personal-key/);
  app.setMember({ id: 8 });
  await assert.rejects(vm.runInContext('requestStudygramAI("lily", {message:"hello"})', app.context), /Settings/i);
  assert.equal(app.calls.length, 2);
  assert.equal(app.records.size, 0);
});

test("disconnect clears the credential and a late connection response cannot restore it", async () => {
  let resolveValidation;
  const app = browser({ fetch: () => new Promise(resolve => { resolveValidation = resolve; }) });
  const pending = vm.runInContext('StudygramMetaConnection.connect("pending-personal-key", true)', app.context);
  await new Promise(resolve => setImmediate(resolve));
  vm.runInContext('StudygramMetaConnection.disconnect()', app.context);
  resolveValidation(new Response(JSON.stringify({ connected: true, model: "muse-spark-1.3" })));
  await assert.rejects(pending, /changed|cancel|again/i);
  assert.equal(app.records.size, 0);
});

test("browser storage failure cannot report a saved connection", async () => {
  const app = browser({ storageBlocked: true });
  await assert.rejects(vm.runInContext('StudygramMetaConnection.connect("storage-test-key", true)', app.context), /browser|storage/i);
  assert.equal(app.records.size, 0);
  assert.equal(vm.runInContext('StudygramMetaConnection.current().connected', app.context), false);
});

test("a rejected key is cleared so later requests ask the user to reconnect", async () => {
  const app = browser({ fetch: async url => new Response(JSON.stringify(url === "/api/meta-connection"
    ? { connected: true, model: "muse-spark-1.3" }
    : { error: "Reconnect your key in Settings.", code: "META_KEY_REJECTED" }), { status: url === "/api/meta-connection" ? 200 : 422 }) });
  await vm.runInContext('StudygramMetaConnection.connect("rejected-personal-key", true)', app.context);
  await assert.rejects(vm.runInContext('requestStudygramAI("diary", {entry:"notes"})', app.context), /Reconnect/);
  assert.equal(app.records.size, 0);
});

test("a late rejection from an old key cannot disconnect its replacement", async () => {
  let resolveGeneration;
  const app = browser({ fetch: async url => url === "/api/meta-connection"
    ? new Response(JSON.stringify({ connected: true, model: "muse-spark-1.3" }))
    : new Promise(resolve => { resolveGeneration = resolve; }) });
  await vm.runInContext('StudygramMetaConnection.connect("old-personal-key", true)', app.context);
  const pending = vm.runInContext('requestStudygramAI("diary", {entry:"notes"})', app.context);
  await new Promise(resolve => setImmediate(resolve));
  await vm.runInContext('StudygramMetaConnection.connect("new-personal-key", true)', app.context);
  resolveGeneration(new Response(JSON.stringify({ error: "Reconnect your key.", code: "META_KEY_REJECTED" }), { status: 422 }));
  await assert.rejects(pending, /Reconnect/);
  assert.equal(vm.runInContext('StudygramMetaConnection.current().connected', app.context), true);
  const headers = await vm.runInContext('StudygramMetaConnection.headers()', app.context);
  assert.equal(headers["X-Studygram-Meta-Key"], "new-personal-key");
});

test("disconnect fails closed even if the browser refuses to remove stored data", async () => {
  const app = browser();
  await vm.runInContext('StudygramMetaConnection.connect("storage-removal-key", true)', app.context);
  vm.runInContext('window.sessionStorage.removeItem = () => { throw new Error("blocked"); }; StudygramMetaConnection.disconnect()', app.context);
  await assert.rejects(vm.runInContext('StudygramMetaConnection.headers()', app.context), /Settings/);
});

test("browser back restoration keeps the account's connection while explicit sign-out clears it", async () => {
  const records = new Map();
  const listeners = new Map();
  const context = vm.createContext({
    window: {
      location: { pathname: "/index.html", protocol: "https:", reload() {}, replace() {} },
      sessionStorage: { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) },
      addEventListener: (name, callback) => listeners.set(name, callback),
    },
    document: { documentElement: { style: {} }, addEventListener() {} },
    fetch: async url => new Response(JSON.stringify(url === "/api/community/private-state"
      ? { user: { id: 7 }, data: {} } : { connected: true, model: "muse-spark-1.3" })),
    AbortSignal, setTimeout, clearTimeout, queueMicrotask,
  });
  vm.runInContext(readFileSync("js/private-session.js", "utf8"), context);
  vm.runInContext(readFileSync("js/ai.js", "utf8"), context);
  await vm.runInContext('StudygramPrivateSession.ready', context);
  await vm.runInContext('StudygramMetaConnection.connect("navigation-test-key", true)', context);
  listeners.get("pageshow")({ persisted: true });
  assert.equal(records.has("sg_meta_connection_v1"), true);

  // A real next page rechecks the account; explicit account transitions remove
  // credentials regardless of whether that page also loaded the AI helper.
  const sessionOnly = vm.createContext({
    window: { location: { pathname: "/index.html", replace() {} }, sessionStorage: { removeItem: key => records.delete(key) }, addEventListener() {} },
    document: { documentElement: { style: {} }, addEventListener() {} },
    fetch: async () => new Response(JSON.stringify({ user: { id: 7 }, data: {} })),
    AbortSignal, setTimeout, clearTimeout, queueMicrotask,
  });
  vm.runInContext(readFileSync("js/private-session.js", "utf8"), sessionOnly);
  await vm.runInContext('StudygramPrivateSession.ready', sessionOnly);
  vm.runInContext('StudygramPrivateSession.sessionChanged("/pages/login.html")', sessionOnly);
  assert.equal(records.has("sg_meta_connection_v1"), false);
});
