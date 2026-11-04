const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function browser() {
  const saved = new Map();
  let profile = null;
  let full = false;
  const localStorage = {
    getItem: key => saved.get(key) ?? null,
    setItem(key, value) {
      if (full) throw new Error('Storage is full');
      saved.set(key, value);
    },
    removeItem: key => saved.delete(key)
  };
  const context = vm.createContext({ localStorage, Storage: { getStudentProfile: () => profile } });
  const source = join(__dirname, '../js/growth-state.js');
  assert.ok(existsSync(source), 'Growth state module is available');
  const store = vm.runInContext(`${readFileSync(source, 'utf8')}\nGrowthStore`, context);
  return {
    store, saved,
    select: studentId => { profile = studentId == null ? null : { studentId }; },
    fill: () => { full = true; }
  };
}

const snapshot = value => JSON.parse(JSON.stringify(value));
const at = (day, hour = 12, minute = 0) => new Date(2026, 10, day, hour, minute).getTime();

function entry(kind, day, id = `${kind}-${day}`) {
  return { id, kind, at: at(day), text: 'I put my thoughts into words.' };
}

test('student and guest drafts survive profile switches and clear only affects the active profile', () => {
  const { store, saved, select } = browser();
  saved.set('sg_diary', 'separate app data');
  store.update(state => { state.drafts.journal = 'Guest thought'; });
  select('guest');
  assert.equal(store.load().drafts.journal, undefined);
  store.update(state => { state.drafts.journal = 'Student thought'; });
  select('second-student');
  assert.equal(store.load().drafts.journal, undefined);
  select('guest');
  assert.equal(store.load().drafts.journal, 'Student thought');
  store.clear();
  assert.equal(store.load().drafts.journal, undefined);
  select(null);
  assert.equal(store.load().drafts.journal, 'Guest thought');
  assert.equal(saved.get('sg_diary'), 'separate app data');
});

test('invalid saved data resets safely and a failed write leaves persisted data intact', () => {
  const { store, saved, fill } = browser();
  store.update(state => { state.drafts.sprint = { status: 'paused' }; });
  const [key] = saved.keys();
  saved.set(key, '{invalid');
  assert.deepEqual(snapshot(store.load()), {
    preferences: { interest: '', approach: '', goal: '' }, drafts: {}, activities: []
  });
  fill();
  assert.throws(() => store.update(state => { state.drafts.journal = 'Unsaved'; }), /Storage is full/);
  assert.equal(store.load().drafts.journal, undefined);
});

test('daily prompts rotate at local midnight and cover nine themes', () => {
  const { store } = browser();
  const state = store.load();
  const late = store.daily(state, at(3, 23, 59));
  const next = store.daily(state, at(4, 0));
  assert.equal(late.id, '2026-11-03');
  assert.equal(next.id, '2026-11-04');
  assert.notEqual(late.text, next.text);
  assert.equal(store.daily(state, at(4)).text, next.text);
  const themes = new Set(Array.from({ length: 9 }, (_, index) => store.daily(state, at(4 + index)).category));
  assert.deepEqual([...themes].sort(), [
    'Academic experiences', 'Communication', 'Creativity', 'Critical thinking', 'Decision-making',
    'Emotional awareness', 'Personal ambitions', 'Philosophy', 'Self-confidence'
  ]);
});

test('personalization favors the chosen interest while approach and goal influence the challenge', () => {
  const { store } = browser();
  const state = store.load();
  state.preferences.interest = 'science';
  const categories = Array.from({ length: 9 }, (_, index) => store.daily(state, at(4 + index)).category);
  assert.ok(categories.filter(category => category === 'Critical thinking').length >= 3);
  const before = store.daily(state, at(4));
  state.preferences.approach = 'story';
  const withApproach = store.daily(state, at(4));
  state.preferences.goal = 'reflect';
  assert.notEqual(withApproach.text, before.text);
  assert.notEqual(store.daily(state, at(4)).text, withApproach.text);
});

test('daily difficulty rises on distinct past writing days and preserves completed prompts', () => {
  const { store } = browser();
  const state = store.load();
  const initial = store.daily(state, at(10));
  assert.equal(initial.level, 'Beginner');
  assert.deepEqual([initial.min, initial.max], [2, 3]);
  state.activities.push(...Array.from({ length: 6 }, (_, index) => entry('writing', 2, `repeat-${index}`)));
  assert.equal(store.daily(state, at(10)).level, 'Beginner');
  state.activities.push(entry('writing', 4), entry('writing', 6));
  const intermediate = store.daily(state, at(10));
  assert.equal(intermediate.level, 'Intermediate');
  assert.deepEqual([intermediate.min, intermediate.max], [4, 5]);
  state.activities.push(entry('writing', 7), entry('writing', 8), entry('writing', 9));
  const advanced = store.daily(state, at(10));
  assert.equal(advanced.level, 'Advanced');
  assert.deepEqual([advanced.min, advanced.max], [6, 8]);
  state.activities.push({ ...entry('writing', 10), prompt: advanced });
  state.preferences.interest = 'science';
  assert.deepEqual(snapshot(store.daily(state, at(10))), snapshot(advanced));
});

test('progress uses local calendar days and reserves milestones for real activity', () => {
  const { store } = browser();
  const state = store.load();
  state.drafts.journal = 'An unsaved reflection';
  let progress = store.progress(state, at(10));
  assert.equal(progress.milestones.length, 6);
  assert.equal(progress.milestones.some(milestone => milestone.earned), false);
  assert.deepEqual(snapshot(progress.counts), { writing: 0, focus: 0, journal: 0, recall: 0 });
  state.activities.push(entry('writing', 3), entry('writing', 4), entry('focus', 4), entry('journal', 10), entry('recall', 10));
  progress = store.progress(state, at(10));
  assert.deepEqual(snapshot(progress.counts), { writing: 2, focus: 1, journal: 1, recall: 1 });
  assert.equal(progress.days, 3);
  assert.deepEqual(Array.from(progress.week, day => day.count), [2, 0, 0, 0, 0, 0, 2]);
  assert.deepEqual(Array.from(progress.milestones.filter(milestone => milestone.earned), milestone => milestone.title), ['First Thoughts']);
});

test('encouragement varies with logged activity without treating an empty record as completed effort', () => {
  const { store } = browser();
  const state = store.load();
  const empty = store.encouragement('writing', store.progress(state, at(10)));
  state.activities.push(entry('writing', 4));
  const first = store.encouragement('writing', store.progress(state, at(10)));
  state.activities.push(entry('writing', 8));
  const second = store.encouragement('writing', store.progress(state, at(10)));
  assert.ok(empty.length > 0);
  assert.equal(new Set([empty, first, second]).size, 3);
});
