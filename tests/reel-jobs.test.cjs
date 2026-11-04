const assert = require("node:assert/strict");
const { mkdtemp, readdir, rm, unlink, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const { test } = require("node:test");
const { createStudygramServer } = require("../server");
const { openCommunity } = require("../server/community");
const { createReelJobs } = require("../server/reel-jobs");
const testServers = new WeakMap();

const legacy = {
  name: "K-maps",
  scenes: [{
    title: "The edges touch",
    caption: "Pair the edge cells",
    narration: "The left and right edges touch.",
    visual: "grid",
    items: ["1", "0", "0", "1", "0", "0", "0", "0"],
    highlighted: [0, 3],
  }],
};

async function serve(t, reelOptions, databasePath = join(reelOptions.directory, "accounts.sqlite")) {
  let servers = testServers.get(t);
  if (!servers) {
    servers = [];
    testServers.set(t, servers);
    t.after(async () => {
      await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
      await rm(reelOptions.directory, { recursive: true, force: true });
    });
  }
  const server = createStudygramServer(() => assert.fail("Rendering must not call the model"), reelOptions, {}, { databasePath });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}

async function signIn(base, action = "register", username = "reel_tester") {
  const response = await fetch(`${base}/api/community/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ username, password: "Studygram reel test passphrase" }),
  });
  assert.equal(response.status, action === "register" ? 201 : 200);
  return response.headers.get("set-cookie").split(";")[0];
}

async function queue(base, cookie, input = legacy, origin = base) {
  return fetch(`${base}/api/reel-jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin, ...(cookie && { Cookie: cookie }) },
    body: JSON.stringify(input),
  });
}

async function waitFor(base, cookie, id, stage) {
  for (let i = 0; i < 80; i++) {
    const result = await (await fetch(`${base}/api/reel-jobs/${id}`, { headers: { Cookie: cookie } })).json();
    if (result.stage === stage) return result;
    if (result.stage === "failed") assert.fail(result.message);
    await delay(20);
  }
  assert.fail(`Reel never reached ${stage}`);
}

test("only completed reel renders notify the verified owner, without disrupting playback if recording fails", async t => {
  const directory = await mkdtemp(join(tmpdir(), "studygram-reel-completion-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const scope = "a".repeat(48);
  const completed = [];
  const failures = [];
  const jobs = createReelJobs({
    directory,
    filesystemStats: async () => ({ bavail: 1024n * 1024n, bsize: 4096n }),
    onReady(ownerScope) {
      completed.push(ownerScope);
      throw new Error("Test achievement storage failure");
    },
    async render({ storyboard, outputPath }) {
      await writeFile(outputPath, storyboard.name === "K-maps" ? "video" : "");
      return { engine: "Local test voice" };
    },
    logFailure: event => failures.push(event),
  });
  async function waitForStage(id, stage) {
    for (let i = 0; i < 80; i++) {
      const job = await jobs.get(id, scope);
      if (job?.stage === stage) return job;
      if (job?.stage === "failed") assert.fail(JSON.stringify(failures));
      await delay(20);
    }
    assert.fail(`Reel never reached ${stage}`);
  }

  const { id } = await jobs.enqueue(legacy, scope);
  await waitForStage(id, "ready");
  assert.deepEqual(completed, [scope]);
  assert.equal((await jobs.enqueue(legacy, scope)).stage, "ready");
  assert.equal((await jobs.get(id, scope)).stage, "ready");
  const invalid = await jobs.enqueue({ ...legacy, name: "Empty video" }, scope);
  await waitForStage(invalid.id, "failed");
  assert.deepEqual(completed, [scope]);
});

test("legacy sets render once, support seeking and downloads, and survive server restart", async t => {
  const directory = await mkdtemp(join(tmpdir(), "studygram-reels-"));
  let renderCount = 0;
  let failReplacement = false;
  const options = {
    directory,
    render: async ({ outputPath }) => {
      renderCount++;
      if (failReplacement) throw new Error("Test encoder failure");
      await writeFile(outputPath, "0123456789");
      return { engine: "Local test voice" };
    },
  };
  const base = await serve(t, options);
  const cookie = await signIn(base);
  assert.equal((await queue(base, cookie, { name: "Bad", scenes: [] })).status, 400);
  const response = await queue(base, cookie);
  assert.equal(response.status, 202);
  const { id } = await response.json();
  assert.equal((await (await queue(base, cookie)).json()).id, id);
  const ready = await waitFor(base, cookie, id, "ready");
  assert.equal(ready.engine, "Local test voice");
  assert.equal(renderCount, 1);

  const newServer = await serve(t, options);
  assert.equal((await waitFor(newServer, cookie, id, "ready")).engine, "Local test voice");
  const range = await fetch(newServer + ready.videoUrl, { headers: { Cookie: cookie, Range: "bytes=2-5" } });
  assert.equal(range.status, 206);
  assert.equal(range.headers.get("content-range"), "bytes 2-5/10");
  assert.equal(await range.text(), "2345");
  const optionsWithCookie = { headers: { Cookie: cookie } };
  const download = await fetch(newServer + ready.downloadUrl, optionsWithCookie);
  assert.match(download.headers.get("content-disposition"), /^attachment; .*\.mp4"$/);
  assert.equal(await download.text(), "0123456789");

  assert.equal((await queue(newServer, cookie, { ...legacy, replace: true })).status, 202);
  await waitFor(newServer, cookie, id, "ready");
  assert.equal(renderCount, 2);

  failReplacement = true;
  assert.equal((await queue(newServer, cookie, { ...legacy, replace: true })).status, 202);
  assert.equal((await waitFor(newServer, cookie, id, "failed")).stage, "failed");
  assert.equal(await (await fetch(newServer + ready.videoUrl, optionsWithCookie)).text(), "0123456789");
  assert.equal((await queue(newServer, cookie)).status, 200);
  assert.equal((await (await fetch(`${newServer}/api/reel-jobs/${id}`, optionsWithCookie)).json()).stage, "ready");
  failReplacement = false;

  const [scope] = await readdir(join(directory, "owners"));
  const video = join(directory, "owners", scope, `${id}.mp4`);
  await writeFile(video, "");
  assert.equal((await fetch(newServer + ready.videoUrl, optionsWithCookie)).status, 404);
  await unlink(video);
  assert.equal((await fetch(newServer + ready.videoUrl, optionsWithCookie)).status, 404);
  const restarted = await serve(t, options);
  assert.equal((await fetch(`${restarted}/api/reel-jobs/${id}`, optionsWithCookie)).status, 404);
  assert.equal((await (await queue(restarted, cookie)).json()).id, id);
  await waitFor(restarted, cookie, id, "ready");
  assert.equal(renderCount, 4);
});

test("failed narration logs the job, stage and cause while returning safe guidance", async t => {
  const directory = await mkdtemp(join(tmpdir(), "studygram-reels-"));
  const events = [];
  const base = await serve(t, {
    directory,
    logFailure: event => events.push(event),
    render: async ({ onProgress }) => {
      onProgress({ stage: "narrating", message: "Recording voice" });
      const cause = Object.assign(new Error("Private request text and secret credential"), { code: "EACCES", syscall: "spawn" });
      throw new Error("Failed to start the speech tool", { cause });
    },
  });
  const cookie = await signIn(base);
  const { id } = await (await queue(base, cookie)).json();
  const failed = await waitFor(base, cookie, id, "failed");
  assert.equal(events.length, 1);
  assert.equal(events[0].id, id);
  assert.equal(events[0].stage, "narrating");
  assert.ok(events[0].causes.some(cause => cause.code === "EACCES" && cause.syscall === "spawn"));
  assert.doesNotMatch(JSON.stringify(events), /Private request text|secret credential/);
  assert.match(failed.message, /prepare the narration.*try again/i);
  assert.doesNotMatch(JSON.stringify(failed), /EACCES|spawn|speech tool|secret credential/);
});

test("the owner's job status distinguishes timeout from cancellation", async t => {
  const directory = await mkdtemp(join(tmpdir(), "studygram-reels-"));
  const reasons = ["TimeoutError", "AbortError"];
  const base = await serve(t, {
    directory,
    logFailure() {},
    render: async () => { throw new DOMException("Private abort reason", reasons.shift()); },
  });
  const cookie = await signIn(base);
  const { id } = await (await queue(base, cookie)).json();
  assert.match((await waitFor(base, cookie, id, "failed")).message, /too long/i);
  await queue(base, cookie);
  assert.match((await waitFor(base, cookie, id, "failed")).message, /cancelled/i);
});

test("a missing WAV probe logs the failing beat and step", async t => {
  const { renderReel } = require("../server/reel-render");
  const directory = await mkdtemp(join(tmpdir(), "studygram-reels-"));
  const events = [];
  const base = await serve(t, {
    directory,
    logFailure: event => events.push(event),
    render: options => renderReel({
      ...options,
      synthesize: async ({ outputPath }) => {
        await writeFile(outputPath, "unused because the probe cannot start");
        return { engine: "Test voice" };
      },
      ffprobe: join(directory, "missing-ffprobe"),
    }),
  });
  const cookie = await signIn(base);
  const { id } = await (await queue(base, cookie)).json();
  const failed = await waitFor(base, cookie, id, "failed");
  assert.equal(events[0]?.step, "wav-probing");
  assert.equal(events[0].beat, 1);
  assert.ok(events[0].causes.some(cause => cause.code === "ENOENT"));
  assert.match(failed.message, /prepare the narration.*try again/i);
  assert.doesNotMatch(failed.message, /FFPROBE|PATH/i);
  assert.doesNotMatch(JSON.stringify(events), /missing-ffprobe/);
});

test("private reels are bound to the owning account across status, media, and publication routes", async t => {
  const directory = await mkdtemp(join(tmpdir(), "studygram-private-reels-"));
  const reelOptions = { directory, render: async ({ outputPath }) => {
    await writeFile(outputPath, "private owner video");
    return { engine: "Test voice" };
  } };
  const base = await serve(t, reelOptions);
  const owner = await signIn(base);
  const other = await signIn(base, "register", "reel_other");
  assert.equal((await queue(base)).status, 401);
  assert.equal((await queue(base, owner, legacy, "https://outside.example")).status, 403);
  const { id } = await (await queue(base, owner)).json();
  const ready = await waitFor(base, owner, id, "ready");
  const privateRoutes = [`/api/reel-jobs/${id}`, ready.videoUrl, ready.downloadUrl];
  for (const path of privateRoutes) {
    assert.equal((await fetch(base + path)).status, 401);
    assert.equal((await fetch(base + path, { headers: { Cookie: other, Range: "bytes=0-3" } })).status, 404);
  }
  assert.equal((await fetch(base + ready.videoUrl, { method: "HEAD", headers: { Cookie: other } })).status, 404);
  const ownerVideo = await fetch(base + ready.videoUrl, { headers: { Cookie: owner } });
  assert.equal(ownerVideo.headers.get("cache-control"), "private, no-store");
  assert.equal(await ownerVideo.text(), "private owner video");
  const stolen = await fetch(`${base}/api/community/reels`, {
    method: "POST",
    headers: { Cookie: other, Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ reelId: id, title: "Wrong owner" }),
  });
  assert.equal(stolen.status, 404);

  const { id: otherId } = await (await queue(base, other)).json();
  assert.notEqual(otherId, id);
  await waitFor(base, other, otherId, "ready");

  const reset = await serve(t, reelOptions, ":memory:");
  const newOwner = await signIn(reset);
  assert.equal((await fetch(reset + ready.videoUrl, { headers: { Cookie: newOwner } })).status, 404);
});

test("legacy shared videos remain accessible through their publication only", async t => {
  const directory = await mkdtemp(join(tmpdir(), "studygram-reel-migration-"));
  const databasePath = join(directory, "accounts.sqlite");
  const { db, auth } = openCommunity(databasePath);
  const id = "a".repeat(64);
  const unsharedId = "b".repeat(64);
  try {
    const { user } = await auth.register({ username: "reel_tester", password: "Studygram reel test passphrase" });
    db.exec("ALTER TABLE community_reels DROP COLUMN owner_scope");
    db.prepare("INSERT INTO community_reels (reel_id, creator_id, title, created_at) VALUES (?, ?, ?, ?)")
      .run(id, user.id, "Previously shared video", new Date().toISOString());
    await writeFile(join(directory, `${id}.mp4`), "legacy shared video");
    await writeFile(join(directory, `${unsharedId}.mp4`), "legacy private video");
  } finally {
    db.close();
  }
  const base = await serve(t, { directory }, databasePath);
  const cookie = await signIn(base, "login");
  const options = { headers: { Cookie: cookie } };
  const { reels } = await (await fetch(base + "/api/community/reels", options)).json();
  assert.equal(reels.length, 1);
  assert.equal(await (await fetch(base + reels[0].videoUrl, options)).text(), "legacy shared video");
  for (const reelId of [id, unsharedId]) {
    assert.equal((await fetch(`${base}/api/reel-jobs/${reelId}/video`, options)).status, 404);
    assert.equal((await fetch(base + "/api/community/reels", {
      method: "POST",
      headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({ reelId, title: "Old cache video" }),
    })).status, 404);
  }
});

test("the account's reel cap blocks new entries and preserves existing videos", async t => {
  const directory = await mkdtemp(join(tmpdir(), "studygram-reel-cap-"));
  let renderCount = 0;
  const base = await serve(t, { directory, async render({ outputPath }) {
    renderCount++;
    await writeFile(outputPath, "existing video");
    return { engine: "Test voice" };
  } });
  const cookie = await signIn(base);
  const { id } = await (await queue(base, cookie)).json();
  const ready = await waitFor(base, cookie, id, "ready");
  const [scope] = await readdir(join(directory, "owners"));
  const folder = join(directory, "owners", scope);
  await Promise.all(Array.from({ length: 39 }, (_, index) => {
    const filename = (index + 1).toString(16).padStart(64, "0") + ".mp4";
    return writeFile(join(folder, filename), "existing entry");
  }));

  const { id: extraId } = await (await queue(base, cookie, { ...legacy, name: "Another reel" })).json();
  const blocked = await waitFor(base, cookie, extraId, "failed");
  assert.match(blocked.message, /40-reel storage limit/);
  assert.equal(renderCount, 1);
  assert.equal((await queue(base, cookie)).status, 200);
  assert.equal(await (await fetch(base + ready.videoUrl, { headers: { Cookie: cookie } })).text(), "existing video");
  assert.equal((await queue(base, cookie, { ...legacy, replace: true })).status, 202);
  await waitFor(base, cookie, id, "ready");
  assert.equal(renderCount, 2);
});

test("a low-space volume stops a render before the encoder starts", async t => {
  const directory = await mkdtemp(join(tmpdir(), "studygram-reel-space-"));
  const base = await serve(t, {
    directory,
    filesystemStats: async () => ({ bavail: 0n, bsize: 4096n }),
    render() { assert.fail("The render must not start when available disk space is low"); },
  });
  const cookie = await signIn(base);
  const { id } = await (await queue(base, cookie)).json();
  assert.match((await waitFor(base, cookie, id, "failed")).message, /low on disk space/);
});
