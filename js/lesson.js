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
document.addEventListener("DOMContentLoaded", async () => {
  if (typeof StudygramPrivateSession !== "undefined") {
    await StudygramPrivateSession.ready;
    if (!StudygramPrivateSession.user()) return;
  }
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
  content.hidden = false;

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
              <a class="topic-chip" href="lesson.html?topicId=${encodeURIComponent(t.id)}">${escapeHTML(t.name)}</a>
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
  ReelVideo.clear();
  pauseReel();
  slides = [];
  topicData = topic;
  currentSlide = 0;

  // Show header
  const header = document.getElementById("lesson-header");
  header.style.display = "block";
  document.getElementById("lesson-topic-name").textContent = topic.name;
  setExploreReturnLink("lesson-explore-link", topic.exploreCategory);
  const focusLink = document.getElementById("lesson-focus-link");
  const growthLink = document.getElementById("lesson-growth-link");
  growthLink.hidden = true;
  const focusHref = () => topic.id ? `focus.html?topicId=${encodeURIComponent(topic.id)}` : "focus.html";
  focusLink.href = focusHref();

  // Show loading state
  const content = document.getElementById("lesson-content");
  content.hidden = false;
  content.innerHTML = `
    <div class="loading-overlay" style="min-height:320px; border-radius:var(--radius-xl); border:1px solid var(--border); background:var(--bg-card);">
      <div class="spinner"></div>
      <p>AI is creating your lesson on <strong>${escapeHTML(topic.name)}</strong>…</p>
      <p style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">Putting together the scenes and quiz</p>
    </div>`;

  try {
    const studyContent = await loadStudyContent(topic);
    if (topicData !== topic) return;
    focusLink.href = focusHref();
    slides = studyContent.scenes;
    if (!Array.isArray(slides) || slides.length === 0) throw new Error("No slides generated");
    if (topic.id) {
      growthLink.href = `growth.html?topicId=${encodeURIComponent(topic.id)}#growth-recall`;
      growthLink.hidden = false;
    }

    renderDots();
    renderSlide(0);
    ReelVideo.open(topic, studyContent, setLessonPreview);

  } catch (err) {
    if (topicData === topic) handleAPIError(err, content, () => startLesson(topic));
  }
}

function setLessonPreview(visible) {
  if (!visible) pauseReel();
  document.getElementById("lesson-content").hidden = !visible;
  document.getElementById("slide-dots").style.display = visible ? "flex" : "none";
  document.getElementById("lesson-scene-progress").hidden = !visible;
  document.getElementById("slide-number-label").hidden = !visible;
}

function recordLessonCompletion(topic) {
  if (!topic?.id) return;
  try {
    Storage.markLessonComplete(topic.id);
  } catch {
    showToast("Your lesson progress couldn’t be saved on this device.", "warning");
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
        <button class="btn btn-ghost btn-sm" id="reel-previous" ${index === 0 ? "disabled" : ""}>Previous</button>
        <button class="btn btn-primary btn-sm" id="reel-play">Play</button>
        ${index === total - 1
          ? '<button class="btn btn-ghost btn-sm" id="reel-close-preview">Close preview</button>'
          : '<button class="btn btn-ghost btn-sm" id="reel-next">Next</button>'}
        ${window.speechSynthesis
          ? `<button class="btn btn-ghost btn-sm" id="reel-narration" aria-pressed="${narrationEnabled}">Narration</button>`
          : ""}
      </div>
    </article>`;
  document.getElementById("reel-previous").addEventListener("click", () => goToSlide(index - 1));
  document.getElementById("reel-play").addEventListener("click", toggleReel);
  document.getElementById("reel-close-preview")?.addEventListener("click", () => ReelVideo.hidePreview());
  document.getElementById("reel-next")?.addEventListener("click", () => goToSlide(index + 1));
  document.getElementById("reel-narration")?.addEventListener("click", toggleNarration);
}

function playReel() {
  if (!slides[currentSlide] || playing) return;
  playing = true;
  sceneStartedAt = Date.now();
  document.getElementById("reel-play").textContent = "Pause";
  if (narrationEnabled) speakScene();

  reelTimer = setTimeout(() => {
    if (currentSlide === slides.length - 1) {
      pauseReel();
      sceneTimeRemaining = slides[currentSlide].duration * 1000;
      recordLessonCompletion(topicData);
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
    `<button type="button" class="dot ${i === 0 ? "active" : ""}" aria-label="Scene ${i + 1}"></button>`
  ).join("");
  dotsEl.querySelectorAll("button").forEach((button, index) => {
    button.addEventListener("click", () => goToSlide(index));
  });
}

function updateDots(activeIndex) {
  document.querySelectorAll(".dot").forEach((d, i) => {
    d.classList.toggle("active", i === activeIndex);
  });
}

// ---- Keyboard Navigation ----
document.addEventListener("keydown", (e) => {
  if (slides.length === 0 || document.getElementById("lesson-content").hidden
    || !document.getElementById("reel-play") || e.target.closest("button, input, textarea, a")) return;
  if (e.key === "ArrowRight") goToSlide(currentSlide + 1);
  if (e.key === "ArrowLeft") goToSlide(currentSlide - 1);
});

function resetLesson() {
  ReelVideo.clear();
  pauseReel();
  slides = [];
  topicData = null;
  showTopicPicker();
}

document.getElementById("lesson-reset")?.addEventListener("click", resetLesson);

function escapeHTML(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
