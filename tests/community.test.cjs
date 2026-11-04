const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const { mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const http = require("node:http");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const { createCommunityHandler, openCommunity: openCommunityDatabase } = require("../server/community");
const { createStudygramServer } = require("../server/index");

const api = "/api/community";
const password = "community test passphrase";

async function openCommunity(t, options, reelOptions, model) {
  const server = createStudygramServer(model, reelOptions, {}, { databasePath: ":memory:", ...options });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

function student(origin) {
  let cookie;
  return async (path, { method = "GET", input, expected = 200 } = {}) => {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    if (method !== "GET") headers.Origin = origin;
    if (input !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(origin + (path.startsWith("/api/") ? path : api + path), {
      method,
      headers,
      body: input === undefined ? undefined : JSON.stringify(input),
    });
    const text = await response.text();
    assert.equal(response.status, expected, `${method} ${path}: ${text}`);
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    return { data: text ? JSON.parse(text) : null, setCookie };
  };
}

function postWithHost(origin, host, referrer) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ username: "outsider", password });
    const request = http.request(origin + api + "/register", {
      method: "POST",
      headers: { Host: host, Origin: referrer, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, response => {
      response.resume();
      response.on("end", () => resolve(response.statusCode));
    });
    request.on("error", reject);
    request.end(body);
  });
}

test("community gates chat behind sign-in and rejects cross-origin and forged-host requests", async t => {
  const origin = await openCommunity(t);
  const guest = student(origin);
  assert.deepEqual((await guest("/session")).data, { user: null });
  await guest("/rooms", { expected: 401 });
  await guest("/library", { expected: 401 });
  assert.equal(await postWithHost(origin, new URL(origin).host, "https://outside.example"), 403);
  assert.equal(await postWithHost(origin, "outside.example", "http://outside.example"), 421);
  const result = await guest("/register", { method: "POST", input: { username: "outsider", password }, expected: 201 });
  assert.match(result.setCookie, /HttpOnly/);
  assert.match(result.setCookie, /SameSite=Strict/);
});

test("sign-in rotates the current cookie, including when switching to another account", async t => {
  const origin = await openCommunity(t);
  const browser = student(origin);
  const secondBrowser = student(origin);
  const firstAccount = { username: "first_account", password };
  const secondAccount = { username: "second_account", password };
  const first = await browser("/register", { method: "POST", input: firstAccount, expected: 201 });
  await secondBrowser("/login", { method: "POST", input: firstAccount });
  const replacement = await browser("/register", { method: "POST", input: secondAccount, expected: 201 });
  const login = await browser("/login", { method: "POST", input: firstAccount });
  assert.notEqual(login.setCookie, first.setCookie);
  assert.notEqual(login.setCookie, replacement.setCookie);
  for (const old of [first, replacement]) {
    const response = await fetch(origin + api + "/session", { headers: { Cookie: old.setCookie.split(";")[0] } });
    assert.deepEqual(await response.json(), { user: null });
  }
  assert.equal((await browser("/session")).data.user.username, firstAccount.username);
  assert.equal((await secondBrowser("/session")).data.user.username, firstAccount.username);
});

test("authentication budgets share normalized nicknames and ignore client-supplied forwarding headers", async t => {
  let now = Date.now();
  const origin = await openCommunity(t, { now: () => now });
  const attempt = (username, address) => fetch(origin + api + "/login", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", "X-Forwarded-For": address },
    body: JSON.stringify({ username, password }),
  });
  for (const username of ["unknown_member", "UNKNOWN_MEMBER", " unknown_member ", "Unknown_Member", "unknown_member"]) {
    const response = await attempt(username, "192.0.2.10");
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "The nickname or password is incorrect." });
  }
  const limited = await attempt("UNKNOWN_MEMBER", "192.0.2.11");
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "300");
  assert.equal((await attempt("another_member", "192.0.2.11")).status, 401);
  now += 5 * 60_000;
  assert.equal((await attempt("unknown_member", "192.0.2.11")).status, 401);
});

test("registration validates new passwords while login keeps generic failures", async t => {
  const origin = await openCommunity(t);
  const client = student(origin);
  const username = "valid_student";
  const weakPassword = "twelve chars";
  await client("/register", { method: "POST", input: { username, password: weakPassword }, expected: 400 });
  await client("/register", { method: "POST", input: { username, password }, expected: 201 });
  const wrong = await client("/login", { method: "POST", input: { username, password: weakPassword }, expected: 401 });
  const invalid = await client("/login", { method: "POST", input: { username: "*", password: false }, expected: 401 });
  assert.deepEqual(invalid.data, wrong.data);
  assert.equal((await client("/session")).data.user.username, username);
});

test("signing out prevents a pending chat submission from being published", async t => {
  const handler = createCommunityHandler({ databasePath: ":memory:" }, {
    readInput: request => request.input,
    respond: (_, status, body) => ({ status, body }),
  });
  t.after(() => handler.close());
  let cookie;
  function post(route, input) {
    const path = `${api}${route}`;
    const request = {
      method: "POST", url: path, input, socket: { localPort: 3011 },
      headers: { host: "127.0.0.1:3011", origin: "http://127.0.0.1:3011", cookie, "content-type": "application/json" },
    };
    const response = { setHeader(_, value) { cookie = value.split(";")[0]; } };
    return handler.handle(request, response, path);
  }
  assert.equal((await post("/register", { username: "pending_chat", password })).status, 201);
  const input = Promise.withResolvers();
  const pending = post("/rooms/technology/messages", input.promise);
  assert.equal((await post("/logout", {})).status, 200);
  input.resolve({ body: "Late message" });
  await assert.rejects(pending, { status: 401 });
});

test("signing out prevents an in-flight sign-in from replacing the revoked session", async t => {
  const handler = createCommunityHandler({ databasePath: ":memory:" }, {
    readInput: request => request.input,
    respond: (_, status, body) => ({ status, body }),
  });
  t.after(() => handler.close());
  let cookie;
  function post(route, input) {
    const path = `${api}${route}`;
    const request = {
      method: "POST", url: path, input, socket: { localPort: 3011 },
      headers: { host: "127.0.0.1:3011", origin: "http://127.0.0.1:3011", cookie, "content-type": "application/json" },
    };
    const response = { setHeader(_, value) { cookie = value.split(";")[0]; } };
    return handler.handle(request, response, path);
  }
  const account = { username: "pending_account", password };
  assert.equal((await post("/register", account)).status, 201);
  const input = Promise.withResolvers();
  const pending = post("/login", input.promise);
  assert.equal((await post("/logout", {})).status, 200);
  input.resolve(account);
  await assert.rejects(pending, { status: 409 });
  assert.equal((await post("/login", account)).status, 200);
});

test("students share room chat, report content, remove their own posts, and sign back in", async t => {
  const origin = await openCommunity(t);
  const author = student(origin);
  const reader = student(origin);
  const registration = await author("/register", { method: "POST", input: { username: "River_Notes", password }, expected: 201 });
  await reader("/register", { method: "POST", input: { username: "Sky_Team", password }, expected: 201 });
  assert.equal((await author("/session")).data.user.username, "river_notes");
  const { rooms } = (await reader("/rooms")).data;
  assert.ok(rooms.length > 0);
  const messagesPath = `/rooms/${encodeURIComponent(rooms[0].id)}/messages`;
  const body = "Can anyone explain how to build a revision timetable?";
  const { id } = (await author(messagesPath, { method: "POST", input: { body }, expected: 201 })).data;
  const { messages } = (await reader(`${messagesPath}?after=0`)).data;
  assert.equal(messages.find(message => message.id === id)?.body, body);
  assert.equal(messages.find(message => message.id === id)?.canRemove, false);
  assert.deepEqual((await reader(`${messagesPath}?after=${id}`)).data.messages, []);

  await reader(`/messages/${id}`, { method: "DELETE", expected: 404 });
  await author(`/messages/${id}`, { method: "DELETE" });
  const afterRemoval = (await reader(`${messagesPath}?after=0`)).data.messages;
  assert.ok(afterRemoval.every(message => message.body !== body));

  const flagged = (await author(messagesPath, { method: "POST", input: { body: "Reminder to bring your workbook." }, expected: 201 })).data;
  const report = { method: "POST", input: { targetId: flagged.id, reason: "other" } };
  await reader("/report", report);
  await reader("/report", report);
  assert.ok((await reader(messagesPath)).data.messages.every(message => message.id !== flagged.id));
  assert.ok((await author(messagesPath)).data.messages.some(message => message.id === flagged.id));
  const reviewer = student(origin);
  await reviewer("/register", { method: "POST", input: { username: "note_club", password }, expected: 201 });
  await reviewer("/report", report);
  assert.ok((await author(messagesPath)).data.messages.every(message => message.id !== flagged.id));

  await author("/logout", { method: "POST", input: {} });
  assert.deepEqual((await author("/session")).data, { user: null });
  await author(messagesPath, { expected: 401 });
  const replay = await fetch(origin + api + "/session", { headers: { Cookie: registration.setCookie.split(";")[0] } });
  assert.deepEqual(await replay.json(), { user: null });
  await author("/login", { method: "POST", input: { username: "RIVER_NOTES", password } });
  assert.equal((await author("/session")).data.user.username, "river_notes");
});

test("a library session shares a timed room and requires active membership to read and post", async t => {
  let now = Date.now();
  const origin = await openCommunity(t, { now: () => now });
  const host = student(origin);
  const attendee = student(origin);
  await host("/register", { method: "POST", input: { username: "library_host", password }, expected: 201 });
  await attendee("/register", { method: "POST", input: { username: "library_guest", password }, expected: 201 });
  const title = "Quiet revision sprint";
  const { id } = (await host("/library", { method: "POST", input: { title, duration: 25 }, expected: 201 })).data;
  const { sessions } = (await attendee("/library")).data;
  assert.equal(sessions.find(session => session.id === id)?.title, title);
  const { session } = (await attendee(`/library/${id}`)).data;
  assert.equal(session.title, title);
  assert.equal(session.duration, 25);
  assert.equal(Date.parse(session.endsAt) - Date.parse(session.startedAt), 25 * 60 * 1000);
  const chatPath = `/rooms/${encodeURIComponent(`library:${id}`)}/messages`;
  await host(chatPath, { method: "POST", input: { body: "Let's start with our own notes." }, expected: 201 });
  await attendee(chatPath, { expected: 409 });
  await attendee(chatPath, { method: "POST", input: { body: "I'm ready to start." }, expected: 409 });
  await attendee(`/library/${id}/join`, { method: "POST", input: {} });
  assert.equal((await attendee(chatPath)).data.messages.length, 1);
  const body = "I'm ready to start.";
  const reply = (await attendee(chatPath, { method: "POST", input: { body }, expected: 201 })).data;
  assert.equal((await host(`${chatPath}?after=0`)).data.messages.find(message => message.id === reply.id)?.body, body);
  await attendee(`/library/${id}/leave`, { method: "POST", input: {} });
  await attendee(chatPath, { expected: 409 });
  await attendee(chatPath, { method: "POST", input: { body: "Can I still post here?" }, expected: 409 });
  now += 25 * 60 * 1000;
  await host(chatPath, { expected: 409 });
});

test("Library voice releases the microphone if the browser rejects local peer setup", async () => {
  const script = await readFile(join(__dirname, "../js/community-voice.js"), "utf8");
  const elements = new Map();
  const requests = [];
  let stopped = false;
  let closed = false;
  function makeElement() {
    return {
      dataset: {}, listeners: {}, textContent: "",
      setAttribute() {}, replaceChildren() {}, append() {}, focus() {},
      addEventListener(event, listener) { this.listeners[event] = listener; },
    };
  }
  const getElement = id => {
    if (!elements.has(id)) elements.set(id, makeElement());
    return elements.get(id);
  };
  const track = { addEventListener() {}, stop() { stopped = true; } };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  const createVoice = runInNewContext(`${script}\ncreateCommunityVoice`, {
    document: { getElementById: getElement, createElement: makeElement },
    window: { isSecureContext: true, addEventListener() {} },
    navigator: { mediaDevices: { getUserMedia: async () => stream } },
    crypto: { randomUUID: () => "self" },
    RTCPeerConnection: class {
      addTrack() { throw new Error("Cannot attach microphone"); }
      close() { closed = true; }
    },
    setTimeout: () => 1,
    clearTimeout() {},
  });
  const voice = createVoice({ api: async path => {
    requests.push(path);
    return { participants: [{ peerId: "self", username: "Me" }, { peerId: "other", username: "Other" }], signals: [] };
  } });
  voice.setSession({ id: 1, joined: true, endsAt: new Date(Date.now() + 60_000).toISOString() });
  await getElement("community-voice-join").listeners.click();
  await new Promise(setImmediate);
  assert.equal(stopped, true);
  assert.equal(closed, true);
  assert.ok(requests.includes("/library/1/voice/leave"));
  assert.match(getElement("community-voice-status").textContent, /couldn’t start a voice connection/);
});

test("Library voice signaling stays within an active session and stops at the shared timer", async t => {
  let now = Date.now();
  const origin = await openCommunity(t, { now: () => now });
  const host = student(origin);
  const guest = student(origin);
  const other = student(origin);
  const anonymous = student(origin);
  for (const [client, username] of [[host, "voice_host"], [guest, "voice_guest"], [other, "voice_other"]]) {
    await client("/register", { method: "POST", input: { username, password }, expected: 201 });
  }
  async function start(client, title) {
    return (await client("/library", { method: "POST", input: { title, duration: 25 }, expected: 201 })).data.id;
  }
  function voice(client, sessionId, action, input, expected = 200) {
    return client(`/library/${sessionId}/voice/${action}`, { method: "POST", input, expected });
  }

  const room = await start(host, "Robotics revision");
  const otherRoom = await start(other, "Maths revision");
  const hostPeer = randomUUID();
  const guestPeer = randomUUID();
  const otherPeer = randomUUID();
  await voice(anonymous, room, "join", { peerId: hostPeer }, 401);
  await voice(guest, room, "join", { peerId: guestPeer }, 409);
  await guest(`/library/${room}/join`, { method: "POST", input: {} });
  await voice(host, room, "join", { peerId: hostPeer });
  const { data: joined } = await voice(guest, room, "join", { peerId: guestPeer });
  assert.deepEqual(joined.participants.find(peer => peer.peerId === hostPeer), {
    peerId: hostPeer, username: "voice_host", muted: true,
  });
  await voice(other, otherRoom, "join", { peerId: otherPeer });

  const description = { type: "offer", sdp: "v=0\r\ns=Studygram test\r\n" };
  await voice(host, room, "signal", { peerId: hostPeer, toPeerId: otherPeer, description }, 404);
  await voice(host, room, "signal", { peerId: hostPeer, toPeerId: guestPeer, description });
  const { data: hostSync } = await voice(host, room, "sync", { peerId: hostPeer, after: 0, muted: false });
  assert.deepEqual(hostSync.signals, []);
  const { data: guestSync } = await voice(guest, room, "sync", { peerId: guestPeer, after: 0, muted: true });
  assert.equal(guestSync.participants.find(peer => peer.peerId === hostPeer)?.muted, false);
  assert.equal(guestSync.signals.length, 1);
  const signal = guestSync.signals[0];
  assert.deepEqual(signal, { id: signal.id, fromPeerId: hostPeer, description });
  const { data: next } = await voice(guest, room, "sync", { peerId: guestPeer, after: signal.id, muted: true });
  assert.deepEqual(next.signals, []);

  await guest(`/library/${room}/leave`, { method: "POST", input: {} });
  const { data: remaining } = await voice(host, room, "sync", { peerId: hostPeer, after: 0, muted: true });
  assert.deepEqual(remaining.participants.map(peer => peer.peerId), [hostPeer]);
  now += 25 * 60 * 1000;
  await voice(host, room, "sync", { peerId: hostPeer, after: 0, muted: true }, 409);
  await voice(host, room, "join", { peerId: randomUUID() }, 409);
});

test("one helpful answer earns one point, awarded only by the question asker", async t => {
  const origin = await openCommunity(t);
  const asker = student(origin);
  const helper = student(origin);
  const other = student(origin);
  await asker("/register", { method: "POST", input: { username: "reward_asker", password }, expected: 201 });
  await helper("/register", { method: "POST", input: { username: "reward_helper", password }, expected: 201 });
  await other("/register", { method: "POST", input: { username: "reward_other", password }, expected: 201 });

  const chat = "/rooms/technology/messages";
  const post = (client, input, expected = 201, room = chat) => client(room, { method: "POST", input, expected });
  const { data: question } = await post(asker, { body: "Why does the sample use a loop?", kind: "question" });
  const answerInput = { body: "The loop repeats the same step for each item.", kind: "answer", questionId: question.id };
  const { data: answer } = await post(helper, answerInput);
  const { data: alternative } = await post(other, { ...answerInput, body: "A loop also handles lists of different sizes." });
  const { data: selfAnswer } = await post(asker, { ...answerInput, body: "I found the loop in the notes." });
  await post(helper, answerInput, 404, "/rooms/research/messages");

  const { messages } = (await asker(chat)).data;
  assert.equal(messages.find(message => message.id === question.id)?.kind, "question");
  assert.equal(messages.find(message => message.id === answer.id)?.questionId, question.id);
  assert.equal(messages.find(message => message.id === answer.id)?.canMarkHelpful, true);
  const mark = (client, id, expected = 200) => client(`/messages/${id}/helpful`, { method: "POST", input: {}, expected });
  await mark(helper, answer.id, 403);
  await mark(asker, selfAnswer.id, 403);
  await Promise.all([mark(asker, answer.id), mark(asker, answer.id)]);
  await mark(asker, alternative.id, 409);
  assert.deepEqual((await helper("/rewards")).data, { helpfulAnswers: 1, achievementPoints: 0, reelLikes: 0 });
  assert.deepEqual((await asker("/rewards")).data, { helpfulAnswers: 0, achievementPoints: 0, reelLikes: 0 });
  assert.equal((await helper(chat)).data.messages.find(message => message.id === answer.id)?.helpful, true);

  await helper("/logout", { method: "POST", input: {} });
  await helper("/login", { method: "POST", input: { username: "reward_helper", password } });
  assert.equal((await helper("/rewards")).data.helpfulAnswers, 1);
  await helper(`/messages/${answer.id}`, { method: "DELETE" });
  assert.equal((await helper("/rewards")).data.helpfulAnswers, 0);
});

test("the leaderboard ignores achievement claims and combines verified awards with helpful answers", async t => {
  const directory = await mkdtemp(join(tmpdir(), "studygram-verified-rewards-"));
  const databasePath = join(directory, "community.sqlite");
  let now = Date.parse("2026-11-01T00:00:01Z");
  const previous = openCommunityDatabase(databasePath, { now: () => now });
  const legacy = await previous.auth.register({ username: "rank_asker", password });
  previous.db.exec(`CREATE TABLE IF NOT EXISTS community_learning_achievements (
    user_id INTEGER NOT NULL REFERENCES community_users(id), achievement_id TEXT NOT NULL,
    PRIMARY KEY (user_id, achievement_id)
  )`);
  previous.db.prepare("INSERT INTO community_learning_achievements VALUES (?, ?)").run(legacy.user.id, "quiz");
  previous.db.close();
  const sample = runInNewContext((await readFile("js/sample-study.js", "utf8")) + "\nKMAP_SAMPLE.content");
  const origin = await openCommunity(t, { databasePath, now: () => now }, undefined,
    async ({ input }) => JSON.stringify(input.name === "Bad output" ? {} : sample));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const asker = student(origin);
  const firstHelper = student(origin);
  const secondHelper = student(origin);
  await asker("/leaderboard", { expected: 401 });
  await asker("/rewards/achievements", { method: "POST", input: { achievementIds: ["quiz"] }, expected: 401 });
  const accounts = new Map();
  for (const [client, username] of [[asker, "rank_asker"], [firstHelper, "zebra_notes"], [secondHelper, "amber_notes"]]) {
    const existing = client === asker;
    const { data: { user } } = await client(existing ? "/login" : "/register", {
      method: "POST", input: { username, password }, expected: existing ? 200 : 201,
    });
    accounts.set(client, user.id);
  }
  const achievementIds = ["studySet", "lesson", "quiz", "reflection", "streak"];
  await asker("/rewards/achievements", {
    method: "POST", input: { accountId: accounts.get(asker), achievementIds }, expected: 404,
  });
  await asker("/private-state", {
    method: "PATCH",
    input: { accountId: accounts.get(asker), changes: Object.fromEntries(
      achievementIds.map(id => [`sg_achievement:${id}`, { version: 0, value: "1" }]),
    ) },
  });
  await asker(`/rewards?accountId=${accounts.get(secondHelper)}`, { expected: 409 });
  assert.equal((await asker("/rewards")).data.achievementPoints, 0);
  assert.deepEqual((await asker("/leaderboard")).data, { leaders: [] });

  const generate = (client, name, expected = 200, accountId = accounts.get(client)) => client("/api/study-set", {
    method: "POST", input: { name, accountId, achievementIds }, expected,
  });
  await generate(asker, "Stale tab", 409, accounts.get(firstHelper));
  assert.equal((await asker("/rewards")).data.achievementPoints, 0);
  await generate(firstHelper, "Bad output", 502);
  await generate(asker, "Study set");
  await generate(secondHelper, "Study set");
  await generate(secondHelper, "Another study set");
  assert.equal((await firstHelper("/rewards")).data.achievementPoints, 0);
  assert.equal((await secondHelper("/rewards")).data.achievementPoints, 1);

  async function earnPoint(helper, room) {
    const path = `/rooms/${room}/messages`;
    const { data: question } = await asker(path, {
      method: "POST", input: { kind: "question", body: "How do I check my results?" }, expected: 201,
    });
    const { data: answer } = await helper(path, {
      method: "POST", input: { kind: "answer", questionId: question.id, body: "Try the method again with a known example." }, expected: 201,
    });
    await asker(`/messages/${answer.id}/helpful`, { method: "POST", input: {} });
    return question.id;
  }

  await earnPoint(firstHelper, "technology");
  const extraQuestion = await earnPoint(firstHelper, "research");
  await earnPoint(secondHelper, "study-lounge");
  assert.deepEqual((await asker("/leaderboard")).data.leaders, [
    { rank: 1, username: "amber_notes", points: 2 },
    { rank: 1, username: "zebra_notes", points: 2 },
    { rank: 3, username: "rank_asker", points: 1 },
  ]);

  await asker(`/messages/${extraQuestion}`, { method: "DELETE" });
  assert.deepEqual((await firstHelper("/leaderboard")).data.leaders, [
    { rank: 1, username: "amber_notes", points: 2 },
    { rank: 2, username: "rank_asker", points: 1 },
    { rank: 2, username: "zebra_notes", points: 1 },
  ]);
  const anotherBrowser = student(origin);
  await anotherBrowser("/login", { method: "POST", input: { username: "amber_notes", password } });
  accounts.set(anotherBrowser, accounts.get(secondHelper));
  assert.deepEqual((await anotherBrowser("/rewards")).data, { helpfulAnswers: 1, achievementPoints: 1, reelLikes: 0 });
  now += 2 * 86_400_000;
  await generate(anotherBrowser, "After missing a day");
  assert.equal((await anotherBrowser("/rewards")).data.achievementPoints, 1);
  now += 86_400_000;
  await generate(anotherBrowser, "Second consecutive day");
  now += 86_400_000;
  await generate(anotherBrowser, "Third consecutive day");
  await generate(anotherBrowser, "Same day again");
  assert.equal((await anotherBrowser("/rewards")).data.achievementPoints, 2);
  assert.equal((await asker("/leaderboard")).data.leaders[0].points, 3);
});

test("published reels expose only the shared video and one like point per other student", async t => {
  const directory = await mkdtemp(join(tmpdir(), "studygram-shared-reel-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const origin = await openCommunity(t, {}, {
    directory,
    async render({ outputPath }) {
      await writeFile(outputPath, "0123456789");
      return { engine: "Test voice" };
    },
  });
  const creator = student(origin);
  const viewer = student(origin);
  const guest = student(origin);
  const { setCookie: creatorCookie } = await creator("/register", { method: "POST", input: { username: "reel_creator", password }, expected: 201 });
  const { setCookie, data: { user: viewerAccount } } = await viewer("/register", {
    method: "POST", input: { username: "reel_viewer", password }, expected: 201,
  });
  await guest("/reels", { expected: 401 });
  assert.deepEqual((await viewer("/reels")).data, { reels: [], nextCursor: null });

  const reelInput = {
    name: "K-maps", scenes: [{ title: "Grid", narration: "Pair the ones.", caption: "Pair ones", visual: "grid", items: ["1", "0", "1", "0"], highlighted: [0, 2] }],
  };
  await creator("/api/reel-jobs", { method: "POST", input: { ...reelInput, accountId: viewerAccount.id }, expected: 409 });
  assert.equal((await creator("/rewards")).data.achievementPoints, 0);

  const privateHeaders = { Cookie: creatorCookie.split(";")[0], Origin: origin, "Content-Type": "application/json" };
  const queued = await fetch(origin + "/api/reel-jobs", {
    method: "POST", headers: privateHeaders,
    body: JSON.stringify(reelInput),
  });
  assert.equal(queued.status, 202);
  const { id: reelId } = await queued.json();
  let stage;
  for (let i = 0; i < 80; i++) {
    ({ stage } = await (await fetch(`${origin}/api/reel-jobs/${reelId}`, { headers: privateHeaders })).json());
    if (stage === "ready" || stage === "failed") break;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.equal(stage, "ready");
  assert.equal((await creator("/rewards")).data.achievementPoints, 1);
  assert.equal((await viewer("/rewards")).data.achievementPoints, 0);

  function publish(client, id, expected) {
    return client("/reels", { method: "POST", input: { reelId: id, title: "A guide to K-maps" }, expected });
  }
  await publish(creator, "b".repeat(64), 404);
  const { data: { reel } } = await publish(creator, reelId, 201);
  assert.equal((await publish(creator, reelId, 200)).data.reel.id, reel.id);
  await publish(viewer, reelId, 404);
  const { reels, nextCursor } = (await viewer("/reels")).data;
  assert.deepEqual(reels, [{
    id: reel.id, title: "A guide to K-maps", username: "reel_creator", createdAt: reel.createdAt,
    likes: 0, liked: false, canRemove: false, videoUrl: `${api}/reels/${reel.id}/video`,
  }]);
  assert.equal(nextCursor, null);
  assert.equal((await fetch(origin + reel.videoUrl)).status, 401);
  const videoHeaders = { Cookie: setCookie.split(";")[0], Range: "bytes=2-5" };
  const range = await fetch(origin + reel.videoUrl, { headers: videoHeaders });
  assert.equal(range.status, 206);
  assert.equal(await range.text(), "2345");

  const likePath = `/reels/${reel.id}/like`;
  function like(client, liked, expected = 200) {
    return client(likePath, { method: "PUT", input: { liked }, expected });
  }
  await like(creator, true, 403);
  await Promise.all([like(viewer, true), like(viewer, true)]);
  assert.deepEqual((await creator("/rewards")).data, { helpfulAnswers: 0, achievementPoints: 1, reelLikes: 1 });
  assert.deepEqual((await viewer("/leaderboard")).data.leaders, [{ rank: 1, username: "reel_creator", points: 2 }]);
  assert.equal((await viewer("/reels")).data.reels[0].liked, true);
  await like(viewer, false);
  assert.equal((await creator("/rewards")).data.reelLikes, 0);
  await like(viewer, true);

  await viewer(`/reels/${reel.id}`, { method: "DELETE", expected: 404 });
  await creator(`/reels/${reel.id}`, { method: "DELETE" });
  assert.deepEqual((await viewer("/reels")).data.reels, []);
  assert.equal((await fetch(origin + reel.videoUrl, { headers: videoHeaders })).status, 404);
  assert.equal((await creator("/rewards")).data.reelLikes, 0);
  assert.equal(await (await fetch(`${origin}/api/reel-jobs/${reelId}/video`, { headers: privateHeaders })).text(), "0123456789");
});
