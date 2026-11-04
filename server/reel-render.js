const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { FPS, gridSize, timeStoryboard } = require('./reel-timeline');
const { renderToolEnvironment } = require('./narration');

const WIDTH = 720;
const HEIGHT = 1280;
const SAMPLE_RATE = 24000;
const REVEAL_FRAMES = 12;
const colors = {
  base: '#18132a', surface: '#261d3c', tile: '#362a51', border: '#514365',
  text: '#fcf7ff', quiet: '#c9bcdc', accent: '#e9ff8c', accentInk: '#241d37',
};

function reelError(publicMessage, { cause, diagnostic } = {}) {
  return Object.assign(new Error(publicMessage, { cause }), { publicMessage, diagnostic });
}

function mediaFailure(stderr) {
  // Classify tool output without recording filenames or arbitrary error text.
  if (/permission denied|access is denied/i.test(stderr)) return 'permission-denied';
  if (/no such file|file not found/i.test(stderr)) return 'file-not-found';
  if (/invalid data/i.test(stderr)) return 'invalid-media';
  if (/unknown encoder|encoder .* not found/i.test(stderr)) return 'encoder-unavailable';
  if (/no space left|disk full/i.test(stderr)) return 'disk-full';
  return undefined;
}

function executable(name) {
  const local = path.join(__dirname, '../.studygram-tools/ffmpeg/bin', `${name}.exe`);
  return process.env[`REEL_${name.toUpperCase()}`] || (process.platform === 'win32' && existsSync(local) ? local : name);
}

function processFile(command, args, toolName, signal, input) {
  signal?.throwIfAborted();
  const child = spawn(command, args, {
    env: renderToolEnvironment(),
    signal,
    windowsHide: true,
    stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  let spawnError;
  child.stdout.setEncoding('utf8').on('data', chunk => { stdout = (stdout + chunk).slice(-65536); });
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr = (stderr + chunk).slice(-65536); });
  child.on('error', error => { spawnError = error; });
  const closed = new Promise((resolve, reject) => {
    child.once('close', (code, exitSignal) => {
      const diagnostic = { tool: toolName, exitCode: code, exitSignal, reason: mediaFailure(stderr) };
      if (signal?.aborted) reject(signal.reason);
      else if (spawnError?.code === 'ENOENT') {
        reject(reelError(`${toolName} could not start. Add it to PATH or set REEL_${toolName}.`, { cause: spawnError, diagnostic }));
      }
      else if (spawnError || code !== 0) {
        reject(reelError(`${toolName} could not process the reel. Try rendering again.`, { cause: spawnError, diagnostic }));
      } else resolve(stdout);
    });
  });
  if (!input) return closed;
  let sourceFailure;
  async function* trackInput() {
    try {
      yield* input;
    } catch (error) {
      sourceFailure = { error };
      throw error;
    }
  }
  const written = pipeline(trackInput(), child.stdin, { signal }).catch(error => {
    child.kill();
    throw error;
  });
  return Promise.allSettled([closed, written]).then(([processResult, inputResult]) => {
    signal?.throwIfAborted();
    // A frame error stops FFmpeg. Prefer it to the resulting exit, but keep
    // encoder failures ahead of downstream pipe errors such as EPIPE.
    if (sourceFailure) throw sourceFailure.error;
    if (processResult.status === 'rejected') throw processResult.reason;
    if (inputResult.status === 'rejected') throw inputResult.reason;
    return processResult.value;
  });
}

async function probe(command, filePath, signal) {
  const output = await processFile(command, ['-v', 'error', '-of', 'json', '-show_streams', '-i', filePath], 'FFPROBE', signal);
  return JSON.parse(output).streams;
}

function frameRate(value) {
  const [numerator, denominator] = (value || '').split('/').map(Number);
  return numerator / denominator;
}

async function verifyReel(command, outputPath, expectedFrames, signal) {
  const streams = await probe(command, outputPath, signal);
  const video = streams.find(stream => stream.codec_type === 'video');
  const audio = streams.find(stream => stream.codec_type === 'audio');
  if (streams.length !== 2 || video?.codec_name !== 'h264' || audio?.codec_name !== 'aac'
    || video.width !== WIDTH || video.height !== HEIGHT || frameRate(video.avg_frame_rate) !== FPS) {
    throw reelError('The MP4 failed verification. Expected a 720 × 1280 H.264 video at 30 fps with AAC narration.', {
      diagnostic: { reason: 'unexpected-media-format' },
    });
  }
  const durations = [Number(video.duration), Number(audio.duration)];
  const starts = [Number(video.start_time), Number(audio.start_time)];
  const tolerance = 2 / FPS;
  const expected = expectedFrames / FPS;
  if (!durations.every(value => Number.isFinite(value) && Math.abs(value - expected) <= tolerance)
    || !starts.every(value => Number.isFinite(value) && Math.abs(value) <= tolerance)
    || Math.abs(durations[0] - durations[1]) > tolerance) {
    throw reelError('The MP4 failed verification because its video and narration timings differ.', {
      diagnostic: { reason: 'invalid-stream-timing' },
    });
  }
}

function box(ctx, x, y, width, height, radius, fill, stroke = null) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function wrapLines(ctx, value, width) {
  const lines = [];
  let line = '';
  for (const word of value.split(' ')) {
    const joined = line ? `${line} ${word}` : word;
    if (ctx.measureText(joined).width <= width) {
      line = joined;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    if (ctx.measureText(word).width <= width) {
      line = word;
      continue;
    }
    for (const character of word) {
      if (line && ctx.measureText(line + character).width > width) {
        lines.push(line);
        line = '';
      }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fitText(ctx, value, { x, y, width, height, size, fill = colors.text, bold = false, align = 'left' }) {
  let lines;
  let lineHeight;
  do {
    ctx.font = `${bold ? 'bold ' : ''}${size}px Arial, sans-serif`;
    lines = wrapLines(ctx, value, width);
    lineHeight = size * 1.18;
    size -= 2;
  } while (lines.length * lineHeight > height && size >= 10);
  ctx.fillStyle = fill;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const visible = Math.min(lines.length, Math.floor(height / lineHeight));
  const center = y + height / 2;
  lines.slice(0, visible).forEach((line, i) => {
    const text = i === visible - 1 && visible < lines.length ? `${line.slice(0, -1)}…` : line;
    ctx.fillText(text, x, center + (i - (visible - 1) / 2) * lineHeight, width);
  });
}

function arrow(ctx, fromX, fromY, toX, toY) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.beginPath();
  ctx.setLineDash([5, 5]);
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(toX - 9 * Math.cos(angle - Math.PI / 5), toY - 9 * Math.sin(angle - Math.PI / 5));
  ctx.lineTo(toX, toY);
  ctx.lineTo(toX - 9 * Math.cos(angle + Math.PI / 5), toY - 9 * Math.sin(angle + Math.PI / 5));
  ctx.stroke();
}

function drawGrid(ctx, beat, selected) {
  const { columns, rows } = gridSize(beat.items.length);
  const x = 116;
  const y = 528;
  const width = 500;
  const height = 270;
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  beat.columnLabels?.forEach((label, column) => fitText(ctx, label, {
    x: x + (column + 0.5) * cellWidth, y: y - 44, width: cellWidth - 6, height: 30,
    size: 24, align: 'center', fill: colors.quiet,
  }));
  beat.rowLabels?.forEach((label, row) => fitText(ctx, label, {
    x: x - 23, y: y + row * cellHeight, width: 38, height: cellHeight,
    size: 19, align: 'center', fill: colors.quiet,
  }));
  beat.items.forEach((item, index) => {
    const cellX = x + (index % columns) * cellWidth;
    const cellY = y + Math.floor(index / columns) * cellHeight;
    const active = selected.has(index);
    box(ctx, cellX + 4, cellY + 4, cellWidth - 8, cellHeight - 8, 12, active ? colors.accent : colors.tile);
    fitText(ctx, item, { x: cellX + cellWidth / 2, y: cellY + 7, width: cellWidth - 22, height: cellHeight - 14,
      size: 42, align: 'center', bold: true, fill: active ? colors.accentInk : colors.text });
  });
  let wrapped = false;
  if (beat.wrap === 'horizontal' || beat.wrap === 'both') {
    for (let row = 0; row < rows; row++) {
      if (!selected.has(row * columns) || !selected.has((row + 1) * columns - 1)) continue;
      const center = y + (row + 0.5) * cellHeight;
      arrow(ctx, x + 18, center + 19, x - 26, center + 19);
      arrow(ctx, x + width + 36, center + 19, x + width + 2, center + 19);
      wrapped = true;
    }
  }
  if (beat.wrap === 'vertical' || beat.wrap === 'both') {
    for (let column = 0; column < columns; column++) {
      if (!selected.has(column) || !selected.has(column + (rows - 1) * columns)) continue;
      const center = x + (column + 0.5) * cellWidth;
      arrow(ctx, center, y + 11, center, y - 11);
      arrow(ctx, center, y + height + 27, center, y + height + 2);
      wrapped = true;
    }
  }
  if (wrapped) fitText(ctx, 'EDGES WRAP', { x: WIDTH / 2, y: 833, width: 270, height: 35,
    size: 21, bold: true, align: 'center', fill: colors.accent });
}

function drawItems(ctx, beat, selected) {
  const steps = beat.visual === 'steps';
  const inline = !steps && beat.items.length >= 3 && beat.items.length <= 4;
  const columns = inline ? beat.items.length : beat.items.length > 6 ? 2 : 1;
  const rows = Math.ceil(beat.items.length / columns);
  const height = Math.min(122, Math.floor(336 / rows));
  const width = Math.floor(556 / columns);
  beat.items.forEach((item, index) => {
    const x = 82 + (index % columns) * width;
    const y = 660 - rows * height / 2 + Math.floor(index / columns) * height;
    const active = selected.has(index);
    const fill = active ? colors.accentInk : colors.text;
    box(ctx, x + 4, y + 4, width - 8, height - 8, Math.min(16, height / 4), active ? colors.accent : colors.tile);
    if (steps) fitText(ctx, String(index + 1).padStart(2, '0'), {
      x: x + 16, y, width: 32, height, size: 22, bold: true, fill: active ? colors.accentInk : colors.quiet,
    });
    fitText(ctx, item, { x: steps ? x + 58 : x + width / 2, y: y + 6, width: width - (steps ? 72 : 25),
      height: height - 12, size: inline ? 37 : 32, fill, bold: active, align: steps ? 'left' : 'center' });
  });
}

function drawFrame(ctx, { title, beat, sceneIndex }, name, sceneCount, frame) {
  const progress = Math.min(1, frame / REVEAL_FRAMES);
  ctx.fillStyle = colors.base;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  fitText(ctx, 'STUDYGRAM  /  REEL', { x: 54, y: 50, width: 355, height: 38, size: 24,
    bold: true, fill: colors.accent });
  fitText(ctx, name, { x: 54, y: 99, width: 612, height: 69, size: 30, fill: colors.quiet });
  fitText(ctx, title, { x: 54, y: 171, width: 612, height: 216, size: 58, bold: true });
  box(ctx, 54, 428, 612, 462, 32, colors.surface, colors.border);
  ctx.save();
  ctx.globalAlpha = 0.64 + progress * 0.36;
  ctx.translate(0, 11 * (1 - progress) ** 2);
  const selected = new Set(progress >= 0.25 ? beat.highlighted : []);
  if (beat.visual === 'grid') drawGrid(ctx, beat, selected);
  else drawItems(ctx, beat, selected);
  ctx.restore();
  box(ctx, 54, 924, 612, 238, 32, colors.surface, colors.border);
  fitText(ctx, beat.caption, { x: WIDTH / 2, y: 938, width: 550, height: 210,
    size: 42, bold: true, align: 'center' });
  for (let scene = 0; scene < sceneCount; scene++) {
    const width = 612 / sceneCount;
    box(ctx, 54 + scene * width, 1208, width - 8, 7, 3, scene <= sceneIndex ? colors.accent : colors.border);
  }
}

async function* frameBuffers(beats, storyboard, signal) {
  const { createCanvas } = require('@napi-rs/canvas');
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  for (const item of beats) {
    let encoded;
    for (let frame = 0; frame < item.frames; frame++) {
      signal?.throwIfAborted();
      if (frame <= REVEAL_FRAMES) {
        drawFrame(ctx, item, storyboard.name, storyboard.scenes.length, frame);
        encoded = await canvas.encode('png');
      }
      yield encoded;
    }
  }
}

function encode(command, beats, storyboard, outputPath, signal) {
  const filters = beats.map((item, i) => {
    const samples = item.frames * (SAMPLE_RATE / FPS);
    return `[${i + 1}:a]aresample=${SAMPLE_RATE},aformat=channel_layouts=mono,apad=whole_len=${samples},`
      + `atrim=end_sample=${samples},asetpts=N/SR/TB[a${i}]`;
  });
  filters.push(`${beats.map((_, i) => `[a${i}]`).join('')}concat=n=${beats.length}:v=0:a=1[audio]`);
  return processFile(command, [
    '-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(FPS), '-f', 'image2pipe', '-c:v', 'png', '-i', 'pipe:0',
    ...beats.flatMap(item => ['-i', item.filePath]),
    '-filter_complex', filters.join(';'), '-map', '0:v:0', '-map', '[audio]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-threads', '4',
    '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', '-f', 'mp4', outputPath,
  ], 'FFMPEG', signal, frameBuffers(beats, storyboard, signal));
}

async function renderReel({ storyboard, outputPath, workDir, signal, onProgress = () => {},
  synthesize = options => require('./narration').synthesizeNarration(options),
  ffmpeg = executable('ffmpeg'), ffprobe = executable('ffprobe') }) {
  signal?.throwIfAborted();
  const beats = storyboard.scenes.flatMap(({ title, beats: sceneBeats }, sceneIndex) =>
    sceneBeats.map(beat => ({ title, beat, sceneIndex })));
  let scratch;
  let engine;
  let beat;
  let step = 'workspace-preparation';
  let failed = false;
  try {
    scratch = await fs.mkdtemp(path.join(workDir, 'narration-'));
    for (const [index, item] of beats.entries()) {
      beat = index + 1;
      step = 'speech-synthesis';
      signal?.throwIfAborted();
      onProgress({ stage: 'narrating', message: `Recording voice (${beat} of ${beats.length})` });
      item.filePath = path.join(scratch, `beat-${index}.wav`);
      const result = await synthesize({ text: item.beat.narration, outputPath: item.filePath, signal, engine });
      if (!result?.engine || (engine && engine !== result.engine)) {
        throw reelError('Narration changed voice engines during the reel. Please render again.');
      }
      engine = result.engine;
      step = 'wav-probing';
      const streams = await probe(ffprobe, item.filePath, signal);
      item.duration = Number(streams.find(stream => stream.codec_type === 'audio')?.duration);
      if (!Number.isFinite(item.duration) || item.duration <= 0) {
        throw reelError('A narration clip has an invalid duration. Try rendering again.', {
          diagnostic: { reason: 'invalid-wav-duration' },
        });
      }
    }
    beat = undefined;
    step = 'narration-timing';
    const timing = timeStoryboard(beats.map(beat => beat.duration));
    timing.forEach((beat, index) => Object.assign(beats[index], beat));
    const totalFrames = timing.at(-1).startFrame + timing.at(-1).frames;
    const warning = totalFrames > FPS * 60 ? 'Narration runs longer than one minute. All spoken lines were kept.' : undefined;
    step = 'encoding';
    onProgress({ stage: 'rendering', message: 'Rendering video', ...(warning ? { warning } : {}) });
    const partialPath = path.join(scratch, 'reel.mp4');
    await encode(ffmpeg, beats, storyboard, partialPath, signal);
    step = 'verification';
    onProgress({ stage: 'verifying', message: 'Checking video and narration' });
    await verifyReel(ffprobe, partialPath, totalFrames, signal);
    step = 'mp4-publication';
    signal?.throwIfAborted();
    await fs.rename(partialPath, outputPath);
    return { engine };
  } catch (cause) {
    failed = true;
    if (step === 'speech-synthesis' && cause?.step === 'wav-publication') step = cause.step;
    const publicMessage = cause?.publicMessage || (step === 'wav-publication' || step === 'wav-probing'
      ? 'Studygram couldn’t prepare the narration audio. Try rendering again. Your quiz is still available.' : undefined);
    throw Object.assign(new Error('Reel rendering failed.', { cause }), { step, beat, publicMessage, name: cause?.name || 'Error' });
  } finally {
    if (scratch) await fs.rm(scratch, { recursive: true, force: true, maxRetries: 3 }).catch(cause => {
      if (!failed) throw Object.assign(new Error('Could not clean up the render workspace.', { cause }), { step: 'workspace-cleanup' });
    });
  }
}

module.exports = { renderReel };
