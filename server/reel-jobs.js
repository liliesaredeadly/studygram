const { createHash } = require("node:crypto");
const { mkdir, mkdtemp, open, readdir, readFile, rename, rm, stat, statfs, writeFile } = require("node:fs/promises");
const { join } = require("node:path");
const { pipeline } = require("node:stream/promises");
const { normalizeStoryboard } = require("./reel-timeline");
const { renderReel } = require("./reel-render");

const JOB_ROUTE = /^\/api\/reel-jobs\/([a-f0-9]{64})(?:\/(video|download))?$/;
const OWNER_SCOPE = /^[a-f0-9]{48}$/;
const RENDER_VERSION = "windows-speech-female-v2";
const MAX_PENDING = 5;
const MAX_STORED_REELS = 40;
const MIN_FREE_BYTES = 128n * 1024n * 1024n;
const RENDER_TIMEOUT = 5 * 60 * 1000;
const FAILURE_STEPS = new Set([
  "workspace-preparation", "speech-synthesis", "wav-publication", "wav-probing", "narration-timing",
  "encoding", "verification", "mp4-publication", "workspace-cleanup",
]);

function failureCauses(error) {
  const causes = [];
  for (let cause = error; cause && causes.length < 4; cause = cause.cause) {
    // Do not log exception messages, paths, stacks, process arguments or raw output.
    const diagnostic = {};
    for (const [key, value] of Object.entries({
      name: cause.name, code: cause.code, syscall: cause.syscall, ...cause.diagnostic,
    })) {
      if (["exitCode", "hresult", "scriptLine", "errno", "code"].includes(key) && Number.isInteger(value)) {
        diagnostic[key] = value;
      } else if (["name", "code", "syscall", "tool", "exitSignal", "exception", "reason"].includes(key)
        && typeof value === "string" && /^[\w .-]{1,150}$/.test(value)) {
        diagnostic[key] = value;
      }
    }
    causes.push(diagnostic);
  }
  return causes;
}

function readyJob(id, metadata) {
  return {
    id, stage: "ready", message: "Your reel is ready.", ...metadata,
    videoUrl: `/api/reel-jobs/${id}/video`,
    downloadUrl: `/api/reel-jobs/${id}/download`,
  };
}

function createReelJobs({
  directory, render = renderReel, logFailure = () => console.error("[reel] Render failed"),
  filesystemStats = statfs, onReady,
}) {
  const pending = new Map();
  const failures = new Map();
  let rendering = false;

  function ownerDirectory(scope) {
    if (typeof scope !== "string" || !OWNER_SCOPE.test(scope)) throw new TypeError("Invalid reel owner.");
    return join(directory, "owners", scope);
  }

  async function readReady(id, folder) {
    try {
      const file = await stat(join(folder, `${id}.mp4`));
      if (file.isFile() && file.size > 0) {
        const saved = await readFile(join(folder, `${id}.json`), "utf8").then(JSON.parse).catch(() => ({}));
        return readyJob(id, { engine: saved?.engine, warning: saved?.warning });
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  async function get(id, scope) {
    const folder = ownerDirectory(scope);
    const key = `${scope}:${id}`;
    return pending.get(key)?.status || failures.get(key) || await readReady(id, folder);
  }

  async function enqueue(input, scope) {
    const folder = ownerDirectory(scope);
    let storyboard;
    try {
      storyboard = normalizeStoryboard(input);
    } catch {
      throw Object.assign(new Error("This study set doesn’t have a valid reel script."), { status: 400 });
    }
    const id = createHash("sha256").update(JSON.stringify([RENDER_VERSION, scope, storyboard])).digest("hex");
    const key = `${scope}:${id}`;
    const existing = input.replace === true ? undefined : await readReady(id, folder);
    if (pending.has(key)) return pending.get(key).status;
    if (existing) {
      failures.delete(key);
      return existing;
    }
    if ([...pending.values()].some(job => job.folder === folder)) {
      throw Object.assign(new Error("Wait for your current reel to finish before rendering another one."), { status: 429 });
    }
    if (pending.size >= MAX_PENDING) {
      throw Object.assign(new Error("The render queue is full. Try again when another reel finishes."), { status: 503 });
    }
    failures.delete(key);
    const status = { id, stage: "queued", message: "Waiting to render your reel…" };
    pending.set(key, { folder, storyboard, status, scope });
    void runQueue();
    return status;
  }

  async function storageProblem(folder, id) {
    const stored = (await readdir(folder)).filter(name => /^[a-f0-9]{64}\.mp4$/.test(name));
    if (stored.length >= MAX_STORED_REELS && !stored.includes(`${id}.mp4`)) {
      return `This account has reached its ${MAX_STORED_REELS}-reel storage limit. You can still watch and download your existing reels.`;
    }
    try {
      const { bavail, bsize } = await filesystemStats(folder, { bigint: true });
      if (bavail * bsize < MIN_FREE_BYTES) return "Studygram is low on disk space. Try rendering again after space is freed.";
    } catch (error) {
      if (!["ENOSYS", "ENOTSUP", "EOPNOTSUPP"].includes(error.code)) throw error;
    }
  }

  function recordFailure(key, id, message) {
    failures.set(key, { id, stage: "failed", message });
    if (failures.size > 30) failures.delete(failures.keys().next().value);
  }

  async function runQueue() {
    if (rendering) return;
    rendering = true;
    try {
      for (const [key, job] of pending) {
        const { id } = job.status;
        let workDir;
        let warning;
        let step = "workspace-preparation";
        let signal;
        try {
          await mkdir(job.folder, { recursive: true, mode: 0o700 });
          const problem = await storageProblem(job.folder, id);
          if (problem) {
            recordFailure(key, id, problem);
            continue;
          }
          workDir = await mkdtemp(join(job.folder, ".render-"));
          const outputPath = join(workDir, "reel.mp4");
          signal = AbortSignal.timeout(RENDER_TIMEOUT);
          step = undefined;
          const { engine } = await render({
            storyboard: job.storyboard, outputPath, workDir, signal,
            onProgress(progress) {
              warning = progress.warning || warning;
              job.status = { id, stage: progress.stage, message: progress.message, warning };
            },
          });
          signal.throwIfAborted();
          step = "mp4-publication";
          const output = await stat(outputPath);
          if (!output.isFile() || output.size === 0) throw new Error("The renderer produced no video.");
          signal.throwIfAborted();
          await rename(outputPath, join(job.folder, `${id}.mp4`));
          await writeFile(join(job.folder, `${id}.json`), JSON.stringify({ engine, warning }), { mode: 0o600 }).catch(() => {});
          try {
            onReady?.(job.scope);
          } catch {
            console.error("[reel] Could not record verified completion");
          }
        } catch (error) {
          const reason = signal?.aborted ? signal.reason : error;
          const stage = job.status.stage;
          logFailure({
            id, stage,
            step: FAILURE_STEPS.has(error?.step) ? error.step : step || stage,
            ...(Number.isSafeInteger(error?.beat) && error.beat > 0 && { beat: error.beat }),
            causes: failureCauses(error),
          });
          recordFailure(key, id,
            reason?.name === "TimeoutError" ? "Rendering took too long. Try rendering the reel again."
              : reason?.name === "AbortError" ? "Rendering was cancelled. Try rendering the reel again."
              : (stage === "narrating"
                ? "Studygram couldn’t prepare the narration. Try again. Your quiz is still available."
                : "Studygram couldn’t render this reel. Try again. Your quiz is still available."));
        } finally {
          if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
          pending.delete(key);
        }
      }
    } finally {
      rendering = false;
    }
  }

  async function streamVideo(request, response, folder, id, download) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw Object.assign(new Error("Reel not found."), { status: 404 });
    const file = await open(join(folder, `${id}.mp4`), "r");
    try {
      const stats = await file.stat();
      if (!stats.isFile() || stats.size === 0) {
        throw Object.assign(new Error("Reel not found."), { status: 404 });
      }
      const { size } = stats;
      const range = request.headers.range;
      const bounds = range ? parseRange(range, size) : null;
      const headers = {
        "Content-Type": "video/mp4",
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
        "Cross-Origin-Resource-Policy": "same-origin",
      };
      if (download) headers["Content-Disposition"] = 'attachment; filename="studygram-reel.mp4"';
      if (range && !bounds) {
        response.writeHead(416, { ...headers, "Content-Range": `bytes */${size}` });
        return response.end();
      }
      if (bounds) {
        const { start, end } = bounds;
        headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
        headers["Content-Length"] = end - start + 1;
      } else {
        headers["Content-Length"] = size;
      }
      response.writeHead(bounds ? 206 : 200, headers);
      if (request.method === "HEAD") return response.end();
      await pipeline(file.createReadStream(bounds || {}), response);
    } finally {
      await file.close().catch(() => {});
    }
  }

  function sendVideo(request, response, id, download, scope) {
    return streamVideo(request, response, ownerDirectory(scope), id, download);
  }

  function sendSharedVideo(request, response, { reelId, scope }) {
    // Only an existing Community publication can opt into the old cache layout.
    const folder = scope === null ? directory : ownerDirectory(scope);
    return streamVideo(request, response, folder, reelId, false);
  }

  return { get, enqueue, sendVideo, sendSharedVideo };
}

function parseRange(range, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2]) || size === 0) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  return start <= end ? { start, end } : null;
}

module.exports = { createReelJobs, JOB_ROUTE };
