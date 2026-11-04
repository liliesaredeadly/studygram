const http = require("node:http");
const https = require("node:https");
const { randomBytes } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { readFile } = require("node:fs/promises");
const { resolve } = require("node:path");
const { generateText } = require("./model");
const { tasks } = require("./tasks");
const { createReelJobs, JOB_ROUTE } = require("./reel-jobs");
const { getWisdomResponse } = require("./wisdom");
const { findPursuitSources } = require("./pursuit");
const { createEventFeed } = require("./events");
const { createCommunityHandler } = require("./community");

const root = resolve(__dirname, "..");
const staticFile = /^\/(?:index\.html|(?:style|brand|wisdom|explore|growth|pursuit|academy|community)\.css|pages\/[a-z-]+\.html|js\/[a-z-]+\.js|assets\/(?:diary-pets|studygram-mark|avatars\/[a-z-]+)\.svg)$/;
const pdfAsset = /^\/vendor\/(pdf(?:\.worker)?\.mjs)$/;
const localHost = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i;
const adminPath = /^\/(?:pages\/|api\/)?(?:admin|moderator|moderation)(?:[-./]|$)/i;
const mime = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  svg: "image/svg+xml",
};

function respond(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(data));
}

async function readInput(request, maxBytes = 128 * 1024) {
  if (Number(request.headers["content-length"]) > maxBytes) {
    request.resume();
    throw Object.assign(new Error("That’s a bit too much data. Try a smaller request."), { status: 413 });
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > maxBytes) {
      request.resume();
      throw Object.assign(new Error("That’s a bit too much text. Try a shorter excerpt."), { status: 413 });
    }
    chunks.push(chunk);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    return data;
  } catch {
    throw Object.assign(new Error("Studygram couldn’t read that request."), { status: 400 });
  }
}

function setSecurityHeaders(response, secure) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=(self)");
  if (secure) response.setHeader("Strict-Transport-Security", "max-age=31536000");
}

function setPagePolicy(response, nonce, secure) {
  const policy = [
    "default-src 'none'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'",
    "form-action 'self'", `script-src 'self' 'nonce-${nonce}'`, "script-src-attr 'none'", "worker-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data: blob:",
    "media-src 'self' blob:", "connect-src 'self'",
  ];
  if (secure) policy.push("upgrade-insecure-requests");
  response.setHeader("Content-Security-Policy", policy.join("; "));
}

function createRequestBudget(perMinute, concurrent) {
  const clients = new Map();
  let active = 0;
  return (key, response) => {
    const now = Date.now();
    for (const [client, state] of clients) {
      if (state.resetAt <= now) clients.delete(client);
    }
    const previous = clients.get(key);
    if (active >= concurrent || previous?.count >= perMinute || (!previous && clients.size >= 2000)) {
      response.setHeader("Retry-After", "60");
      respond(response, 429, { error: "Studygram is busy. Try again in a minute." });
      return null;
    }
    clients.set(key, { count: (previous?.count ?? 0) + 1, resetAt: previous?.resetAt ?? now + 60_000 });
    active += 1;
    return () => { active -= 1; };
  };
}

function createStudygramServer(model = generateText, reelOptions = {}, eventOptions = {}, communityOptions = {}, transport = {}) {
  const reels = createReelJobs({
    directory: resolve(root, ".studygram-reels"),
    ...reelOptions,
    onReady: scope => community.recordReelReady(scope),
  });
  const getEvents = createEventFeed(eventOptions);
  const community = createCommunityHandler({ ...communityOptions, origin: transport.origin || communityOptions.origin }, { readInput, respond, reelJobs: reels });
  const modelBudget = createRequestBudget(24, 6);
  const lookupBudget = createRequestBudget(18, 4);
  const handle = async (request, response) => {
    const secure = Boolean(request.socket.encrypted);
    setSecurityHeaders(response, secure);
    const host = request.headers.host;
    const origin = `${secure ? "https" : "http"}://${host}`;
    if (transport.origin ? origin !== transport.origin : !localHost.test(host || "")) {
      return respond(response, 421, { error: "Invalid Studygram address." });
    }
    const path = request.url.split("?")[0];
    let decodedPath;
    try {
      decodedPath = decodeURIComponent(path);
    } catch {
      return respond(response, 400, { error: "Invalid request address." });
    }
    if (!path.startsWith("/") || path.startsWith("//") || adminPath.test(decodedPath)) {
      return respond(response, 404, { error: "Page not found." });
    }
    if (path.startsWith("/api/") && !["GET", "HEAD"].includes(request.method)
        && ((request.headers.origin !== undefined && request.headers.origin !== origin)
          || request.headers["sec-fetch-site"] === "cross-site")) {
      return respond(response, 403, { error: "Open Studygram to make that request." });
    }
    const task = Object.hasOwn(tasks, path) ? tasks[path] : null;
    try {
      if (path.startsWith("/api/community/")) return await community.handle(request, response, path);
      if (path === "/api/events") {
        if (request.method !== "GET") return respond(response, 405, { error: "Use GET." });
        return respond(response, 200, await getEvents());
      }
      if (path === "/api/pursuit-sources") {
        if (request.method !== "POST") return respond(response, 405, { error: "Use POST." });
        if (!/^application\/json(?:;|$)/i.test(request.headers["content-type"] || "")) {
          return respond(response, 415, { error: "Use a JSON request." });
        }
        const input = await readInput(request);
        const finish = lookupBudget(request.socket.remoteAddress, response);
        if (!finish) return;
        try {
          return respond(response, 200, { sources: await findPursuitSources(input.interest) });
        } finally {
          finish();
        }
      }
      if (path === "/api/wisdom") {
        if (request.method !== "POST") return respond(response, 405, { error: "Use POST." });
        if (!/^application\/json(?:;|$)/i.test(request.headers["content-type"] || "")) {
          return respond(response, 415, { error: "Use a JSON request." });
        }
        const result = getWisdomResponse(await readInput(request));
        return result
          ? respond(response, 200, result)
          : respond(response, 400, { error: "Check your message and try again." });
      }
      if (path === "/api/reel-jobs") {
        if (request.method !== "POST") return respond(response, 405, { error: "Use POST." });
        if (!/^application\/json(?:;|$)/i.test(request.headers["content-type"] || "")) {
          return respond(response, 415, { error: "Use a JSON request." });
        }
        const owner = community.reelOwner(request);
        if (!owner) return respond(response, 401, { error: "Sign in to create a private reel." });
        const input = await readInput(request);
        if (community.reelOwner(request) !== owner) return respond(response, 401, { error: "Sign in to create a private reel." });
        if (Object.hasOwn(input, "accountId") && input.accountId !== community.session(request)?.id) {
          return respond(response, 409, { error: "Your Studygram account changed. Reload this page and try again." });
        }
        const job = await reels.enqueue(input, owner);
        return respond(response, job.stage === "ready" ? 200 : 202, job);
      }
      const reel = JOB_ROUTE.exec(path);
      if (reel) {
        const [, id, asset] = reel;
        const owner = community.reelOwner(request);
        if (!owner) return respond(response, 401, { error: "Sign in to open your private reel." });
        if (asset) {
          if (!["GET", "HEAD"].includes(request.method)) return respond(response, 405, { error: "Use GET or HEAD." });
          return await reels.sendVideo(request, response, id, asset === "download", owner);
        }
        if (request.method !== "GET") return respond(response, 405, { error: "Use GET." });
        const job = await reels.get(id, owner);
        return job ? respond(response, 200, job) : respond(response, 404, { error: "Reel not found." });
      }
      if (task && request.method === "POST") {
        if (!/^application\/json(?:;|$)/i.test(request.headers["content-type"] || "")) {
          return respond(response, 415, { error: "Use a JSON request." });
        }
        const input = await readInput(request);
        if (!input || !task.validInput(input)) {
          return respond(response, 400, { error: "Check your topic and trim any long notes before trying again." });
        }
        const member = transport.requireAccount || path === "/api/study-set" ? community.session(request) : null;
        if (transport.requireAccount && !member) return respond(response, 401, { error: "Sign in to use live AI." });
        if (path === "/api/study-set" && Object.hasOwn(input, "accountId") && input.accountId !== member?.id) {
          return respond(response, 409, { error: "Your Studygram account changed. Reload this page and try again." });
        }
        const bucket = member ? `member:${member.id}` : request.socket.remoteAddress;
        const modelInput = task.formatInput ? task.formatInput(input) : input;
        const finish = modelBudget(bucket, response);
        if (!finish) return;
        let raw;
        try {
          raw = await model({ instructions: task.instructions, input: modelInput });
        } catch (error) {
          if (error.name === "TimeoutError") return respond(response, 504, { error: "The AI took too long. Try again." });
          if (error.status === 429) return respond(response, 429, { error: "Live AI is busy. Try again in a moment." });
          return respond(response, error.status === 503 ? 503 : 502, { error: "Live AI is temporarily unavailable. Try again in a moment." });
        } finally {
          finish();
        }
        let result;
        try {
          result = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/gi, ""));
        } catch {
          return respond(response, 502, { error: "The AI reply came back in an unexpected format. Try again." });
        }
        if (!result || !task.validOutput(result, input)) {
          return respond(response, 502, { error: "The AI reply was incomplete. Try again." });
        }
        if (task.formatOutput) {
          try {
            result = task.formatOutput(result, input);
          } catch {
            return respond(response, 502, { error: "The AI reply didn’t include a usable reel script. Try again." });
          }
        }
        if (path === "/api/study-set" && member) community.recordStudySet(request, member.id);
        return respond(response, 200, result);
      }

      const route = path === "/" ? "/index.html" : path;
      const vendor = pdfAsset.exec(route);
      if (["GET", "HEAD"].includes(request.method) && (staticFile.test(route) || vendor)) {
        const file = vendor
          ? resolve(root, "node_modules/pdfjs-dist/build", vendor[1])
          : resolve(root, route.slice(1));
        let contents = await readFile(file);
        if (route.endsWith(".html")) {
          const nonce = randomBytes(18).toString("base64");
          setPagePolicy(response, nonce, secure);
          contents = Buffer.from(contents.toString("utf8").replace(/<script(?=[\s>])/gi, `<script nonce="${nonce}"`));
        }
        response.writeHead(200, {
          "Content-Type": mime[route.split(".").at(-1)],
          "Content-Length": contents.length,
          "Cache-Control": "no-store",
        });
        return response.end(request.method === "HEAD" ? undefined : contents);
      }
      return respond(response, task ? 405 : 404, { error: task ? "Use POST." : "Page not found." });
    } catch (error) {
      if (response.headersSent || response.destroyed) {
        response.destroy();
        return;
      }
      if (error.code === "ENOENT") return respond(response, 404, { error: "Page not found." });
      if ([400, 401, 403, 404, 409, 410, 413, 415, 429].includes(error.status)) {
        return respond(response, error.status, { error: error.message });
      }
      if (error.status === 503) return respond(response, 503, { error: "This service is temporarily unavailable. Try again in a moment." });
      if (path.startsWith("/api/community/")) return respond(response, 500, { error: "The community is temporarily unavailable. Try again in a moment." });
      if (error.name === "TimeoutError") {
        return respond(response, 504, { error: "The AI took too long. Your draft is still here. Try again." });
      }
      return respond(response, 502, { error: "Studygram couldn’t reach the AI. Try again in a moment." });
    }
  };
  const options = { requestTimeout: 30_000, headersTimeout: 10_000, maxHeaderSize: 8192 };
  const server = transport.tls
    ? https.createServer({ ...options, ...transport.tls, minVersion: "TLSv1.2" }, handle)
    : http.createServer(options, handle);
  server.once("close", community.close);
  return server;
}

function start() {
  try {
    process.loadEnvFile(resolve(root, ".env"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid port.");
  const host = process.env.STUDYGRAM_HOST || "127.0.0.1";
  const local = ["127.0.0.1", "::1"].includes(host);
  const production = process.env.NODE_ENV === "production" || !local;
  const certPath = process.env.STUDYGRAM_TLS_CERT;
  const keyPath = process.env.STUDYGRAM_TLS_KEY;
  if (Boolean(certPath) !== Boolean(keyPath) || (production && !certPath)) {
    throw new Error("Configure STUDYGRAM_TLS_CERT and STUDYGRAM_TLS_KEY for HTTPS.");
  }
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    throw new Error("Enable TLS certificate verification before starting Studygram.");
  }
  const tls = certPath ? { cert: readFileSync(certPath), key: readFileSync(keyPath) } : null;
  const origin = process.env.STUDYGRAM_ORIGIN;
  if (!local && !origin) throw new Error("Configure the public HTTPS STUDYGRAM_ORIGIN.");
  if (origin) {
    const url = new URL(origin);
    if (url.origin !== origin || url.protocol !== (tls ? "https:" : "http:")) {
      throw new Error("STUDYGRAM_ORIGIN must match the server’s protocol and contain only a host and optional port.");
    }
  }
  const server = createStudygramServer(generateText, {}, {}, {}, { tls, origin, requireAccount: production });
  server.once("error", error => {
    process.stderr.write(error.code === "EADDRINUSE" ? "The Studygram port is already in use.\n" : "Studygram could not open its listening address.\n");
    server.close();
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    process.stdout.write(`Studygram is running at ${origin || `${tls ? "https" : "http"}://localhost:${port}`}\n`);
  });
}

if (require.main === module) {
  try {
    start();
  } catch {
    process.stderr.write("Studygram could not start. Check its HTTPS, origin, and database configuration.\n");
    process.exitCode = 1;
  }
}

module.exports = { createStudygramServer };
