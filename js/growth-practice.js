(typeof StudygramPrivateSession === "undefined" ? callback => callback() : StudygramPrivateSession.start)(() => {
  const sprintPanel = document.getElementById("growth-sprint");
  const recallPanel = document.getElementById("growth-recall");
  if (!sprintPanel || !recallPanel) return;

  const field = (parent, name) => parent.querySelector(`[data-field="${name}"]`);
  const change = () => document.dispatchEvent(new Event("growth:change"));
  const setText = (element, text) => { if (element.textContent !== text) element.textContent = text; };
  const presets = [3, 5, 10];
  const formatTime = milliseconds => {
    const seconds = Math.ceil(milliseconds / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  };

  sprintPanel.setAttribute("aria-labelledby", "growth-sprint-title");
  sprintPanel.innerHTML = `
    <p class="growth-kicker">Quiet practice</p>
    <h2 id="growth-sprint-title">Focus Sprint</h2>
    <p class="growth-subtitle">Give one thought your full attention. You can finish early and reflect on what helped.</p>
    <div class="growth-actions" data-field="presets" role="group" aria-label="Sprint length">
      <button type="button" class="growth-button growth-button--secondary" data-minutes="3">3 min</button>
      <button type="button" class="growth-button growth-button--secondary" data-minutes="5">5 min</button>
      <button type="button" class="growth-button growth-button--secondary" data-minutes="10">10 min · Deep thinking</button>
    </div>
    <div class="growth-actions growth-practice-row">
      <button type="button" class="growth-button" data-field="open">Start writing</button>
      <p class="growth-status" role="status" data-field="status"></p>
    </div>
    <dialog class="growth-practice-dialog" aria-labelledby="growth-sprint-dialog-title">
      <div class="growth-practice-row">
        <div><p class="growth-kicker">One thought at a time</p><h2 id="growth-sprint-dialog-title">Writing sprint</h2></div>
        <output class="growth-practice-clock" role="timer" aria-label="Time remaining" aria-live="off" data-field="clock"></output>
      </div>
      <progress data-field="progress" aria-label="Sprint time used"></progress>
      <p class="growth-subtitle" data-field="prompt"></p>
      <label class="growth-field">Your thoughts
        <textarea class="growth-textarea" rows="5" maxlength="4000" autocomplete="off" data-field="text"></textarea>
      </label>
      <div data-field="reflection" hidden>
        <h3>Take a moment to reflect</h3>
        <p data-field="summary"></p>
        <label class="growth-field">How focused did you feel? (optional)
          <select data-field="rating">
            <option value="">Skip this question</option>
            <option value="steady">Mostly steady</option>
            <option value="mixed">Some distractions</option>
            <option value="difficult">Hard to stay focused</option>
          </select>
        </label>
        <label class="growth-field">What helped you stay with the thought? (optional)
          <textarea class="growth-textarea" rows="2" maxlength="800" autocomplete="off" data-field="note"></textarea>
        </label>
      </div>
      <div class="growth-actions">
        <button type="button" class="growth-button" data-field="finish">Finish early</button>
        <button type="button" class="growth-button growth-button--secondary" data-field="close">Return to Growth</button>
      </div>
      <p class="growth-status" role="status" data-field="draft-status"></p>
    </dialog>`;

  const sprintDialog = sprintPanel.querySelector("dialog");
  const sprint = name => field(sprintPanel, name);
  const presetButtons = [...sprintPanel.querySelectorAll("[data-minutes]")];
  let session;
  let interval;

  function saveDraft() {
    try {
      GrowthStore.update(state => {
        if (state.drafts.sprint?.id && state.drafts.sprint.id !== session.id) throw new Error("Another sprint is active.");
        state.drafts.sprint = session;
      });
      sprint("draft-status").textContent = "Draft updated.";
      return true;
    } catch {
      sprint("draft-status").textContent = "This browser couldn’t save your draft. Keep this page open to keep writing.";
      return false;
    }
  }

  function loadSprint() {
    const saved = GrowthStore.load().drafts.sprint;
    const timer = restoreFocusTimer(saved?.timer, Date.now(), presets, 3);
    session = { id: null, prompt: "", text: "", note: "", rating: "", elapsedMs: 0, ...saved, timer };
    if (saved?.timer?.status === "running" && timer.status === "finished") session.elapsedMs = timer.durationMs;
    sprint("text").value = session.text;
    sprint("note").value = session.note;
    sprint("rating").value = session.rating;
    if (saved?.timer?.status === "running" && timer.status === "finished") saveDraft();
  }

  function renderSprint() {
    const { timer } = session;
    const remaining = focusTimeLeft(timer, Date.now());
    const finished = timer.status === "finished";
    const idle = timer.status === "idle";
    const label = formatTime(remaining);
    setText(sprint("clock"), label);
    sprint("progress").max = timer.durationMs;
    sprint("progress").value = finished ? session.elapsedMs : timer.durationMs - remaining;
    setText(sprint("open"), idle ? "Start writing" : finished ? "Open sprint reflection" : "Return to your sprint");
    setText(sprint("prompt"), session.prompt);
    sprint("reflection").hidden = !finished;
    setText(sprint("summary"), `You spent ${formatTime(session.elapsedMs)} with one prompt.`);
    setText(sprint("finish"), finished ? "Save completed sprint" : "Finish early");
    for (const button of presetButtons) {
      button.disabled = !idle;
      button.setAttribute("aria-pressed", String(Number(button.dataset.minutes) * 60000 === timer.durationMs));
    }
    if (timer.status === "running" && interval === undefined) interval = window.setInterval(tick, 250);
    if (timer.status !== "running" && interval !== undefined) {
      window.clearInterval(interval);
      interval = undefined;
    }
  }

  function finishSprint(now) {
    const remaining = focusTimeLeft(session.timer, now);
    session.elapsedMs = session.timer.durationMs - remaining;
    session.timer = { ...session.timer, status: "finished", remainingMs: 0, endsAt: null };
    saveDraft();
    renderSprint();
    if (sprintDialog.open) sprint("rating").focus();
    sprint("status").textContent = "Sprint finished. Take a moment to reflect.";
  }

  function tick() {
    const now = Date.now();
    if (session.timer.status === "running" && settleFocusTimer(session.timer, now).status === "finished") {
      finishSprint(now);
    } else renderSprint();
  }

  loadSprint();
  renderSprint();
  for (const button of presetButtons) {
    button.addEventListener("click", () => {
      session.timer = updateFocusTimer(session.timer, { type: "select", minutes: Number(button.dataset.minutes) }, Date.now(), presets);
      saveDraft();
      renderSprint();
    });
  }

  sprint("open").addEventListener("click", () => {
    tick();
    if (session.timer.status === "idle") {
      const prompt = GrowthStore.daily(GrowthStore.load());
      session.id = crypto.randomUUID();
      session.prompt = prompt.text;
      session.timer = updateFocusTimer(session.timer, { type: "start" }, Date.now(), presets);
      saveDraft();
      renderSprint();
    }
    sprintDialog.showModal();
    sprint(session.timer.status === "finished" ? "rating" : "text").focus();
  });
  sprint("close").addEventListener("click", () => sprintDialog.close());
  sprintDialog.addEventListener("close", () => {
    if (session.timer.status === "running") sprint("status").textContent = "Your timer is still running. Return to your sprint when ready.";
  });
  for (const name of ["text", "rating", "note"]) {
    sprint(name).addEventListener("input", () => {
      session[name] = sprint(name).value;
      saveDraft();
    });
  }
  sprint("finish").addEventListener("click", () => {
    if (session.timer.status === "running") return finishSprint(Date.now());
    if (session.timer.status !== "finished") return;
    try {
      const state = GrowthStore.update(data => {
        if (!data.activities.some(item => item.id === session.id)) {
          data.activities.push({
            id: session.id, kind: "focus", at: Date.now(), text: session.text.trim(),
            promptText: session.prompt, focus: session.rating, reflection: session.note.trim(),
            elapsedMs: session.elapsedMs, durationMs: session.timer.durationMs,
          });
        }
        if (data.drafts.sprint?.id === session.id) delete data.drafts.sprint;
      });
      sprintDialog.close();
      loadSprint();
      renderSprint();
      sprint("status").textContent = GrowthStore.encouragement("focus", GrowthStore.progress(state));
      change();
    } catch {
      sprint("draft-status").textContent = "The session couldn’t be saved. Try again while this page is open.";
    }
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
  window.addEventListener("pageshow", event => { if (event.persisted) { loadSprint(); tick(); } });
  window.addEventListener("pagehide", () => { window.clearInterval(interval); interval = undefined; });

  const passages = [
    { id: "gita", type: "passage", title: "Bhagavad Gita 2.47", url: "https://sacred-texts.com/book/the-bhagavadgita/chapter-ii" },
    { id: "bible", type: "passage", title: "Ephesians 4:32", url: "https://ebible.org/eng-web/EPH04.htm#V32" },
  ];
  let topics;
  try { topics = Storage.getTopics(); } catch { topics = []; }
  const lessons = topics.filter(topic => typeof topic?.name === "string" && Array.isArray(topic.content?.scenes)).flatMap(topic => {
    const points = topic.content.scenes.map(scene => scene?.caption || scene?.narration)
      .filter(point => typeof point === "string" && point.trim()).slice(0, 6).map(point => point.slice(0, 500));
    return points.length ? [{ id: String(topic.id), type: "lesson", title: topic.name.slice(0, 120), points }] : [];
  });
  const sources = new Map([...lessons, ...passages].map(item => [`${item.type}:${item.id}`, item]));
  const params = new URLSearchParams(window.location.search);
  const requested = params.has("topicId") ? `lesson:${params.get("topicId")}` : `passage:${params.get("passage")}`;

  recallPanel.setAttribute("aria-labelledby", "growth-recall-title");
  recallPanel.innerHTML = `
    <p class="growth-kicker">Active recall</p>
    <h2 id="growth-recall-title">Explain It Yourself</h2>
    <p class="growth-subtitle">Recall the main idea before reopening the source. Try an example of your own and notice where your explanation gets uncertain.</p>
    <label class="growth-field">Lesson or passage<select data-field="source"><option value="">Choose a source</option></select></label>
    <div data-field="work" hidden>
      <label class="growth-field">Your explanation<textarea class="growth-textarea" rows="5" maxlength="2000" autocomplete="off" data-field="answer"></textarea></label>
      <details data-field="reference"><summary>Compare with the source</summary><div data-field="notes"></div></details>
      <p class="growth-subtitle">Save your explanation locally, or send this explanation and the source context to Meta AI for conceptual feedback when live AI is enabled. Leave out personal details.</p>
      <div class="growth-actions">
        <button type="button" class="growth-button" data-field="save">Save explanation</button>
        <button type="button" class="growth-button growth-button--secondary" data-field="ai">Get AI feedback</button>
      </div>
      <p class="growth-status" role="status" data-field="status"></p>
      <div class="growth-recall-feedback" data-field="feedback" hidden></div>
    </div>`;
  const recall = name => field(recallPanel, name);
  const sourcePicker = recall("source");
  for (const [key, item] of sources) sourcePicker.add(new Option(item.title, key));
  if (sources.has(requested)) sourcePicker.value = requested;
  let recallRequest = 0;

  function clearFeedback() {
    recallRequest++;
    recall("ai").disabled = false;
    recall("feedback").hidden = true;
    recall("feedback").replaceChildren();
  }

  function showSource() {
    clearFeedback();
    recall("status").textContent = "";
    const item = sources.get(sourcePicker.value);
    recall("work").hidden = !item;
    if (!item) return;
    recall("answer").value = GrowthStore.load().drafts[`recall:${sourcePicker.value}`] || "";
    recall("reference").open = false;
    const notes = recall("notes");
    notes.replaceChildren();
    if (item.type === "lesson") {
      const list = document.createElement("ul");
      for (const point of item.points) {
        const entry = document.createElement("li");
        entry.textContent = point;
        list.append(entry);
      }
      notes.append(list);
    } else {
      const link = document.createElement("a");
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `${item.title} (opens in a new tab)`;
      const prompt = document.createElement("p");
      prompt.textContent = "Which part comes directly from the text? Which part is your interpretation?";
      notes.append(link, prompt);
    }
  }

  sourcePicker.addEventListener("change", showSource);
  showSource();
  recall("answer").addEventListener("input", () => {
    clearFeedback();
    try {
      GrowthStore.update(state => { state.drafts[`recall:${sourcePicker.value}`] = recall("answer").value; });
      recall("status").textContent = "Draft updated.";
    } catch { recall("status").textContent = "Couldn’t save this draft."; }
  });

  function explanation() {
    const text = recall("answer").value.trim();
    if (!text) {
      recall("status").textContent = "Write an explanation in your own words first.";
      recall("answer").focus();
    }
    return text;
  }

  recall("save").addEventListener("click", () => {
    const text = explanation();
    const key = sourcePicker.value;
    if (!text || !sources.has(key)) return;
    try {
      let saved = false;
      const data = GrowthStore.update(state => {
        if (state.activities.some(item => item.kind === "recall" && item.contextKey === key && item.text === text)) return;
        state.activities.push({ id: crypto.randomUUID(), kind: "recall", at: Date.now(), text, contextKey: key, title: sources.get(key).title });
        delete state.drafts[`recall:${key}`];
        saved = true;
      });
      recall("status").textContent = saved
        ? GrowthStore.encouragement("recall", GrowthStore.progress(data)) : "This explanation is already saved.";
      if (saved) change();
    } catch { recall("status").textContent = "The explanation couldn’t be saved. Your text is still here."; }
  });

  recall("ai").addEventListener("click", async () => {
    const text = explanation();
    const source = sources.get(sourcePicker.value);
    if (!text || !source) return;
    clearFeedback();
    const request = recallRequest;
    recall("ai").disabled = true;
    recall("status").textContent = "Getting conceptual feedback…";
    const context = source.type === "passage" ? { type: source.type, id: source.id }
      : { type: source.type, title: source.title, points: source.points };
    try {
      const result = await requestStudygramAI("growth", { kind: "recall", explanation: text, context });
      if (request !== recallRequest) return;
      for (const [label, key] of [["What came through", "understood"], ["Point to revisit", "misconception"], ["Question to think about", "followUp"], ["Next step", "nextStep"]]) {
        if (!result[key]) continue;
        const heading = document.createElement("h3");
        const paragraph = document.createElement("p");
        heading.textContent = label;
        paragraph.textContent = result[key];
        recall("feedback").append(heading, paragraph);
      }
      recall("feedback").hidden = false;
      recall("status").textContent = "Feedback ready.";
    } catch {
      if (request !== recallRequest) return;
      recall("reference").open = true;
      recall("status").textContent = "AI feedback is unavailable. Compare your explanation with the source above. What would you explain differently?";
    } finally {
      if (request === recallRequest) recall("ai").disabled = false;
    }
  });

  document.addEventListener("growth:reset", () => {
    if (sprintDialog.open) sprintDialog.close();
    loadSprint();
    renderSprint();
    sprint("status").textContent = "";
    sprint("draft-status").textContent = "";
    showSource();
  });
  window.addEventListener("storage", event => {
    if (event.key === "sg_student" || event.key === null ||
        (event.newValue === null && event.key.startsWith("sg_growth_v1:"))) window.location.reload();
  });
});
