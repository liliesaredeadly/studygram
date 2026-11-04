// ============================================================
// diary.js — Self-study diary logic
// Voice recognition, AI analysis, and past entries display
// ============================================================

const voiceRetryDelays = [350, 850, 1800];
let DiaryRecognition;
let recognition;
let isRecording = false;
let finishingVoice = false;
let voiceTimer;
let voiceRetries = 0;
let voiceDraft = "";
let finalizedDraft = "";
let activeAnalysis = null;
let activeDraft = null;
let draftOpen = false;
let savingDiaryEntry = false;

// ---- Entry Point ----
document.addEventListener("DOMContentLoaded", async () => {
  if (typeof StudygramPrivateSession !== "undefined") {
    await StudygramPrivateSession.ready;
    if (!StudygramPrivateSession.user()) return;
  }
  document.getElementById("voice-btn")?.addEventListener("click", toggleVoice);
  document.getElementById("draft-btn")?.addEventListener("click", draftEntry);
  document.getElementById("save-notes-btn")?.addEventListener("click", saveAsWritten);
  document.getElementById("analyze-btn")?.addEventListener("click", analyzeEntry);
  document.getElementById("diary-clear")?.addEventListener("click", clearEntry);
  document.getElementById("diary-approve")?.addEventListener("click", approveDraft);
  document.getElementById("diary-discard")?.addEventListener("click", discardDraft);
  setupVoiceRecognition();
  renderPastEntries();
  document.getElementById("diary-input").addEventListener("input", () => {
    if (!activeDraft) return;
    activeDraft = null;
    syncEntryActions();
    document.getElementById("draft-status").textContent = "Your notes changed. Draft again to use the updated notes.";
  });
});

// ============================================================
// VOICE RECOGNITION (Web Speech API)
// ============================================================
function setupVoiceRecognition() {
  DiaryRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!DiaryRecognition || window.isSecureContext === false) {
    DiaryRecognition = null;
    document.getElementById("voice-btn").hidden = true;
    document.getElementById("voice-status").textContent = "Dictation is unavailable here. You can still type your notes.";
    return;
  }
  document.getElementById("diary-input").addEventListener("input", () => {
    if (isRecording) stopVoice();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && isRecording) stopVoice();
  });
  window.addEventListener("pagehide", () => {
    if (isRecording) stopVoice();
  });
}

function toggleVoice() {
  if (!isRecording) return startVoice();
  if (!recognition || finishingVoice) return stopVoice();

  finishingVoice = true;
  document.getElementById("voice-status").textContent = "Finishing your dictation…";
  voiceTimer = setTimeout(stopVoice, 1500);
  try {
    recognition.stop();
  } catch {
    stopVoice();
  }
}

function startVoice() {
  if (!DiaryRecognition || isRecording) return;
  voiceDraft = document.getElementById("diary-input").value.trimEnd();
  finalizedDraft = voiceDraft;
  voiceRetries = 0;
  isRecording = true;
  const btn = document.getElementById("voice-btn");
  btn.classList.add("recording");
  btn.setAttribute("aria-pressed", "true");
  btn.textContent = "⏹ Stop";
  document.getElementById("voice-status").textContent = "Starting microphone…";
  beginRecognition();
}

function restartRecognition() {
  if (voiceRetries >= voiceRetryDelays.length) {
    stopVoice("Dictation paused. Select Speak to try again or keep typing.");
    return;
  }
  // Keep committed words across sessions. The last interim words stay visible until replaced.
  voiceDraft = finalizedDraft;
  document.getElementById("voice-status").textContent = "Reconnecting microphone…";
  voiceTimer = setTimeout(beginRecognition, voiceRetryDelays[voiceRetries++]);
}

function beginRecognition() {
  if (!isRecording) return;
  try {
    const run = new DiaryRecognition();
    recognition = run;
    run.continuous = true;
    run.interimResults = true;
    run.lang = "en-IN";
    run.onstart = () => {
      if (recognition === run && !finishingVoice) document.getElementById("voice-status").textContent = "Listening…";
    };
    run.onresult = ({ results }) => {
      if (recognition !== run) return;
      const final = [];
      const interim = [];
      for (const result of Array.from(results)) {
        const transcript = result[0]?.transcript.trim();
        if (transcript) (result.isFinal ? final : interim).push(transcript);
      }
      if (final.length || interim.length) voiceRetries = 0;
      finalizedDraft = [voiceDraft, ...final].filter(Boolean).join(" ");
      document.getElementById("diary-input").value = [finalizedDraft, ...interim].filter(Boolean).join(" ");
    };
    run.onerror = ({ error }) => {
      if (recognition !== run) return;
      if (!finishingVoice && (error === "no-speech" || error === "network")) {
        recognition = null;
        restartRecognition();
      } else if (finishingVoice) {
        stopVoice();
      } else {
        const messages = {
          "not-allowed": "Allow microphone access in your browser, then try again.",
          "audio-capture": "No microphone is available. Check your input device and try again.",
        };
        stopVoice(messages[error] || "Dictation stopped. Select Speak to retry or keep typing.");
      }
    };
    run.onend = () => {
      if (recognition !== run) return;
      recognition = null;
      if (finishingVoice) stopVoice();
      else restartRecognition();
    };
    run.start();
  } catch {
    stopVoice("The microphone couldn’t start. Select Speak to try again.");
  }
}

function stopVoice(message = "Voice stopped. You can edit the text above.") {
  clearTimeout(voiceTimer);
  const run = recognition;
  recognition = null;
  isRecording = false;
  finishingVoice = false;
  try { run?.abort(); } catch { /* The browser may have already stopped. */ }
  const btn = document.getElementById("voice-btn");
  btn.classList.remove("recording");
  btn.setAttribute("aria-pressed", "false");
  btn.textContent = "🎤 Speak";
  document.getElementById("voice-status").textContent = message;
}

// ============================================================
// DRAFT REVIEW
// ============================================================

function syncEntryActions() {
  const busy = Boolean(activeDraft || activeAnalysis || draftOpen || savingDiaryEntry);
  for (const id of ["draft-btn", "save-notes-btn", "analyze-btn", "voice-btn"]) {
    document.getElementById(id).disabled = busy;
  }
}

async function draftEntry() {
  if (activeDraft || activeAnalysis || draftOpen) return;
  if (isRecording) stopVoice();
  const notes = document.getElementById("diary-input");
  const status = document.getElementById("draft-status");
  const entry = notes.value.trim();
  if (!entry || entry.length > 1000) {
    status.textContent = entry ? "Use up to 1,000 characters to draft an entry." : "Add a few words about your study day first.";
    notes.focus();
    return;
  }

  const request = {};
  activeDraft = request;
  syncEntryActions();
  status.textContent = "Drafting your entry…";
  document.getElementById("ai-result").innerHTML = "";
  try {
    const response = await draftDiary(entry);
    if (activeDraft !== request) return;
    if (notes.value.trim() !== entry) {
      status.textContent = "Your notes changed. Draft again to use the updated notes.";
      return;
    }
    const draft = typeof response?.draft === "string" ? response.draft.trim() : "";
    if (!draft || draft.length > 600) throw new Error("AI couldn’t produce a usable draft.");
    const editor = document.getElementById("diary-draft");
    editor.value = draft;
    draftOpen = true;
    notes.readOnly = true;
    document.getElementById("draft-review").hidden = false;
    status.textContent = "Draft ready. Review it before saving.";
    editor.focus();
  } catch (error) {
    if (activeDraft === request) {
      status.textContent = `${error.message || "Couldn’t draft your entry."} You can still save your notes as written.`;
    }
  } finally {
    if (activeDraft === request) {
      activeDraft = null;
      syncEntryActions();
    }
  }
}

function resetDraft() {
  activeDraft = null;
  draftOpen = false;
  document.getElementById("draft-review").hidden = true;
  document.getElementById("diary-draft").value = "";
  document.getElementById("diary-input").readOnly = false;
  document.getElementById("draft-status").textContent = "";
  syncEntryActions();
}

function discardDraft() {
  resetDraft();
  document.getElementById("diary-input").focus();
}

async function persistDiaryEntry(text, analysis) {
  if (savingDiaryEntry) return false;
  savingDiaryEntry = true;
  syncEntryActions();
  try {
    Storage.saveDiaryEntry({ text, aiResponse: analysis });
    await Storage.flush?.();
  } catch {
    showToast("Couldn’t save to your account. Your text is still here.", "error");
    return false;
  } finally {
    savingDiaryEntry = false;
    syncEntryActions();
  }
  renderPastEntries();
  return true;
}

async function saveDiaryText(text) {
  if (!await persistDiaryEntry(text)) return;
  clearEntry();
  document.getElementById("draft-status").textContent = "Entry saved to your diary.";
  document.getElementById("diary-input").focus();
}

function approveDraft() {
  if (!draftOpen) return;
  const editor = document.getElementById("diary-draft");
  const text = editor.value.trim();
  if (text && text.length <= 600) {
    return saveDiaryText(text);
  } else {
    showToast("Write an entry of up to 600 characters before saving.", "warning");
    editor.focus();
  }
}

function saveAsWritten() {
  if (activeDraft || activeAnalysis || draftOpen) return;
  if (isRecording) stopVoice();
  const notes = document.getElementById("diary-input");
  const text = notes.value.trim();
  if (text) {
    return saveDiaryText(text);
  } else {
    document.getElementById("draft-status").textContent = "Add a few words about your study day first.";
    notes.focus();
  }
}

// ---- AI analysis for entries written by the student ----
async function analyzeEntry() {
  if (activeAnalysis || activeDraft || draftOpen) return;
  const notes = document.getElementById("diary-input");
  const text = notes.value.trim();

  if (!text || text.length < 20) {
    showToast("Please write at least a sentence or two about your day 😊", "warning");
    return;
  }

  const btn = document.getElementById("analyze-btn");
  const resultEl = document.getElementById("ai-result");
  if (isRecording) stopVoice();
  const request = {};
  activeAnalysis = request;
  syncEntryActions();
  setBtnLoading(btn, true, "AI reading your day...");
  document.getElementById("draft-status").textContent = "";

  resultEl.innerHTML = `
    <div class="loading-overlay" style="min-height:200px;border-radius:var(--radius-xl);border:1px solid var(--border);background:var(--bg-card);">
      <div class="spinner"></div>
      <p>AI is reading your diary entry…</p>
    </div>`;

  try {
    const analysis = await analyzeDiary(text);
    if (activeAnalysis !== request) return;

    // Validate the response has what we need
    if (!Array.isArray(analysis?.topics) || typeof analysis.encouragement !== "string") {
      throw new Error("Unexpected AI response format");
    }

    renderAIResult(analysis);
    if (await persistDiaryEntry(text, analysis) && activeAnalysis === request) {
      if (notes.value.trim() === text) notes.value = "";
      document.getElementById("draft-status").textContent = "Entry saved. Revision ideas are below.";
    }

  } catch (err) {
    if (activeAnalysis === request) handleAPIError(err, resultEl, analyzeEntry);
  } finally {
    if (activeAnalysis === request) {
      activeAnalysis = null;
      setBtnLoading(btn, false);
      syncEntryActions();
    }
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
            <h3 style="font-size:0.9rem; color:var(--accent); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px;">💬 A Message for You</h3>
            <p style="font-size:0.95rem; line-height:1.7; color:var(--text-primary);">${escapeHTML(encouragement)}</p>
          </div>
        </div>
      </div>

      <!-- Study Tip -->
      ${studyTip ? `
        <div class="card" style="margin-bottom:20px;">
          <div style="display:flex; gap:12px; align-items:flex-start;">
            <span style="font-size:1.3rem;">💡</span>
            <div>
              <p style="font-size:0.78rem; font-weight:700; color:var(--accent); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px;">Study Tip</p>
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
        <p class="entry-date">${escapeHTML(entry.date ?? "")}</p>
        <p class="entry-text">${escapeHTML(entry.text)}</p>
        ${Array.isArray(entry.aiResponse?.topics) && entry.aiResponse.topics.length ? `
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${entry.aiResponse.topics.slice(0, 3).map(t => `
              <span class="topic-tag">
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
  if (activeAnalysis) {
    activeAnalysis = null;
    setBtnLoading(document.getElementById("analyze-btn"), false);
  }
  document.getElementById("diary-input").value = "";
  document.getElementById("ai-result").innerHTML = "";
  if (isRecording) stopVoice();
  resetDraft();
}

// ---- Utility ----
function escapeHTML(str = "") {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
