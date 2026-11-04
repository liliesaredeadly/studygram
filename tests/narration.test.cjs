const assert = require("node:assert/strict");
const { mkdtemp, readFile, readdir, rm, rmdir } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { test } = require("node:test");

const narration = "Start with a K-map and read its labels in Gray code. Find zero zero at the left edge. " +
  "The last column is its neighbor across the edge. Group the two cells to simplify the expression.";

async function outputFile(t) {
  const folder = await mkdtemp(join(tmpdir(), "studygram narration "));
  const outputPath = join(folder, "K-map's audio.wav");
  t.after(async () => {
    await rm(outputPath, { force: true });
    await rmdir(folder);
  });
  return { folder, outputPath };
}

test("Windows narration writes a non-silent mono WAV for a K-map sample", { skip: process.platform !== "win32" }, async t => {
  const { synthesizeNarration } = require("../server/narration");
  const { outputPath } = await outputFile(t);
  const { engine } = await synthesizeNarration({ text: narration, outputPath });
  const wav = await readFile(outputPath);

  assert.match(engine, /^Windows Speech \(.+\)$/);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt32LE(24), 24000);
  assert.equal(wav.readUInt16LE(34), 16);
  const data = wav.indexOf("data", 36, "ascii");
  assert.ok(data >= 36);
  const size = wav.readUInt32LE(data + 4);
  assert.ok(size / 48000 >= 10 && size / 48000 <= 25, "expected roughly fifteen seconds of audio");
  assert.ok(wav.subarray(data + 8, data + 8 + size).some(sample => sample !== 0));
});

test("cancelling Windows narration removes in-progress output", { skip: process.platform !== "win32" }, async t => {
  const { synthesizeNarration } = require("../server/narration");
  const { folder, outputPath } = await outputFile(t);
  const controller = new AbortController();
  const speech = synthesizeNarration({ text: narration.repeat(20), outputPath, signal: controller.signal });
  controller.abort();
  await assert.rejects(speech, { name: "AbortError" });
  assert.deepEqual(await readdir(folder), []);
});

test("later narration beats cannot silently switch away from the selected voice", { skip: process.platform !== "win32" }, async t => {
  const { synthesizeNarration } = require("../server/narration");
  const { folder, outputPath } = await outputFile(t);
  await assert.rejects(synthesizeNarration({
    text: "This beat needs the same voice as the previous beat.",
    outputPath,
    engine: "Windows Speech (Nonexistent Studygram Test Voice)",
  }), error => {
    assert.match(error.message, /Windows Speech couldn't record/);
    assert.equal(error.step, "speech-synthesis");
    assert.equal(error.diagnostic.exitCode, 1);
    assert.match(error.diagnostic.exception, /^System\./);
    assert.equal(Number.isInteger(error.diagnostic.hresult), true);
    assert.doesNotMatch(JSON.stringify(error.diagnostic), /Nonexistent Studygram Test Voice|This beat needs/);
    return true;
  });
  assert.deepEqual(await readdir(folder), []);
});

test("a Windows WAV rename failure retains its filesystem cause and cleans up", { skip: process.platform !== "win32" }, async t => {
  const { synthesizeNarration } = require("../server/narration");
  const folder = await mkdtemp(join(tmpdir(), "studygram narration "));
  t.after(() => rm(folder, { recursive: true, force: true }));
  await assert.rejects(synthesizeNarration({ text: "An example.", outputPath: folder }), error => {
    assert.equal(error.step, "wav-publication");
    assert.equal(error.cause.syscall, "rename");
    return true;
  });
  assert.deepEqual(await readdir(folder), []);
});
