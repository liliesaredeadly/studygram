const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function load(...files) {
  const context = vm.createContext({});
  for (const file of files) vm.runInContext(readFileSync(`js/${file}.js`, "utf8"), context);
  return context;
}

test("Focus Sprint restores the exact paused time and expires from the resumed deadline", () => {
  const { restoreFocusTimer, updateFocusTimer, focusTimeLeft } = load("focus-timer");
  const now = 1000;
  const initial = restoreFocusTimer(null, now);
  assert.equal(focusTimeLeft(initial, now), 600000);
  const selected = updateFocusTimer(initial, { type: "select", minutes: 5 }, now);
  const running = updateFocusTimer(selected, { type: "start" }, now);
  assert.equal(running.endsAt, now + 300000);
  assert.equal(updateFocusTimer(running, { type: "tick" }, now + 60000), running);
  assert.equal(updateFocusTimer(running, { type: "select", minutes: 25 }, now), running);
  const paused = updateFocusTimer(running, { type: "pause" }, now + 60000);
  const restored = restoreFocusTimer(JSON.parse(JSON.stringify(paused)), 1000000);
  assert.equal(restored.status, "paused");
  assert.equal(focusTimeLeft(restored, 1000000), 240000);
  const resumed = updateFocusTimer(restored, { type: "resume" }, 1000000);
  const finished = updateFocusTimer(resumed, { type: "tick" }, 1240100);
  assert.equal(finished.status, "finished");
  assert.equal(focusTimeLeft(finished, 1240100), 0);
  assert.equal(focusTimeLeft(updateFocusTimer(finished, { type: "reset" }, 1240100), 1240100), 300000);
});

test("Focus Sprint recovers from damaged state and settles an expired reload", () => {
  const { restoreFocusTimer } = load("focus-timer");
  for (const saved of [
    "bad JSON",
    { status: "idle", durationMs: 12 },
    { status: "paused", durationMs: 300000, remainingMs: -100, endsAt: null },
    { status: "running", durationMs: 300000, remainingMs: 300000, endsAt: Infinity },
    { status: "running", durationMs: 300000, remainingMs: 300000, endsAt: Number.MAX_SAFE_INTEGER }
  ]) {
    const result = restoreFocusTimer(saved, 400000);
    assert.equal(result.status, "idle");
    assert.equal(result.durationMs, 600000);
  }
  const expired = restoreFocusTimer(
    { status: "running", durationMs: 300000, remainingMs: 300000, endsAt: 350000 }, 400000
  );
  assert.equal(expired.status, "finished");
  assert.equal(expired.remainingMs, 0);
});

const card = concept => ({
  concept, question: "Question?", explanation: "Explanation.",
  options: ["A", "B", "C", "D"], correctIndex: 2
});

test("Quick Play chooses distinct playable concepts before filling extra slots", () => {
  const { selectFocusQuestions } = load("focus-game");
  const [a, duplicate, b, c] = ["a", "a", "b", "c"].map(card);
  assert.deepEqual(Array.from(selectFocusQuestions([a, duplicate, b, c])), [a, b, c]);
  assert.deepEqual(Array.from(selectFocusQuestions([a, duplicate, b])), [a, b, duplicate]);
  const invalid = [null, { ...b, explanation: " " }, { ...b, correctIndex: 4 }, { ...b, options: ["", "B", "C", "D"] }];
  assert.deepEqual(Array.from(selectFocusQuestions([...invalid, a])), [a]);
});

test("Quick Play uses the real sample unless a linked topic is playable", () => {
  const context = load("sample-study", "focus-game");
  const sample = vm.runInContext("KMAP_SAMPLE", context);
  const { resolveFocusSources } = context;
  const topics = [null, { id: 42, name: "Legacy" }, { id: 43, name: "Saved", content: { questions: [card("a")] } }];
  const missing = resolveFocusSources(topics, "999", sample);
  assert.equal(missing.lessonTopicId, null);
  assert.equal(missing.selectedSourceId, "sample");
  assert.equal(missing.sources.find(source => source.id === "sample").questions.length, 3);
  assert.equal(missing.sources.some(source => source.id === 42), false);
  const legacy = resolveFocusSources(topics, "42", sample);
  assert.equal(legacy.lessonTopicId, 42);
  assert.equal(legacy.selectedSourceId, "sample");
  assert.equal(resolveFocusSources(topics, "43", sample).selectedSourceId, 43);
  assert.equal(resolveFocusSources({}, "43", sample).sources.length, 1);
});

test("Quick Play accepts only the first valid answer for the active card", () => {
  const { answerFocusCard } = load("focus-game");
  const round = { questions: [card("a"), card("b")], index: 1, answers: [0] };
  assert.equal(answerFocusCard(round, 4), round);
  assert.equal(answerFocusCard(round, "2"), round);
  const answered = answerFocusCard(round, 2);
  assert.equal(answered.index, 1);
  assert.deepEqual(Array.from(answered.answers), [0, 2]);
  assert.deepEqual(round.answers, [0]);
  assert.equal(answerFocusCard(answered, 3), answered);
});
