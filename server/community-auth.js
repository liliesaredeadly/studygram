const { createHash, randomBytes, scrypt, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");

const deriveKey = promisify(scrypt);
const keyLength = 64;
const passwordCost = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const sessionSeconds = 7 * 24 * 60 * 60;
const cookieName = "sg_community";
const secureCookieName = "__Host-sg_community";
const invalidLogin = "The nickname or password is incorrect.";

function problem(status, message) {
  return Object.assign(new Error(message), { status });
}

function normalizeUsername(input) {
  const username = typeof input?.username === "string" ? input.username.trim().toLowerCase() : "";
  return /^[a-z0-9][a-z0-9_-]{2,23}$/.test(username) ? username : null;
}

function credentials(input, registering) {
  const username = normalizeUsername(input);
  const password = input?.password;
  const minimum = registering ? 15 : 12;
  const validPassword = typeof password === "string" && password.length >= minimum && password.length <= 128 && password.isWellFormed();
  if (registering) {
    if (!username) throw problem(400, "Choose a nickname of 3–24 letters, numbers, hyphens, or underscores, starting with a letter or number.");
    if (!validPassword) throw problem(400, "Use a password of 15–128 characters.");
  }
  if (!username || !validPassword) throw problem(401, invalidLogin);
  return { username, password };
}

function sessionHash(cookieHeader, secure = false) {
  if (typeof cookieHeader !== "string") return null;
  const prefix = `${secure ? secureCookieName : cookieName}=`;
  const candidates = cookieHeader.split(";").map(value => value.trim()).filter(value => value.startsWith(prefix));
  if (candidates.length !== 1) return null;
  const token = candidates[0].slice(prefix.length);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? hashToken(token) : null;
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function createCommunityAuth(db, { secureCookies = false, now = Date.now } = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS community_users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_salt BLOB NOT NULL,
      password_hash BLOB NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS community_sessions (
      token_hash TEXT PRIMARY KEY NOT NULL,
      user_id INTEGER NOT NULL REFERENCES community_users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS community_sessions_expiry ON community_sessions(expires_at);
  `);
  const addUser = db.prepare(`
    INSERT INTO community_users (username, password_salt, password_hash, created_at)
    VALUES (?, ?, ?, ?) ON CONFLICT (username) DO NOTHING RETURNING id, username
  `);
  const findUser = db.prepare("SELECT id, username, password_salt, password_hash FROM community_users WHERE username = ?");
  const addSession = db.prepare("INSERT INTO community_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)");
  const findSession = db.prepare(`
    SELECT community_users.id, community_users.username FROM community_sessions
    JOIN community_users ON community_users.id = community_sessions.user_id
    WHERE community_sessions.token_hash = ? AND community_sessions.expires_at > ?
  `);
  const removeSession = db.prepare("DELETE FROM community_sessions WHERE token_hash = ?");
  const purgeExpired = db.prepare("DELETE FROM community_sessions WHERE expires_at <= ?");
  const dummySalt = randomBytes(16);
  const dummyKey = randomBytes(keyLength);

  function setCookie(token, maxAge, secure) {
    const protectedCookie = secureCookies || secure;
    const name = protectedCookie ? secureCookieName : cookieName;
    const suffix = protectedCookie ? "; Secure" : "";
    return `${name}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${suffix}`;
  }

  function inSessionTransaction(action) {
    db.exec("SAVEPOINT community_auth");
    try {
      const result = action();
      db.exec("RELEASE community_auth");
      return result;
    } catch (error) {
      db.exec("ROLLBACK TO community_auth; RELEASE community_auth");
      throw error;
    }
  }

  function startSession(user, secure, previous) {
    const token = randomBytes(32).toString("base64url");
    const currentTime = now();
    if (previous && removeSession.run(previous).changes === 0) {
      throw problem(409, "Your sign-in session changed. Please try again.");
    }
    purgeExpired.run(currentTime);
    addSession.run(hashToken(token), user.id, currentTime + sessionSeconds * 1000);
    return { user: { id: user.id, username: user.username }, cookie: setCookie(token, sessionSeconds, secure) };
  }

  return {
    async register(input, { secure = false, previous = null } = {}) {
      const { username, password } = credentials(input, true);
      const salt = randomBytes(16);
      const key = await deriveKey(password, salt, keyLength, passwordCost);
      return inSessionTransaction(() => {
        const user = addUser.get(username, salt, key, now());
        if (!user) throw problem(409, "That nickname is taken. Choose another or sign in.");
        return startSession(user, secure, previous);
      });
    },
    async login(input, { secure = false, previous = null } = {}) {
      const { username, password } = credentials(input, false);
      const user = findUser.get(username);
      const key = await deriveKey(password, user?.password_salt ?? dummySalt, keyLength, passwordCost);
      const matches = timingSafeEqual(key, user?.password_hash ?? dummyKey);
      if (!user || !matches) throw problem(401, invalidLogin);
      return inSessionTransaction(() => startSession(user, secure, previous));
    },
    previousSession(cookieHeader, { secure = false } = {}) {
      const tokenHash = sessionHash(cookieHeader, secureCookies || secure);
      return tokenHash && findSession.get(tokenHash, now()) ? tokenHash : null;
    },
    session(cookieHeader, { secure = false } = {}) {
      const tokenHash = sessionHash(cookieHeader, secureCookies || secure);
      const user = tokenHash && findSession.get(tokenHash, now());
      return user ? { id: user.id, username: user.username } : null;
    },
    logout(cookieHeader, { secure = false } = {}) {
      const tokenHash = sessionHash(cookieHeader, secureCookies || secure);
      if (tokenHash) removeSession.run(tokenHash);
      return setCookie("", 0, secure);
    },
  };
}

module.exports = { createCommunityAuth, normalizeUsername, sessionHash };
