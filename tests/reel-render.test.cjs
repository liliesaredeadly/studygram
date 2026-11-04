const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const timeline = () => require('../server/reel-timeline');
const beat = {
  narration: 'The ends can be neighbors.',
  caption: 'The ends touch.',
  visual: 'grid',
  items: ['1', '0', '0', '1', '0', '0', '0', '0'],
  highlighted: [0, 3],
};

function storyboard(beatOverrides = {}) {
  return { version: 1, scenes: [{ title: 'A worked example', beats: [{ ...beat, ...beatOverrides }] }] };
}

async function bundledSample() {
  const source = await fs.readFile(path.join(__dirname, '../js/sample-study.js'), 'utf8');
  return vm.runInNewContext(`${source}\nKMAP_SAMPLE`);
}

test('a saved K-map sample preserves the script and identifies a horizontal wrap', async () => {
  const sample = await bundledSample();
  const normalized = timeline().normalizeStoryboard({ name: sample.name, ...sample.content });
  const oldSet = timeline().normalizeStoryboard({ name: sample.name, scenes: sample.content.scenes });
  assert.equal(normalized.version, 1);
  assert.equal(normalized.scenes.length, 3);
  assert.deepEqual(oldSet.scenes[0].beats[0].columnLabels, ['00', '01', '11', '10']);
  assert.equal(oldSet.scenes[0].beats[0].wrap, 'horizontal');
  assert.equal(oldSet.scenes[0].beats[0].narration, sample.content.scenes[0].narration);
});

test('a versioned storyboard validates grid data and takes precedence over old scenes', () => {
  const { normalizeStoryboard } = timeline();
  const input = { name: 'Boundaries', scenes: [], storyboard: storyboard({ wrap: 'horizontal' }) };
  assert.equal(normalizeStoryboard(input).scenes[0].beats[0].wrap, 'horizontal');
  assert.throws(() => normalizeStoryboard({ ...input, storyboard: storyboard({ highlighted: [8] }) }), /highlight/i);
  assert.throws(() => normalizeStoryboard({ ...input, storyboard: { ...storyboard(), version: 2 } }), /version/i);
  assert.throws(() => normalizeStoryboard({ ...input, storyboard: storyboard({ columnLabels: ['1'] }) }), /labels/i);
});

test('audio durations snap to frame boundaries without cutting spoken lines', () => {
  const { timeStoryboard } = timeline();
  const timed = timeStoryboard([1.02, 2.026]);
  assert.deepEqual(timed.map(({ startFrame, frames }) => [startFrame, frames]), [[0, 40], [40, 64]]);
  assert.throws(() => timeStoryboard([0]), /duration/i);
});

async function synthesizeWav({ outputPath }) {
  const wav = Buffer.alloc(44 + 48000);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(24000, 24);
  wav.writeUInt32LE(48000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(48000, 40);
  for (let i = 0; i < 24000; i++) wav.writeInt16LE(Math.round(Math.sin(i / 17) * 1000), 44 + i * 2);
  await fs.writeFile(outputPath, wav);
  return { engine: 'test' };
}

const encoderTest = { skip: !process.env.REEL_TEST_ENCODER, timeout: 120000 };

test('the renderer streams the K-map edge scene as a verified portrait MP4 from local WAV files', encoderTest, async ({ signal }) => {
  const dir = await fs.mkdtemp(path.join(__dirname, '.studygram-render-'));
  try {
    const { renderReel } = require('../server/reel-render');
    const sample = await bundledSample();
    const outputPath = path.join(dir, 'sample.mp4');
    const stages = new Set();
    const result = await renderReel({
      storyboard: timeline().normalizeStoryboard({ name: sample.name, scenes: [sample.content.scenes[0]] }),
      outputPath,
      workDir: dir,
      signal,
      onProgress: ({ stage }) => stages.add(stage),
      synthesize: synthesizeWav,
    });
    assert.equal(result.engine, 'test');
    assert.ok((await fs.stat(outputPath)).size > 10000);
    assert.deepEqual([...stages], ['narrating', 'rendering', 'verifying']);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('a frame source failure remains the encoding cause after FFmpeg is stopped', encoderTest, async ({ signal }) => {
  const { renderReel } = require('../server/reel-render');
  const dir = await fs.mkdtemp(path.join(__dirname, '.studygram-render-'));
  const drawingError = new Error('Fixture frame drawing failure');
  try {
    await assert.rejects(renderReel({
      storyboard: { ...storyboard(), get name() { throw drawingError; } },
      outputPath: path.join(dir, 'sample.mp4'),
      workDir: dir,
      signal,
      synthesize: synthesizeWav,
    }), error => {
      assert.equal(error.step, 'encoding');
      assert.equal(error.cause, drawingError);
      return true;
    });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
