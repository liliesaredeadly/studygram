const { closeSync, constants, fchmodSync, fstatSync, lstatSync, openSync } = require("node:fs");
const { isAbsolute, resolve } = require("node:path");
const { createCommunityAuth, normalizeUsername, sessionHash } = require("./community-auth");
const { createCommunityVoice } = require("./community-voice");
const { createCommunityReels, readPublication } = require("./community-reels");
const { createPrivateData, privateDataInputBytes } = require("./private-data");

const defaultDatabase = resolve(__dirname, "..", ".studygram-community.sqlite");
const prefix = "/api/community";
const minute = 60_000;
const authWindow = 5 * minute;
const voiceBudgets = { join: 20, sync: 160, signal: 360 };

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function prepareDatabaseFile(databasePath) {
  if (databasePath === ":memory:") return;
  if (!isAbsolute(databasePath) || !/\.(?:sqlite3?|db)$/i.test(databasePath)) {
    throw new Error("The Studygram database must be an absolute path to a SQLite database file.");
  }
  const existing = lstatSync(databasePath, { throwIfNoEntry: false });
  if (existing && !existing.isFile()) throw new Error("The Studygram database must be a regular file.");
  const flags = constants.O_RDWR | constants.O_CREAT | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);
  const file = openSync(databasePath, flags, 0o600);
  try {
    const metadata = fstatSync(file);
    if (!metadata.isFile() || metadata.nlink !== 1) throw new Error("The Studygram database must be a regular private file.");
    if (process.platform !== "win32") fchmodSync(file, 0o600);
  } finally {
    closeSync(file);
  }
}

function openCommunity(databasePath = process.env.STUDYGRAM_DB_PATH || defaultDatabase, { now = Date.now } = {}) {
  const { DatabaseSync } = require("node:sqlite");
  const { createCommunityRooms } = require("./community-rooms");
  prepareDatabaseFile(databasePath);
  const db = new DatabaseSync(databasePath, { allowExtension: false });
  try {
    db.exec("PRAGMA busy_timeout = 5000; PRAGMA trusted_schema = OFF; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    const auth = createCommunityAuth(db, { now });
    const feed = createCommunityReels(db, { now });
    return { db, auth, feed, rooms: createCommunityRooms(db, { now }), privateData: createPrivateData(db) };
  } catch (error) {
    db.close();
    throw error;
  }
}

function requestOrigin(request, configuredOrigin) {
  const scheme = request.socket.encrypted ? "https" : "http";
  const host = request.headers.host?.toLowerCase();
  if (configuredOrigin) {
    const expected = new URL(configuredOrigin);
    return expected.protocol === `${scheme}:` && expected.host === host ? expected.origin : undefined;
  }
  const port = request.socket.localPort;
  const origins = ["localhost", "127.0.0.1", "[::1]"].map(host => new URL(`${scheme}://${host}:${port}`).origin);
  return origins.find(origin => new URL(origin).host === host);
}

function id(value) {
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < 1) {
    fail(400, "Choose a valid message or session.");
  }
  return number;
}

function createLimiter(clock) {
  const buckets = new Map();
  let nextCleanup = 0;
  function limit(key, count, period, response) {
    const now = clock();
    if (now >= nextCleanup) {
      for (const [name, bucket] of buckets) if (bucket.until <= now) buckets.delete(name);
      nextCleanup = now + minute;
    }
    let bucket = buckets.get(key);
    if (!bucket || bucket.until <= now) {
      bucket = { until: now + period, count: 0 };
      buckets.set(key, bucket);
    }
    if (bucket.count >= count) {
      response?.setHeader("Retry-After", String(Math.ceil((bucket.until - now) / 1000)));
      fail(429, "Please slow down and try again in a little while.");
    }
    bucket.count++;
  }
  return { limit, clear: key => buckets.delete(key) };
}

function createCommunityHandler({ databasePath, now = Date.now, origin: configuredOrigin } = {}, { readInput, respond, reelJobs }) {
  let community;
  let voice;
  let closed = false;
  let activeAuth = 0;
  let activePrivateRequests = 0;
  const { limit, clear } = createLimiter(now);

  function getCommunity() {
    return community ??= openCommunity(databasePath, { now });
  }

  function session(request) {
    if (!request.headers.cookie || !requestOrigin(request, configuredOrigin)) return null;
    return getCommunity().auth.session(request.headers.cookie, { secure: Boolean(request.socket.encrypted) });
  }

  function reservePrivateRequest(response) {
    if (activePrivateRequests >= 12) {
      response.setHeader("Retry-After", "1");
      fail(429, "Private storage is busy. Try again in a moment.");
    }
    activePrivateRequests++;
    let released = false;
    function release() {
      if (released) return;
      released = true;
      activePrivateRequests--;
    }
    response.once("finish", release);
    response.once("close", release);
  }

  async function handle(request, response, path) {
    const origin = requestOrigin(request, configuredOrigin);
    if (!origin || (!["GET", "HEAD"].includes(request.method) && request.headers.origin !== origin)) {
      fail(403, "Open the community from the Studygram page.");
    }

    const method = request.method;
    const route = path.slice(prefix.length);
    const reply = (status, data) => respond(response, status, data);
    const cookie = request.headers.cookie;
    const secure = Boolean(request.socket.encrypted);
    const json = async maxBytes => {
      if (!/^application\/json(?:;|$)/i.test(request.headers["content-type"] || "")) fail(415, "Use a JSON request.");
      return readInput(request, maxBytes);
    };

    const { auth, feed, rooms, privateData } = getCommunity();
    if (route === "/session" && method === "GET") return reply(200, { user: auth.session(cookie, { secure }) });
    if ((route === "/register" || route === "/login") && method === "POST") {
      limit(`auth-source:${request.socket.remoteAddress}`, 16, authWindow, response);
      limit("auth-total", 120, authWindow, response);
      const register = route === "/register";
      const previous = auth.previousSession(cookie, { secure });
      const input = await json(4096);
      const username = normalizeUsername(input);
      const key = username && `${register ? "register" : "login"}:${username}`;
      if (activeAuth >= 2) {
        response.setHeader("Retry-After", "1");
        fail(429, "Sign-in is busy. Try again in a moment.");
      }
      if (key) limit(key, 5, authWindow, response);
      activeAuth++;
      try {
        const result = await auth[register ? "register" : "login"](input, { secure, previous });
        if (key) clear(key);
        if (previous) voice?.disconnect(previous);
        response.setHeader("Set-Cookie", result.cookie);
        return reply(register ? 201 : 200, { user: result.user });
      } finally {
        activeAuth--;
      }
    }
    if (route === "/logout" && method === "POST") {
      response.setHeader("Set-Cookie", auth.logout(cookie, { secure }));
      voice?.disconnect(sessionHash(cookie, secure));
      return reply(200, { user: null });
    }

    function requireMember() {
      const member = auth.session(cookie, { secure });
      if (!member) fail(401, "Sign in to join the Studygram community.");
      return member;
    }
    async function memberJson(maxBytes) {
      const input = await json(maxBytes);
      requireMember();
      return input;
    }

    if (route === "/private-state") {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
      const requestSite = request.headers["sec-fetch-site"];
      if (requestSite && !["same-origin", "none"].includes(requestSite)) fail(403, "Open this page from Studygram.");
      if (method === "GET") {
        const member = auth.session(cookie, { secure });
        if (!member) return reply(200, { user: null, data: {} });
        limit(`private-data-read:${member.id}`, 60, minute, response);
        reservePrivateRequest(response);
        return reply(200, { user: member, data: privateData.read(member.id) });
      }
      if (method === "PATCH") {
        const member = requireMember();
        limit(`private-data-write:${member.id}`, 120, minute, response);
        reservePrivateRequest(response);
        const input = await memberJson(privateDataInputBytes);
        if (response.destroyed) return;
        return reply(200, { versions: privateData.write(member.id, input) });
      }
      return reply(405, { error: "Use GET or PATCH." });
    }

    const user = requireMember();
    if (route === "/rooms" && method === "GET") return reply(200, { rooms: rooms.listRooms() });
    if (route === "/rewards" && method === "GET") {
      const accountId = new URL(request.url, origin).searchParams.get("accountId");
      if (accountId !== null && accountId !== String(user.id)) fail(409, "Your Community account changed. Try again.");
      return reply(200, rooms.getRewards(user.id));
    }
    if (route === "/leaderboard" && method === "GET") return reply(200, rooms.getLeaderboard());
    if (route === "/reels" && method === "GET") {
      const before = new URL(request.url, origin).searchParams.get("before");
      return reply(200, feed.list(user.id, before === null ? null : id(before)));
    }
    if (route === "/reels" && method === "POST") {
      limit(`reel-publish:${user.id}`, 12, minute);
      const publication = readPublication(await memberJson());
      const scope = feed.scopeFor(user.id);
      const job = await reelJobs.get(publication.reelId, scope);
      requireMember();
      if (!job) fail(404, "Rendered reel not found.");
      if (job.stage !== "ready") fail(409, "Wait for this reel to finish rendering before publishing.");
      const { created, reel } = feed.publish(publication, user.id, scope);
      return reply(created ? 201 : 200, { reel });
    }
    const sharedReel = /^\/reels\/(\d+)(?:\/(like|video))?$/.exec(route);
    if (sharedReel) {
      const postId = id(sharedReel[1]);
      const action = sharedReel[2];
      if (action === "video" && ["GET", "HEAD"].includes(method)) {
        return await reelJobs.sendSharedVideo(request, response, feed.requirePublished(postId));
      }
      if (action === "like" && method === "PUT") {
        limit(`reel-like:${user.id}`, 90, minute);
        const input = await memberJson();
        return reply(200, feed.setLike(postId, user.id, input?.liked));
      }
      if (!action && method === "DELETE") return reply(200, feed.remove(postId, user.id));
    }
    if (route === "/library" && method === "GET") return reply(200, rooms.listSessions());
    if (route === "/library" && method === "POST") {
      limit(`library:${user.id}`, 5, 60 * minute);
      return reply(201, rooms.startSession(await memberJson(), user));
    }

    const messageList = /^\/rooms\/([a-z-]+|library(?::|%3a)\d+)\/messages$/i.exec(route);
    if (messageList) {
      const room = decodeURIComponent(messageList[1]);
      if (method === "GET") {
        const after = new URL(request.url, origin).searchParams.get("after");
        return reply(200, rooms.listMessages(room, user.id, after == null || after === "0" ? 0 : id(after)));
      }
      if (method === "POST") {
        limit(`messages:${user.id}`, 35, minute);
        return reply(201, rooms.postMessage(room, await memberJson(), user));
      }
    }

    const message = /^\/messages\/(\d+)$/.exec(route);
    if (message && method === "DELETE") return reply(200, rooms.removeMessage(id(message[1]), user));
    const helpful = /^\/messages\/(\d+)\/helpful$/.exec(route);
    if (helpful && method === "POST") {
      limit(`helpful:${user.id}`, 35, minute);
      return reply(200, rooms.markHelpful(id(helpful[1]), user));
    }
    if (route === "/report" && method === "POST") {
      limit(`report:${user.id}`, 12, 5 * minute);
      return reply(200, rooms.report(await memberJson(), user));
    }

    const voiceRoute = /^\/library\/(\d+)\/voice\/(join|sync|signal|leave)$/.exec(route);
    if (voiceRoute && method === "POST") {
      const roomId = id(voiceRoute[1]);
      const action = voiceRoute[2];
      if (action !== "leave") limit(`voice:${action}:${user.id}`, voiceBudgets[action], minute);
      const input = await memberJson();
      voice ??= createCommunityVoice({ now });
      const authKey = sessionHash(cookie, secure);
      if (action === "leave") return reply(200, voice.leave(roomId, input, user.id, authKey));
      const { endsAt } = rooms.requireSessionMembership(roomId, user.id);
      if (action === "join") return reply(200, voice.join(roomId, input, user, authKey, endsAt));
      return reply(200, voice[action](roomId, input, user.id, authKey));
    }

    const session = /^\/library\/(\d+)(?:\/(join|leave))?$/.exec(route);
    if (session) {
      const sessionId = id(session[1]);
      if (!session[2] && method === "GET") return reply(200, { session: rooms.getSession(sessionId, user.id) });
      if (session[2] === "join" && method === "POST") return reply(200, { session: rooms.joinSession(sessionId, user) });
      if (session[2] === "leave" && method === "POST") {
        const result = rooms.leaveSession(sessionId, user);
        voice?.removeMembership(sessionId, user.id);
        return reply(200, result);
      }
    }

    return reply(404, { error: "Community page not found." });
  }

  return {
    handle,
    session,
    reelOwner(request) {
      const member = session(request);
      return member ? getCommunity().feed.scopeFor(member.id) : null;
    },
    recordStudySet(request, userId) {
      if (session(request)?.id === userId) getCommunity().rooms.recordVerifiedLearning(userId, "studySet");
    },
    recordReelReady(scope) {
      if (closed) return;
      const { feed, rooms } = getCommunity();
      const userId = feed.ownerFor(scope);
      if (userId !== undefined) rooms.recordVerifiedLearning(userId, "reel");
    },
    close() {
      closed = true;
      voice?.close();
      community?.db.close();
    },
  };
}

module.exports = { createCommunityHandler, openCommunity };
