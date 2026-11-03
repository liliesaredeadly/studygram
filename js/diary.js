// ============================================================
// diary.js — Self-study diary logic
// Voice recognition, AI analysis, and past entries display
// ============================================================

let recognition = null;   // Web Speech API object
let isRecording = false;  // Are we currently listening?

// ---- Entry Point ----
document.addEventListener("DOMContentLoaded", () => {
  setupVoiceRecognition();
  renderPastEntries();
});

// ============================================================
// VOICE RECOGNITION (Web Speech API)
// ============================================================
// The Web Speech API is built into Chrome and Edge.
// It converts your microphone audio into text automatically.
// No API key or cost needed!

function setupVoiceRecognition() {
  // Check if browser supports speech recognition
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    // Browser doesn't support it — hide the button gracefully
    const btn = document.getElementById("voice-btn");
    if (btn) {
      btn.style.display = "none";
      document.getElementById("voice-status").textContent = "Voice not supported in this browser. Use Chrome.";
    }
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;      // Keep listening until we stop it
  recognition.interimResults = true;  // Show partial results as user speaks
  recognition.lang = "en-IN";         // Indian English accent support

  let finalTranscript = "";

  // Called every time speech is detected
  recognition.onresult = (event) => {
    let interimTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + " ";
      } else {
        interimTranscript = transcript;
      }
    }

    // Show text in the textarea
    const textarea = document.getElementById("diary-input");
    textarea.value = finalTranscript + interimTranscript;

    // Show interim text in status
    document.getElementById("voice-status").textContent =
      interimTranscript ? `Hearing: "${interimTranscript}"` : "🎙️ Listening...";
  };

  recognition.onerror = (event) => {
    console.error("Voice error:", event.error);
    stopVoice();
    if (event.error === "not-allowed") {
      showToast("Please allow microphone access in your browser", "error");
    } else {
      showToast("Voice error: " + event.error, "error");
    }
  };

  recognition.onend = () => {
    if (isRecording) {
      // Auto-restart if we're still supposed to be recording
      // (recognition sometimes auto-stops after silence)
      recognition.start();
    }
  };
}

function toggleVoice() {
  if (isRecording) {
    stopVoice();
  } else {
    startVoice();
  }
}

function startVoice() {
  if (!recognition) {
    showToast("Voice input not supported. Use Chrome browser.", "warning");
    return;
  }
  isRecording = true;
  recognition.start();

  const btn = document.getElementById("voice-btn");
  btn.classList.add("recording");
  btn.textContent = "⏹ Stop";
  document.getElementById("voice-status").textContent = "🎙️ Listening...";
  showToast("Listening... Speak naturally about your day", "info", 3000);
}

function stopVoice() {
  isRecording = false;
  if (recognition) recognition.stop();

  const btn = document.getElementById("voice-btn");
  btn.classList.remove("recording");
  btn.innerHTML = "🎤 Speak";
  document.getElementById("voice-status").textContent = "Voice stopped. You can edit the text above.";
}

// ============================================================
// AI ANALYSIS
// ============================================================

async function analyzeEntry() {
  const text = document.getElementById("diary-input").value.trim();

  if (!text || text.length < 20) {
    showToast("Please write at least a sentence or two about your day 😊", "warning");
    return;
  }

  const btn = document.getElementById("analyze-btn");
  const resultEl = document.getElementById("ai-result");
  setBtnLoading(btn, true, "AI reading your day...");

  resultEl.innerHTML = `
    <div class="loading-overlay" style="min-height:200px;border-radius:var(--radius-xl);border:1px solid var(--border);background:var(--bg-card);">
      <div class="spinner"></div>
      <p>AI is reading your diary entry…</p>
    </div>`;

  try {
    const analysis = await analyzeDiary(text);

    // Validate the response has what we need
    if (!analysis.topics || !analysis.encouragement) {
      throw new Error("Unexpected AI response format");
    }

    // Save to localStorage
    Storage.saveDiaryEntry({ text, aiResponse: analysis });

    // Render AI result
    renderAIResult(analysis);
    renderPastEntries();
    showToast("Analysis complete! 🌟", "success");

  } catch (err) {
    handleAPIError(err, resultEl, analyzeEntry);
  } finally {
    setBtnLoading(btn, false);
  }
}

function renderAIResult(analysis) {
  const resultEl = document.getElementById("ai-result");
  const { topics = [], encouragement = "", studyTip = "", mood = "😊" } = analysis;

  resultEl.innerHTML = `
    <div class="ai-result-section">

      <!-- Encouragement -->
      <div class="encouragement-card" style="margin-bottom:20px;">
        <div style="display:flex; align-items:flex-start; gap:14px;">
          <span style="font-size:2rem; flex-shrink:0;">${escapeHTML(mood)}</span>
          <div>
            <h3 style="font-size:0.9rem; color:var(--accent-cyan); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px;">💬 A Message for You</h3>
            <p style="font-size:0.95rem; line-height:1.7; color:var(--text-primary);">${escapeHTML(encouragement)}</p>
          </div>
        </div>
      </div>

      <!-- Study Tip -->
      ${studyTip ? `
        <div class="card" style="margin-bottom:20px; border-color:rgba(16,185,129,0.25); background:rgba(16,185,129,0.04);">
          <div style="display:flex; gap:12px; align-items:flex-start;">
            <span style="font-size:1.3rem;">💡</span>
            <div>
              <p style="font-size:0.78rem; font-weight:700; color:var(--accent-emerald); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px;">Study Tip</p>
              <p style="font-size:0.9rem; color:var(--text-secondary); line-height:1.6;">${escapeHTML(studyTip)}</p>
            </div>
          </div>
        </div>
      ` : ""}

      <!-- Revision Topics -->
      ${topics.length > 0 ? `
        <div class="card card-accent-border">
          <h3 style="font-size:0.9rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:14px;">📌 Topics to Revise</h3>
          <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:16px;">
            ${topics.map(t => `
              <a
                href="study.html?topic=${encodeURIComponent(t)}"
                class="topic-tag"
              >
                📚 ${escapeHTML(t)}
              </a>
            `).join("")}
          </div>
          <p style="font-size:0.8rem; color:var(--text-muted);">Choose a topic to start a study set.</p>
        </div>
      ` : ""}

    </div>`;
}

// ============================================================
// PAST ENTRIES
// ============================================================

function renderPastEntries() {
  const entries = Storage.getDiaryEntries();
  const container = document.getElementById("past-entries");
  const countBadge = document.getElementById("entry-count");
  countBadge.textContent = `${entries.length} entr${entries.length !== 1 ? "ies" : "y"}`;

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>No entries yet.<br/>Write your first diary entry!</p>
      </div>`;
    return;
  }

  container.innerHTML = `<div style="display:flex; flex-direction:column; gap:12px;">
    ${entries.map(entry => `
      <div class="card entry-card">
        <p class="entry-date">${entry.date}</p>
        <p class="entry-text">${escapeHTML(entry.text.slice(0, 150))}${entry.text.length > 150 ? "…" : ""}</p>
        ${entry.aiResponse?.topics?.length ? `
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${entry.aiResponse.topics.slice(0, 3).map(t => `
              <span style="font-size:0.72rem; background:rgba(124,58,237,0.1); border:1px solid rgba(124,58,237,0.2); border-radius:var(--radius-full); padding:3px 10px; color:var(--accent-soft);">
                ${escapeHTML(t)}
              </span>
            `).join("")}
          </div>
        ` : ""}
      </div>
    `).join("")}
  </div>`;
}

// ---- Clear Entry ----
function clearEntry() {
  document.getElementById("diary-input").value = "";
  document.getElementById("ai-result").innerHTML = "";
  if (isRecording) stopVoice();
}

// ---- Utility ----
function escapeHTML(str = "") {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
