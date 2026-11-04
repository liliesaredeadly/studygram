// ============================================================
// quiz.js — Adaptive MCQ quiz engine
// ============================================================

let questions = [];
let attempts = new Map();
let currentQ = 0;     // Current question index (0-8)
let score = 0;        // How many correct so far
let answered = false; // Has the user answered the current question?
let topicData = null; // Topic object

const LETTERS = ["A", "B", "C", "D"];

// ---- Entry Point ----
document.addEventListener("DOMContentLoaded", async () => {
  if (typeof StudygramPrivateSession !== "undefined") {
    await StudygramPrivateSession.ready;
    if (!StudygramPrivateSession.user()) return;
  }
  document.getElementById("quiz-reset").addEventListener("click", resetQuiz);
  const params  = new URLSearchParams(window.location.search);
  const topicId = params.get("topicId");
  const topicName = params.get("topic"); // Custom topic (no ID)

  if (topicId) {
    const topic = Storage.getTopicById(topicId);
    if (topic) { startQuiz(topic); return; }
  }
  if (topicName) {
    startQuiz({ name: topicName, sourceText: "" });
    return;
  }
  showTopicPicker();
});

// ---- Topic Picker ----
function showTopicPicker() {
  document.getElementById("quiz-header").style.display = "none";
  const savedTopics = Storage.getTopics();
  const content = document.getElementById("quiz-content");

  content.innerHTML = `
    <div class="topic-picker animate-slide-up" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-xl);padding:36px;text-align:center;">
      <div style="font-size:2.5rem;margin-bottom:16px;display:block;animation:float 2s ease-in-out infinite;">🧠</div>
      <h1 style="font-size:1.5rem;margin-bottom:8px;">Pick a Quiz Topic</h1>
      <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:28px;">
        Start easy and get feedback as you go. Wrong answers guide your next practice question.
      </p>

      ${savedTopics.length > 0 ? `
        <div style="margin-bottom:24px;text-align:left;">
          <p class="form-label" style="text-align:center;margin-bottom:12px;">📌 Your Topics</p>
          <div class="topic-chips" style="justify-content:center;">
            ${savedTopics.map(t => `
              <a class="topic-chip" href="quiz.html?topicId=${encodeURIComponent(t.id)}">${escapeHTML(t.name)}</a>
            `).join("")}
          </div>
        </div>
        <div class="divider" style="margin:20px 0;"></div>
      ` : ""}

      <p class="form-label" style="text-align:center;margin-bottom:12px;">✍️ Or type any topic</p>
      <form id="quiz-topic-form" style="display:flex;gap:10px;max-width:420px;margin:0 auto;">
        <input
          class="form-input"
          type="text"
          id="custom-q-input"
          placeholder="e.g., The French Revolution..."
          style="flex:1;"
          aria-label="Quiz topic"
          maxlength="120"
          required
        />
        <button class="btn btn-primary" type="submit">Start</button>
      </form>
    </div>`;
  document.getElementById("quiz-topic-form").addEventListener("submit", event => {
    event.preventDefault();
    startCustomQuiz();
  });
}

function startCustomQuiz() {
  const val = document.getElementById("custom-q-input")?.value?.trim();
  if (!val) { showToast("Please enter a topic", "warning"); return; }
  startQuiz({ name: val, sourceText: "" });
}

// ---- Start Quiz ----
async function startQuiz(topic) {
  topicData = topic;
  attempts = new Map();
  questions = [];
  currentQ = 0;
  score = 0;
  answered = false;

  // Show header
  document.getElementById("quiz-header").style.display = "block";
  document.getElementById("quiz-topic-name").textContent = topic.name;
  document.getElementById("q-label").textContent = "PREPARING QUIZ";
  setExploreReturnLink("quiz-explore-link", topic.exploreCategory);
  updateProgress(0);

  const content = document.getElementById("quiz-content");
  content.innerHTML = `
    <div class="loading-overlay" style="min-height:280px;border-radius:var(--radius-xl);border:1px solid var(--border);background:var(--bg-card);">
      <div class="spinner"></div>
      <p>Preparing your questions on <strong>${escapeHTML(topic.name)}</strong>…</p>
      <p style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">Using the same material as your reel</p>
    </div>`;

  try {
    const result = await loadStudyContent(topic);
    if (topicData !== topic) return;
    if (!Array.isArray(result.questions) || result.questions.length === 0) throw new Error("No questions generated");
    questions = mixQuizOptions(result.questions);
    renderQuestion(nextQuizIndex(questions, attempts));
  } catch (err) {
    if (topicData === topic) handleAPIError(err, content, () => startQuiz(topic));
  }
}

// ---- Render Question ----
function renderQuestion(index) {
  if (!questions[index]) return;
  const q = questions[index];
  answered = false;
  currentQ = index;

  updateProgress(attempts.size);

  const diff = quizDifficulty(q);
  const diffIcon = { easy: "🟢", medium: "🟡", hard: "🔴" }[diff];
  const diffClass = `diff-${diff}`;
  const total = questions.length;

  document.getElementById("q-label").textContent = `QUESTION ${attempts.size + 1} OF ${total}`;

  document.getElementById("quiz-content").innerHTML = `
    <div class="quiz-card animate-slide-up">

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span class="difficulty-badge ${diffClass}">${diffIcon} ${diff.toUpperCase()}</span>
        <span id="quiz-score" style="font-size:0.85rem;color:var(--text-muted);">Score: ${score}/${attempts.size}</span>
      </div>

      <p class="question-text">${escapeHTML(q.question)}</p>

      <div class="options-list" id="options-${index}">
        ${q.options.map((opt, i) => `
          <button
            class="quiz-option"
            id="opt-${index}-${i}"
          >
            <span class="option-letter">${LETTERS[i]}</span>
            ${escapeHTML(opt)}
          </button>
        `).join("")}
      </div>

      <div id="explanation-box"></div>

      <div style="display:flex;justify-content:flex-end;margin-top:20px;">
        <button
          class="btn btn-primary"
          id="next-btn"
          style="display:none;"
        >
          ${attempts.size < total - 1 ? "Next Question →" : "🏁 See Results"}
        </button>
      </div>

    </div>`;
  q.options.forEach((_, i) => {
    document.getElementById(`opt-${index}-${i}`).addEventListener("click", () => selectAnswer(index, i));
  });
  document.getElementById("next-btn").addEventListener("click", advanceQuiz);
}

// ---- Handle Answer Selection ----
function selectAnswer(qIndex, selectedIdx) {
  if (answered) return; // Already answered, ignore re-clicks
  answered = true;

  const q = questions[qIndex];
  const isCorrect = selectedIdx === q.correctIndex;
  attempts.set(qIndex, isCorrect);
  updateProgress(attempts.size);
  if (isCorrect) score++;
  document.getElementById("quiz-score").textContent = `Score: ${score}/${attempts.size}`;

  // Style all options
  q.options.forEach((_, i) => {
    const btn = document.getElementById(`opt-${qIndex}-${i}`);
    if (!btn) return;
    btn.disabled = true;
    if (i === q.correctIndex) btn.classList.add("correct");
    else if (i === selectedIdx && !isCorrect) btn.classList.add("wrong");
  });

  // Show explanation
  const expBox = document.getElementById("explanation-box");
  expBox.innerHTML = `
    <div class="explanation-box">
      <strong>${isCorrect ? "✅ Correct!" : "❌ Not quite."}</strong>
      ${escapeHTML(q.explanation)}
    </div>`;

  // Show next button
  document.getElementById("next-btn").style.display = "flex";

  // Toast feedback
  showToast(isCorrect ? "Correct! 🎉" : `Answer: ${LETTERS[q.correctIndex]}`, isCorrect ? "success" : "error", 2000);
}

function advanceQuiz() {
  if (!answered) return;
  const index = nextQuizIndex(questions, attempts, currentQ, attempts.get(currentQ));
  if (index < 0) showResults();
  else renderQuestion(index);
}

// ---- Update Progress Bar ----
function updateProgress(completed) {
  const pct = questions.length ? (completed / questions.length) * 100 : 0;
  const bar = document.getElementById("quiz-progress");
  if (bar) bar.style.width = pct + "%";
}

// ---- Show Results Screen ----
function showResults() {
  document.getElementById("quiz-header").style.display = "none";

  const total = questions.length;
  const pct = Math.round((score / total) * 100);


  let medal = "🥉", msg = "Keep practicing — every attempt makes you better!";
  if (pct >= 90) { medal = "🥇"; msg = "Outstanding! You've mastered this topic. 🌟"; }
  else if (pct >= 70) { medal = "🥈"; msg = "Great job! A little more practice and you'll nail it."; }
  else if (pct >= 50) { medal = "🥉"; msg = "Good effort! Review the explanations and try again."; }

  // Save score
  if (topicData?.id) {
    try {
      Storage.saveQuizScore({
        topicId: topicData.id,
        topicName: topicData.name,
        correct: score,
        total,
        percentage: pct
      });
    } catch {
      showToast("Your score couldn’t be saved on this device.", "warning");
    }
  }

  document.getElementById("quiz-content").innerHTML = `
    <div class="card completion-card animate-slide-up" style="padding:44px 32px;">
      <div style="font-size:3.5rem;margin-bottom:8px;animation:float 2s ease-in-out infinite;">${medal}</div>
      <h2 style="font-size:1.6rem;margin-bottom:6px;">${pct}% — ${getGrade(pct)}</h2>
      <p style="color:var(--text-secondary);margin-bottom:24px;">${msg}</p>

      <!-- Score ring -->
      <div class="score-ring" style="--score-pct:${pct * 3.6}deg; margin-bottom:28px;">
        <span class="score-value">${score}<span style="font-size:1rem;font-weight:400;color:var(--text-muted);">/${total}</span></span>
      </div>

      <div class="result-grid">
        ${QUIZ_LEVELS.map(level => {
          const entries = [...attempts].filter(([index]) => quizDifficulty(questions[index]) === level);
          const correct = entries.filter(([, isCorrect]) => isCorrect).length;
          return `<div class="result-stat"><span class="val">${correct}/${entries.length}</span><span class="lbl">${level}</span></div>`;
        }).join("")}
      </div>

      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:8px;">
        <button class="btn btn-primary btn-lg" id="quiz-retry" type="button">🔄 Try Again</button>
        <button class="btn btn-ghost btn-lg" id="quiz-new-topic" type="button">📚 New Topic</button>
        ${topicData?.id
          ? `<a href="lesson.html?topicId=${encodeURIComponent(topicData.id)}" class="btn btn-ghost btn-lg">▶ Review Lesson</a>`
          : `<a href="lesson.html" class="btn btn-ghost btn-lg">▶ New Lesson</a>`
        }
      </div>
    </div>`;
  document.getElementById("quiz-retry").addEventListener("click", () => startQuiz(topicData));
  document.getElementById("quiz-new-topic").addEventListener("click", resetQuiz);
}

function getGrade(pct) {
  if (pct >= 90) return "Excellent!";
  if (pct >= 75) return "Good";
  if (pct >= 50) return "Needs Practice";
  return "Keep Trying";
}

// ---- Reset ----
function resetQuiz() {
  questions = [];
  currentQ = 0;
  score = 0;
  answered = false;
  topicData = null;
  showTopicPicker();
}

// ---- Utility ----
function escapeHTML(str = "") {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
