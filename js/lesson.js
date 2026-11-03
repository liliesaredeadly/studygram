// ============================================================
// lesson.js — Reel-style lesson engine
// ============================================================

let slides = [];
let currentSlide = 0;     // Which slide are we on? (0-indexed)
let topicData = null;
let reelTimer;
let playing = false;
let narrationEnabled = false;
let sceneTimeRemaining = 0;
let sceneStartedAt = 0;

// ---- Entry Point ----
// Runs when the page fully loads
document.addEventListener("DOMContentLoaded", () => {
  // Check if a topicId was passed in the URL (e.g. lesson.html?topicId=123)
  const params = new URLSearchParams(window.location.search);
  const topicId = params.get("topicId");

  const name = params.get("topic");
  if (!topicId && name) {
    startLesson({ name, sourceText: "" });
    return;
  }

  if (topicId) {
    // Try to find this topic in storage
    const topic = Storage.getTopicById(topicId);
    if (topic) {
      startLesson(topic);
    } else {
      showTopicPicker(); // Topic not found, show picker
    }
  } else {
    showTopicPicker(); // No ID given, let user choose
  }
});

// ---- Show Topic Picker ----
// Lets the user choose from saved topics or enter a custom one
function showTopicPicker() {
  document.getElementById("lesson-header").style.display = "none";
  document.getElementById("slide-dots").style.display = "none";

  const savedTopics = Storage.getTopics();
  const content = document.getElementById("lesson-content");

  content.innerHTML = `
    <div class="topic-picker animate-slide-up">
      <div style="font-size:2.5rem; margin-bottom:16px; animation: float 2s ease-in-out infinite; display:block;">📖</div>
      <h1 style="font-size:1.5rem; margin-bottom:8px;">What do you want to learn?</h1>
      <p style="color:var(--text-secondary); font-size:0.9rem; margin-bottom:28px;">
        Open a saved reel or start with a topic and your notes.
      </p>

      ${savedTopics.length > 0 ? `
        <div style="margin-bottom:24px; text-align:left;">
          <p class="form-label" style="text-align:center; margin-bottom:12px;">📌 My Study Sets</p>
          <div class="topic-chips" style="justify-content:center;">
            ${savedTopics.map(t => `
              <a class="topic-chip" href="lesson.html?topicId=${t.id}">${escapeHTML(t.name)}</a>
            `).join("")}
          </div>
        </div>
        <div class="divider" style="margin:20px 0;"></div>
      ` : ""}

      <a class="btn btn-primary" href="study.html">＋ New Study Set</a>
    </div>
  `;
}

// ---- Start Lesson ----
async function startLesson(topic) {
  pauseReel();
  slides = [];
  topicData = topic;
  currentSlide = 0;

  // Show header
  const header = document.getElementById("lesson-header");
  header.style.display = "block";
  document.getElementById("lesson-topic-name").textContent = topic.name;

  // Show loading state
  const content = document.getElementById("lesson-content");
  content.innerHTML = `
    <div class="loading-overlay" style="min-height:320px; border-radius:var(--radius-xl); border:1px solid var(--border); background:var(--bg-card);">
      <div class="spinner"></div>
      <p>AI is creating your lesson on <strong>${escapeHTML(topic.name)}</strong>…</p>
      <p style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">Putting together the scenes and quiz</p>
    </div>`;

  try {
    const { scenes } = await loadStudyContent(topic);
    if (topicData !== topic) return;
    slides = scenes;
    if (!Array.isArray(slides) || slides.length === 0) throw new Error("No slides generated");

    renderDots();
    renderSlide(0);

  } catch (err) {
    if (topicData === topic) handleAPIError(err, content, () => startLesson(topic));
  }
}

// ---- Reel player ----
function renderSlide(index) {
  const scene = slides[index];
  if (!scene) return;
  currentSlide = index;
  sceneTimeRemaining = scene.duration * 1000;
  const total = slides.length;
  document.getElementById("slide-number-label").textContent = `SCENE ${index + 1} OF ${total}`;
  document.getElementById("lesson-progress").style.width = `${((index + 1) / total) * 100}%`;
  updateDots(index);

  const visual = scene.visual === "grid" ? "grid" : scene.visual === "steps" ? "steps" : "highlight";
  document.getElementById("lesson-content").innerHTML = `
    <article class="slide-card reel-card" aria-label="Study reel">
      <div class="reel-frame">
        <span class="hero-badge">Scene ${index + 1} / ${total}</span>
        <h2 class="slide-title">${escapeHTML(scene.title)}</h2>
        <div class="reel-visual reel-visual-${visual}">
          ${scene.items.map((item, itemIndex) =>
            `<span class="${scene.highlighted.includes(itemIndex) ? "reel-highlighted" : ""}">${escapeHTML(item)}</span>`
          ).join("")}
        </div>
        <p class="reel-caption">${escapeHTML(scene.caption)}</p>
      </div>
      <div class="reel-controls">
        <button class="btn btn-ghost btn-sm" onclick="goToSlide(${index - 1})" ${index === 0 ? "disabled" : ""}>Previous</button>
        <button class="btn btn-primary btn-sm" id="reel-play" onclick="toggleReel()">Play</button>
        ${index === total - 1
          ? '<button class="btn btn-ghost btn-sm" onclick="finishLesson()">Take Quiz</button>'
          : `<button class="btn btn-ghost btn-sm" onclick="goToSlide(${index + 1})">Next</button>`}
        ${window.speechSynthesis
          ? `<button class="btn btn-ghost btn-sm" id="reel-narration" aria-pressed="${narrationEnabled}" onclick="toggleNarration()">Narration</button>`
          : ""}
      </div>
    </article>`;
}

function playReel() {
  if (!slides[currentSlide] || playing) return;
  playing = true;
  sceneStartedAt = Date.now();
  document.getElementById("reel-play").textContent = "Pause";
  if (narrationEnabled) speakScene();

  reelTimer = setTimeout(() => {
    if (currentSlide === slides.length - 1) {
      finishLesson();
    } else {
      goToSlide(currentSlide + 1);
    }
  }, sceneTimeRemaining);
}

function pauseReel() {
  clearTimeout(reelTimer);
  if (playing) sceneTimeRemaining = Math.max(0, sceneTimeRemaining - (Date.now() - sceneStartedAt));
  playing = false;
  window.speechSynthesis?.cancel();
  const button = document.getElementById("reel-play");
  if (button) button.textContent = "Play";
}

function toggleReel() {
  if (playing) pauseReel();
  else playReel();
}

function speakScene() {
  const utterance = new SpeechSynthesisUtterance(slides[currentSlide].narration);
  utterance.lang = "en-IN";
  window.speechSynthesis.speak(utterance);
}

function toggleNarration() {
  narrationEnabled = !narrationEnabled;
  document.getElementById("reel-narration").setAttribute("aria-pressed", String(narrationEnabled));
  window.speechSynthesis.cancel();
  if (narrationEnabled && playing) speakScene();
}

function goToSlide(index) {
  if (index < 0 || index >= slides.length) return;
  const continuePlaying = playing;
  pauseReel();
  renderSlide(index);
  if (continuePlaying) playReel();
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden && playing) pauseReel();
});

// ---- Dot Indicators ----
function renderDots() {
  const dotsEl = document.getElementById("slide-dots");
  dotsEl.style.display = "flex";
  dotsEl.innerHTML = slides.map((_, i) =>
    `<button type="button" class="dot ${i === 0 ? "active" : ""}" onclick="goToSlide(${i})" aria-label="Scene ${i + 1}"></button>`
  ).join("");
}

function updateDots(activeIndex) {
  document.querySelectorAll(".dot").forEach((d, i) => {
    d.classList.toggle("active", i === activeIndex);
  });
}

// ---- Keyboard Navigation ----
document.addEventListener("keydown", (e) => {
  if (slides.length === 0 || !document.getElementById("reel-play") || e.target.closest("button, input, textarea, a")) return;
  if (e.key === "ArrowRight") goToSlide(currentSlide + 1);
  if (e.key === "ArrowLeft") goToSlide(currentSlide - 1);
});

// ---- Finish Lesson ----
function finishLesson() {
  pauseReel();
  // Mark lesson as done
  if (topicData?.id) Storage.markLessonComplete(topicData.id);

  // Show completion screen
  document.getElementById("slide-dots").style.display = "none";
  document.getElementById("lesson-header").style.display = "none";
  document.getElementById("lesson-content").innerHTML = `
    <div class="card completion-card animate-slide-up">
      <span class="trophy">🏆</span>
      <h2 style="font-size:1.6rem; margin-bottom:8px;">Lesson Complete!</h2>
      <p style="color:var(--text-secondary); margin-bottom:28px;">
        You finished <strong>${escapeHTML(topicData?.name || "the lesson")}</strong>.<br/>
        Ready to test yourself?
      </p>
      <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
        ${topicData?.id
          ? `<a href="quiz.html?topicId=${topicData.id}" class="btn btn-primary btn-lg">🧠 Take Quiz →</a>`
          : `<a href="quiz.html?topic=${encodeURIComponent(topicData?.name || "")}" class="btn btn-primary btn-lg">🧠 Take Quiz →</a>`
        }
        <button class="btn btn-ghost btn-lg" onclick="startLesson(topicData)">↻ Replay Reel</button>
        <a class="btn btn-ghost btn-lg" href="study.html">＋ New Study Set</a>
      </div>
    </div>`;
}

function resetLesson() {
  pauseReel();
  slides = [];
  topicData = null;
  showTopicPicker();
}

function escapeHTML(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
