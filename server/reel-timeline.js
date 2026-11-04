const FPS = 30;
const STORYBOARD_VERSION = 1;
const MAX_REEL_SECONDS = 180;
const grayCodes = { 2: ['0', '1'], 4: ['00', '01', '11', '10'] };

function boundedText(value, max, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new Error(`${label} must contain 1–${max} characters.`);
  }
  return value.trim().replace(/\s+/gu, ' ');
}

function boundedList(value, max, label) {
  if (!Array.isArray(value) || value.length === 0 || value.length > max) {
    throw new Error(`${label} must contain 1–${max} entries.`);
  }
  return value;
}

function gridSize(cells) {
  const columns = cells === 4 ? 2 : 4;
  return { columns, rows: cells / columns };
}

function inferWrap(highlighted, columns, rows) {
  const hasPair = (count, start, end) => Array.from({ length: count }, (_, index) => index)
    .some(index => highlighted.includes(start(index)) && highlighted.includes(end(index)));
  const horizontal = columns > 2 && hasPair(rows, row => row * columns, row => (row + 1) * columns - 1);
  const vertical = rows > 2 && hasPair(columns, column => column, column => column + (rows - 1) * columns);
  if (horizontal && vertical) return 'both';
  if (horizontal) return 'horizontal';
  if (vertical) return 'vertical';
  return undefined;
}

function gridLabels(value, count) {
  if (!Array.isArray(value) || value.length !== count) {
    throw new Error(`Grid labels must match the ${count} rows or columns.`);
  }
  return value.map(label => boundedText(label, 12, 'Grid label'));
}

function normalizeBeat(beat, isKMap) {
  if (!beat || !['grid', 'steps', 'highlight'].includes(beat.visual)) {
    throw new Error('Choose a grid, steps, or highlight visual for each beat.');
  }
  const items = boundedList(beat.items, 16, 'Visual items').map(item => boundedText(item, 90, 'Visual item'));
  if (!Array.isArray(beat.highlighted) || beat.highlighted.length > items.length
    || !beat.highlighted.every(index => Number.isInteger(index) && index >= 0 && index < items.length)) {
    throw new Error('Visual highlights must refer to item indices.');
  }
  const highlighted = [...new Set(beat.highlighted)].sort((a, b) => a - b);
  const result = {
    narration: boundedText(beat.narration, 650, 'Narration'),
    caption: boundedText(beat.caption, 300, 'Caption'),
    visual: beat.visual,
    items,
    highlighted,
  };
  if (beat.visual !== 'grid') return result;
  if (![4, 8, 16].includes(items.length)) throw new Error('A grid must contain 4, 8, or 16 cells.');
  const { columns, rows } = gridSize(items.length);
  if (beat.rowLabels !== undefined || isKMap) result.rowLabels = gridLabels(beat.rowLabels ?? grayCodes[rows], rows);
  if (beat.columnLabels !== undefined || isKMap) {
    result.columnLabels = gridLabels(beat.columnLabels ?? grayCodes[columns], columns);
  }
  const wrap = beat.wrap ?? (isKMap ? inferWrap(highlighted, columns, rows) : undefined);
  if (wrap !== undefined) {
    if (!['horizontal', 'vertical', 'both'].includes(wrap)) throw new Error('Grid wrap must name a grid direction.');
    result.wrap = wrap;
  }
  return result;
}

function normalizeStoryboard({ name, scenes, storyboard } = {}) {
  name = boundedText(name ?? storyboard?.name, 120, 'Study set name');
  const versioned = storyboard != null;
  if (versioned && storyboard.version !== STORYBOARD_VERSION) {
    throw new Error(`Storyboard version ${STORYBOARD_VERSION} is required.`);
  }
  const isKMap = /\b(?:k[\s-]?maps?|karnaugh\s+maps?)\b/i.test(name);
  const result = boundedList(versioned ? storyboard.scenes : scenes, 5, 'Storyboard scenes').map(scene => ({
    title: boundedText(scene?.title, 120, 'Scene title'),
    beats: (versioned ? boundedList(scene.beats, 4, 'Scene beats') : [scene]).map(beat => normalizeBeat(beat, isKMap)),
  }));
  const characters = result.flatMap(scene => scene.beats).reduce((sum, beat) => sum + beat.narration.length, 0);
  if (characters > 3250) throw new Error('The storyboard contains too much narration to render.');
  return { version: STORYBOARD_VERSION, name, scenes: result };
}

function timeStoryboard(durations) {
  let startFrame = 0;
  return durations.map((duration, index) => {
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('A narration clip has an invalid duration.');
    const gapFrames = index === durations.length - 1 ? 3 : 9;
    const frames = Math.ceil(duration * FPS) + gapFrames;
    const beat = { startFrame, frames, seconds: frames / FPS };
    startFrame += frames;
    if (startFrame > MAX_REEL_SECONDS * FPS) throw new Error('Narration exceeds the three-minute render limit.');
    return beat;
  });
}

module.exports = { FPS, gridSize, normalizeStoryboard, timeStoryboard };
