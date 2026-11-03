const { createServer } = require("node:http");
const { readFile } = require("node:fs/promises");
const { resolve } = require("node:path");
const { generateText } = require("./model");
const { tasks } = require("./tasks");

const root = resolve(__dirname, "..");
const staticFile = /^\/(?:index\.html|style\.css|pages\/[a-z-]+\.html|js\/[a-z-]+\.js)$/;
const pdfAsset = /^\/vendor\/(pdf(?:\.worker)?\.mjs)$/;
const mime = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
};

function respond(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(data));
}

async function readInput(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 128 * 1024) {
      request.resume();
      throw Object.assign(new Error("That’s a bit too much text. Try a shorter excerpt."), { status: 413 });
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Studygram couldn’t read that request."), { status: 400 });
  }
}

function createStudygramServer(model = generateText) {
  return createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    const path = request.url.split("?")[0];
    const task = Object.hasOwn(tasks, path) ? tasks[path] : null;
    try {
      if (task && request.method === "POST") {
        if (!/^application\/json(?:;|$)/i.test(request.headers["content-type"] || "")) {
          return respond(response, 415, { error: "Use a JSON request." });
        }
        const input = await readInput(request);
        if (!input || !task.validInput(input)) {
          return respond(response, 400, { error: "Check your topic and trim any long notes before trying again." });
        }
        const raw = await model({ instructions: task.instructions, input });
        let result;
        try {
          result = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/gi, ""));
        } catch {
          return respond(response, 502, { error: "The AI reply came back in an unexpected format. Try again." });
        }
        if (!result || !task.validOutput(result)) {
          return respond(response, 502, { error: "The AI reply was incomplete. Try again." });
        }
        return respond(response, 200, result);
      }

      const route = path === "/" ? "/index.html" : path;
      const vendor = pdfAsset.exec(route);
      if (request.method === "GET" && (staticFile.test(route) || vendor)) {
        const file = vendor
          ? resolve(root, "node_modules/pdfjs-dist/build", vendor[1])
          : resolve(root, route.slice(1));
        const contents = await readFile(file);
        response.writeHead(200, { "Content-Type": mime[route.split(".").at(-1)] });
        return response.end(contents);
      }
      return respond(response, task ? 405 : 404, { error: task ? "Use POST." : "Page not found." });
    } catch (error) {
      if (error.code === "ENOENT") return respond(response, 404, { error: "Page not found." });
      if (error.status) return respond(response, error.status, { error: error.message });
      if (error.name === "TimeoutError") {
        return respond(response, 504, { error: "The AI took too long. Your draft is still here. Try again." });
      }
      return respond(response, 502, { error: "Studygram couldn’t reach the AI. Try again in a moment." });
    }
  });
}

if (require.main === module) {
  try {
    process.loadEnvFile(resolve(root, ".env"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const port = Number(process.env.PORT || 3000);
  createStudygramServer().listen(port, "127.0.0.1", () => {
    process.stdout.write(`Studygram is running at http://localhost:${port}\n`);
  });
}

module.exports = { createStudygramServer };
