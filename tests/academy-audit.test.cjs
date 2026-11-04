const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");

function loadScript(name, globals) {
  const context = vm.createContext(globals);
  for (const script of [name].flat()) {
    vm.runInContext(readFileSync(`js/${script}.js`, "utf8"), context);
  }
  return source => vm.runInContext(source, context);
}

function mockDocument() {
  const nodes = new Map();
  return {
    addEventListener() {},
    getElementById(id) {
      if (!nodes.has(id)) {
        nodes.set(id, {
          value: "",
          innerHTML: "",
          style: {},
          focus() {},
          setAttribute() {},
          classList: { add() {}, remove() {} },
          addEventListener() {},
        });
      }
      return nodes.get(id);
    },
  };
}

test("Community rewards read the signed-in account balance without submitting browser achievements", async () => {
  const requests = [];
  const balance = { helpfulAnswers: 2, achievementPoints: 1, reelLikes: 0 };
  const run = loadScript("app", {
    document: { ...mockDocument(), baseURI: "http://localhost/" },
    window: { addEventListener() {} },
    URL,
    AbortSignal,
    fetch: async (url, options) => {
      requests.push([url, options.method ?? "GET", options.body]);
      return { ok: true, status: 200, json: async () => balance };
    },
  });
  assert.equal(await run("loadCommunityRewards()"), null);
  assert.deepEqual(await run("loadCommunityRewards(7)"), balance);
  assert.deepEqual(requests, [["/api/community/rewards?accountId=7", "GET", undefined]]);
});

test("malformed storage falls back safely and valid legacy records remain usable", () => {
  const records = new Map([
    ["sg_student", "{"],
    ["sg_topics", JSON.stringify([null, { id: 42, name: "K-maps", originalSummary: "Source" }])],
    ["sg_scores", "{}"],
    ["sg_diary", '[null,{"text":"A saved entry"}]'],
    ["sg_lessons_done", "true"],
  ]);
  const run = loadScript("storage", { localStorage: { getItem: key => records.get(key) ?? null } });
  assert.equal(run("Storage.isSignedIn()"), false);
  assert.equal(run("Storage.getTopicById(42).sourceText"), "Source");
  assert.deepEqual(JSON.parse(run("JSON.stringify(Storage.getStats())")), {
    topics: 1, quizzesTaken: 0, lessonsCompleted: 0, diaryEntries: 1,
  });
  records.set("sg_student", '{"studentId":"SG-2026-1234","name":123}');
  assert.equal(run("Storage.isSignedIn()"), true);
  assert.equal(run("Storage.getStudentProfile().name"), "");
  assert.equal(run("Storage.getStudentProfile().studentId"), "SG-2026-1234");
});

test("achievement points count each milestone once and survive a reload and study-set deletion", () => {
  const records = new Map([["sg_scores", '[{"correct":1,"total":1}]']]);
  const localStorage = {
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
    removeItem: key => records.delete(key),
  };
  const run = loadScript("storage", { localStorage });
  assert.equal(run("Storage.getLearningProgress().achievementPoints"), 1);
  run(`
    const first = Storage.saveStudySet({ name: "First topic" });
    const second = Storage.saveStudySet({ name: "Second topic" });
    Storage.deleteTopic(first.id);
    Storage.deleteTopic(second.id);
  `);
  const reloaded = loadScript("storage", { localStorage });
  assert.equal(reloaded("Storage.getLearningProgress().achievementPoints"), 2);
  assert.deepEqual(Array.from(reloaded("Storage.getLearningProgress().achievementIds")), ["studySet", "quiz"]);
  assert.equal(reloaded("Storage.linkCommunityAchievements(7)"), true);
  assert.equal(run("Storage.linkCommunityAchievements(8)"), false);
  assert.equal(run("Storage.linkCommunityAchievements(7)"), true);
  reloaded("Storage.clearAll()");
  assert.equal(reloaded("Storage.getLearningProgress().achievementPoints"), 0);
});

test("clearing the diary while analysis is pending discards that response", async () => {
  const document = mockDocument();
  let resolveAnalysis;
  let saves = 0;
  const run = loadScript("diary", {
    document,
    analyzeDiary: () => new Promise(resolve => { resolveAnalysis = resolve; }),
    setBtnLoading: (button, busy) => { button.disabled = busy; },
    Storage: { saveDiaryEntry: () => saves++ },
  });
  document.getElementById("diary-input").value = "Today I learned how to draw a circuit.";
  const pending = run("analyzeEntry()");
  assert.equal(document.getElementById("analyze-btn").disabled, true);
  run("clearEntry()");
  resolveAnalysis({ topics: [], encouragement: "Keep going." });
  await pending;
  assert.equal(saves, 0);
  assert.equal(document.getElementById("ai-result").innerHTML, "");
  assert.equal(document.getElementById("analyze-btn").disabled, false);
});

function mockDiarySpeech(document) {
  let pending;
  const run = loadScript("diary", {
    document,
    window: {
      addEventListener() {},
      SpeechRecognition: class {
        start() {}
        stop() {}
        abort() {}
      },
    },
    showToast() {},
    setTimeout: callback => { pending = callback; },
    clearTimeout: () => { pending = undefined; },
  });
  run("setupVoiceRecognition()");
  return { run, advance: () => pending?.() };
}

test("diary speech preserves typed text and ignores results from stopped recognizers", () => {
  const document = mockDocument();
  const { run, advance } = mockDiarySpeech(document);
  const input = document.getElementById("diary-input");
  input.value = "Typed draft.";
  run(`startVoice(); const oldRecognition = recognition;
    recognition.onresult({ results: [{ 0: { transcript: "First recording." }, isFinal: true }] });
  `);
  assert.equal(input.value, "Typed draft. First recording.");
  run(`clearEntry();
    oldRecognition.onresult({ results: [{ 0: { transcript: "Late words." }, isFinal: true }] });
  `);
  assert.equal(input.value, "");
  run(`startVoice();
    oldRecognition.onresult({ results: [{ 0: { transcript: "Stale words." }, isFinal: true }] });
  `);
  assert.equal(input.value, "");
  run(`
    recognition.onresult({ results: [{ 0: { transcript: "New recording." }, isFinal: true }] });
    recognition.onend();
  `);
  advance();
  run(`
    recognition.onresult({ results: [{ 0: { transcript: "Continued." }, isFinal: true }] });
  `);
  assert.equal(input.value, "New recording. Continued.");
});

test("diary dictation retries silence and finishes the current phrase on Stop", () => {
  const document = mockDocument();
  const { run, advance } = mockDiarySpeech(document);
  run(`startVoice(); const silentRecognition = recognition;
    recognition.onerror({ error: "no-speech" });
    silentRecognition.onend();
  `);
  assert.equal(run("isRecording"), true);
  advance();
  run(`recognition.onresult({ results: [{ 0: { transcript: "Studied frac" }, isFinal: false }] });
    toggleVoice();
    recognition.onresult({ results: [{ 0: { transcript: "Studied fractions." }, isFinal: true }] });
    recognition.onend();
  `);
  assert.equal(document.getElementById("diary-input").value, "Studied fractions.");
  assert.equal(run("isRecording"), false);
});

test("a diary draft is only saved after approval and uses the student's edits", async () => {
  const document = mockDocument();
  const saved = [];
  const run = loadScript("diary", {
    document,
    draftDiary: async () => ({ draft: "I found fractions tricky today." }),
    Storage: { saveDiaryEntry: entry => saved.push(entry.text), getDiaryEntries: () => [] },
    showToast() {},
  });
  document.getElementById("diary-input").value = "fractions tricky";
  await run("draftEntry()");
  assert.equal(document.getElementById("draft-review").hidden, false);
  const draft = document.getElementById("diary-draft");
  assert.equal(draft.value, "I found fractions tricky today.");
  assert.deepEqual(saved, []);
  draft.value = "I found adding fractions tricky today.";
  await run("Promise.all([approveDraft(), approveDraft()]);");
  assert.deepEqual(saved, ["I found adding fractions tricky today."]);
  assert.equal(document.getElementById("draft-review").hidden, true);
});

test("clearing pending diary notes prevents a late draft from opening", async () => {
  const document = mockDocument();
  let finishDraft;
  const run = loadScript("diary", {
    document,
    draftDiary: () => new Promise(resolve => { finishDraft = resolve; }),
    showToast() {},
  });
  document.getElementById("diary-input").value = "circuits";
  const pending = run("draftEntry()");
  run("clearEntry()");
  finishDraft({ draft: "I studied circuits today." });
  await pending;
  assert.equal(document.getElementById("draft-review").hidden, true);
  assert.equal(document.getElementById("diary-draft").value, "");
  assert.equal(document.getElementById("draft-btn").disabled, false);
});

test("quiz progress counts answers and results still show when saving fails", () => {
  const document = mockDocument();
  const run = loadScript(["quiz-order", "quiz"], {
    document,
    escapeHTML: String,
    showToast() {},
    Storage: { saveQuizScore() { throw new Error("Quota exceeded"); } },
  });
  run(`topicData = { id: 42, name: "K-maps" };
    questions = [{ question: "First question", options: ["Yes", "No"], correctIndex: 0, difficulty: "easy" }];
    renderQuestion(0);
  `);
  assert.equal(document.getElementById("quiz-progress").style.width, "0%");
  run("selectAnswer(0, 0)");
  assert.equal(document.getElementById("quiz-progress").style.width, "100%");
  assert.equal(document.getElementById("quiz-score").textContent, "Score: 1/1");
  run("showResults()");
  assert.match(document.getElementById("quiz-content").innerHTML, /100% — Excellent!/);
});

test("a quiz spreads saved A answers across all four letters and grades their new positions", async () => {
  const document = mockDocument();
  const feedback = [];
  const saved = Array.from({ length: 8 }, (_, index) => ({
    question: `Question ${index + 1}`, concept: "edges", difficulty: "easy",
    options: [`Correct ${index + 1}`, "Wrong one", "Wrong two", "Wrong three"],
    correctIndex: 0, explanation: "Study the example.",
  }));
  const run = loadScript(["quiz-order", "quiz"], {
    document,
    loadStudyContent: async () => ({ questions: saved }),
    setExploreReturnLink() {},
    showToast: message => feedback.push(message),
    Storage: { saveQuizScore() {} },
  });
  await run('startQuiz({ id: 42, name: "K-maps" })');
  const correctPositions = [];
  for (let index = 0; index < saved.length; index += 1) {
    const current = run("currentQ");
    const position = run("questions[currentQ].correctIndex");
    assert.equal(run("questions[currentQ].options[questions[currentQ].correctIndex]"), saved[current].options[0]);
    correctPositions.push(position);
    run(`selectAnswer(currentQ, ${position}); advanceQuiz();`);
  }
  assert.deepEqual(correctPositions.sort(), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(run("score"), saved.length);
  assert.ok(saved.every(question => question.correctIndex === 0 && question.options[0].startsWith("Correct")));

  await run("startQuiz(topicData)");
  const position = run("questions[currentQ].correctIndex");
  run(`selectAnswer(currentQ, ${(position + 1) % 4})`);
  assert.equal(run("score"), 0);
  assert.equal(feedback.at(-1), `Answer: ${"ABCD"[position]}`);
});

test("a saved quiz falls back to easy for invalid difficulty labels", () => {
  const document = mockDocument();
  const run = loadScript(["quiz-order", "quiz"], { document });
  run(`questions = [
    { question: "First", options: ["Yes", "No"], difficulty: 12, concept: "first" },
    { question: "Retry", options: ["Yes", "No"], difficulty: "EASY", concept: "first" },
    { question: "Advanced", options: ["Yes", "No"], difficulty: "hard", concept: "next" },
  ];
  renderQuestion(0);`);
  assert.match(document.getElementById("quiz-content").innerHTML, /difficulty-badge diff-easy/);
  assert.equal(run("nextQuizIndex(questions, new Map([[0, false]]), 0, false)"), 1);
});

test("a ready MP4 preserves an open storyboard until the student plays the video", async () => {
  const document = mockDocument();
  const video = document.getElementById("reel-video");
  let pauses = 0;
  Object.assign(video, { hasAttribute: () => false, pause: () => pauses++ });
  document.getElementById("reel-download").removeAttribute = () => {};
  const preview = document.getElementById("reel-preview");
  let togglePreview;
  const attributes = new Map();
  Object.assign(preview, {
    addEventListener: (_, listener) => { togglePreview = listener; },
    getAttribute: key => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
  });
  let finishRender;
  const shown = [];
  const run = loadScript("reel-video", {
    document, AbortController,
    fetch: () => new Promise(resolve => { finishRender = resolve; }),
    setPreview: visible => shown.push(visible),
  });
  run('ReelVideo.open({name:"K-maps"}, {scenes:[]}, setPreview)');
  togglePreview();
  finishRender({ ok: true, json: async () => ({ stage: "ready", id: "sample", videoUrl: "/video", downloadUrl: "/download" }) });
  await new Promise(setImmediate);
  assert.deepEqual(shown, [false, true]);
  assert.equal(video.hidden, false);
  video.onplay();
  assert.deepEqual(shown, [false, true, false]);
  assert.equal(pauses, 0);
});

test("study-note uploads reject mislabeled binary files and accept ordinary text", async () => {
  const document = mockDocument();
  const notes = document.getElementById("study-notes");
  const status = document.getElementById("study-status");
  const picker = document.getElementById("study-file");
  let change;
  notes.maxLength = 20000;
  picker.addEventListener = (event, listener) => { if (event === "change") change = listener; };
  loadScript("study", {
    document, URLSearchParams, TextDecoder,
    window: { location: { search: "" } },
    Storage: { getTopicById: () => null },
    StudygramPrivateSession: { start: setup => setup() },
  });
  picker.files = [new File(["Not a PDF"], "notes.pdf")];
  await change();
  assert.match(status.textContent, /doesn’t look like a PDF/);
  picker.files = [new File([new Uint8Array([65, 0, 66])], "notes.txt")];
  await change();
  assert.match(status.textContent, /doesn’t look like plain text/);
  assert.equal(notes.value, "");
  picker.files = [new File(["A note about this lesson."], "notes.txt")];
  await change();
  assert.equal(notes.value, "A note about this lesson.");
});

test("finishing storyboard playback records the lesson even when its MP4 is unavailable", () => {
  const document = mockDocument();
  const completed = [];
  let finishScene;
  const run = loadScript("lesson", {
    document,
    window: {},
    clearTimeout() {},
    setTimeout: callback => { finishScene = callback; },
    Storage: { markLessonComplete: topicId => completed.push(topicId) },
  });
  run('topicData = {id:42}; slides = [{duration:1}]; playReel()');
  assert.deepEqual(completed, []);
  finishScene();
  assert.deepEqual(completed, [42]);
  assert.equal(document.getElementById("reel-play").textContent, "Play");
});
