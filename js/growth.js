(typeof StudygramPrivateSession === "undefined" ? callback => callback() : StudygramPrivateSession.start)(() => {
  const byId = (id) => document.getElementById(id);
  const store = GrowthStore;
  const writingField = byId("growth-writing-text");
  const journalField = byId("growth-journal-text");
  const promptButton = byId("growth-prompt-ai");
  const encouragementButton = byId("growth-encouragement-ai");
  const writingStatus = byId("growth-writing-status");
  const journalStatus = byId("growth-journal-status");
  const preferenceStatus = byId("growth-preference-status");
  const dataStatus = byId("growth-data-status");
  const confirmDialog = byId("growth-confirm");
  const preferencesForm = byId("growth-preferences-form");
  const historyList = byId("growth-entry-list");
  const historyMore = byId("growth-journal-more");
  const journalPromptLabel = byId("growth-journal-prompt");
  const writingSaved = byId("growth-writing-saved");
  const journalPrompts = {
    express: ["What is an idea you explained more clearly today?", "What would you tell your younger self?"],
    focus: ["When was it easiest to pay attention today?", "What would help you make time for one important thing tomorrow?"],
    reflect: ["What challenge did you overcome?", "What surprised you about the way you handled something recently?"],
    general: ["What did you accomplish today?", "What are you improving?", "What would you like to try tomorrow?"]
  };
  const countLabels = { writing: "Writing challenges", focus: "Focus sessions", journal: "Journal entries", recall: "Concept explanations" };
  const focusLabels = { steady: "Mostly steady", mixed: "Some distractions", difficult: "Hard to stay focused" };
  const dateFormat = new Intl.DateTimeFormat(document.documentElement.lang, {
    day: "numeric", month: "short", year: "numeric"
  });
  const dateTimeFormat = new Intl.DateTimeFormat(document.documentElement.lang, {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit"
  });
  const historyPage = 5;
  let historyLimit = historyPage;
  let displayedPrompt;
  let displayedDay;
  let displayedJournalPrompt;
  let displayedWriting;
  let olderDraft = false;
  let promptPending = false;
  let encouragementPending = false;
  let requestRevision = 0;
  let confirmation;
  const pending = { writing: 0, journal: 0 };
  const dirty = { writing: false, journal: false };

  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }

  function status(target, message = "", tone = "") {
    if (target.textContent !== message) target.textContent = message;
    target.dataset.tone = tone;
  }

  function setBusy(button, busy) {
    button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));
  }

  function activityId(kind) {
    return `${kind}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  }

  function activities(state, kind) {
    return state.activities.filter((item) => item.kind === kind);
  }

  function writingRecord(state, prompt) {
    return activities(state, "writing").find((item) => item.prompt?.id === prompt.id);
  }

  function draftPrompt(state) {
    const prompt = state.drafts.writing?.prompt;
    return typeof prompt?.text === "string" && Number.isFinite(Date.parse(`${prompt.id}T12:00:00`)) ? prompt : null;
  }

  function refreshPromptButton() {
    promptButton.hidden = olderDraft;
    promptButton.disabled = promptPending || Boolean(writingField.value.trim());
    byId("growth-ai-prompt-note").hidden = olderDraft;
    byId("growth-ai-prompt-note").textContent = writingField.value.trim()
      ? "You can personalize a prompt before you begin a response."
      : "Uses your practice counts and preferences to suggest a prompt.";
  }

  function renderWriting(state) {
    const today = store.daily(state);
    const draft = state.drafts.writing;
    const savedPrompt = draftPrompt(state);
    olderDraft = Boolean(draft?.text && savedPrompt && savedPrompt.id !== today.id && !writingRecord(state, savedPrompt));
    displayedDay = today.id;
    displayedPrompt = olderDraft ? savedPrompt : today;
    displayedWriting = writingRecord(state, displayedPrompt);

    const date = byId("growth-date");
    date.textContent = dateFormat.format(new Date(`${displayedPrompt.id}T12:00:00`));
    date.dateTime = displayedPrompt.id;
    byId("growth-prompt-label").textContent = olderDraft ? "Unfinished prompt" : displayedPrompt.generated ? "Today’s AI prompt" : "Today’s prompt";
    byId("growth-prompt-topic").textContent = displayedPrompt.category;
    byId("growth-prompt").textContent = displayedPrompt.text;
    byId("growth-writing-target").textContent = `${displayedPrompt.level} · Aim for ${displayedPrompt.min}–${displayedPrompt.max} meaningful sentences`;
    writingField.value = displayedWriting || savedPrompt?.id !== displayedPrompt.id ? "" : draft?.text || "";
    writingField.removeAttribute("aria-invalid");
    byId("growth-writing-form").hidden = Boolean(displayedWriting);
    byId("growth-draft-discard").hidden = !olderDraft;
    writingSaved.hidden = !displayedWriting;
    if (!displayedWriting) writingSaved.open = false;
    byId("growth-writing-saved-text").textContent = displayedWriting?.text || "";
    refreshPromptButton();
    renderEncouragement(state);
  }

  function renderEncouragement(state) {
    byId("growth-encouragement").hidden = !displayedWriting;
    status(byId("growth-encouragement-status"));
    byId("growth-encouragement-text").textContent = displayedWriting
      ? store.encouragement("writing", store.progress(state))
      : "";
  }

  function renderJournalDraft(state) {
    const draft = state.drafts.journal;
    const selected = journalPrompts[state.preferences.goal] || journalPrompts.general;
    displayedJournalPrompt = draft?.prompt || selected[activities(state, "journal").length % selected.length];
    journalPromptLabel.textContent = displayedJournalPrompt;
    journalField.value = draft?.text || "";
    journalField.removeAttribute("aria-invalid");
  }

  function renderJournalHistory(state) {
    const openEntries = new Set(Array.from(historyList.querySelectorAll("details[open]"), (node) => node.dataset.id));
    const entries = activities(state, "journal").sort((a, b) => b.at - a.at);
    byId("growth-journal-empty").hidden = Boolean(entries.length);
    historyMore.hidden = entries.length <= historyLimit;
    historyList.replaceChildren(...entries.slice(0, historyLimit).map((entry) => {
      const details = element("details", "growth-entry");
      details.dataset.id = entry.id;
      details.open = openEntries.has(entry.id);
      const summary = element("summary");
      const date = element("time", "", dateTimeFormat.format(new Date(entry.at)));
      date.dateTime = new Date(entry.at).toISOString();
      summary.append(date);
      details.append(summary);
      if (typeof entry.prompt === "string") {
        details.append(element("p", "growth-note", entry.prompt));
      }
      const remove = element("button", "growth-button growth-button--quiet growth-button--danger", "Delete entry");
      remove.type = "button";
      remove.dataset.entryId = entry.id;
      details.append(element("p", "", entry.text), remove);
      return details;
    }));
  }

  function renderProgress(state) {
    const progress = store.progress(state);
    byId("growth-progress-summary").textContent = progress.days
      ? `You’ve practiced on ${progress.days} ${progress.days === 1 ? "day" : "days"}.`
      : "Every practice you save adds to your record.";
    byId("growth-metrics").replaceChildren(...Object.entries(countLabels).map(([kind, label]) => {
      const metric = element("div");
      metric.append(element("dt", "", label), element("dd", "", progress.counts[kind]));
      return metric;
    }));
    const maxCount = Math.max(1, ...progress.week.map((day) => day.count));
    byId("growth-week").replaceChildren(...progress.week.map((day) => {
      const item = element("li");
      const bar = element("span", "growth-week-bar");
      const label = element("span", "growth-week-day", day.label);
      const count = element("span", "growth-week-count", day.count);
      bar.style.height = `${(day.count / maxCount) * 100}%`;
      bar.toggleAttribute("data-empty", day.count === 0);
      for (const visual of [count, bar, label]) visual.setAttribute("aria-hidden", "true");
      item.append(element("span", "growth-sr", `${day.label}, ${day.count} ${day.count === 1 ? "activity" : "activities"}`), count, bar, label);
      return item;
    }));
    const focus = activities(state, "focus").filter((item) => focusLabels[item.focus]).sort((a, b) => b.at - a.at)[0];
    const focusNote = byId("growth-focus-note");
    focusNote.hidden = !focus;
    focusNote.textContent = focus ? `Last focus check-in · ${focusLabels[focus.focus]}` : "";
    const earned = progress.milestones.filter((milestone) => milestone.earned).length;
    byId("growth-milestone-count").textContent = `${earned} of ${progress.milestones.length} earned`;
    byId("growth-milestones").replaceChildren(...progress.milestones.map((milestone) => {
      const item = element("li");
      const mark = element("span", "", milestone.earned ? "◆" : "◇");
      mark.setAttribute("aria-hidden", "true");
      const title = element("strong", "", milestone.title);
      if (milestone.earned) title.append(element("span", "growth-sr", " (earned)"));
      item.append(mark, title, element("small", "", milestone.description));
      return item;
    }));
  }

  function renderPreferences(state) {
    for (const name of Object.keys(state.preferences)) {
      const field = preferencesForm.elements.namedItem(name);
      if (field) field.value = state.preferences[name];
    }
  }

  function scheduleDraft(kind, field, target) {
    field.removeAttribute("aria-invalid");
    status(target);
    if (kind === "writing") refreshPromptButton();
    dirty[kind] = true;
    clearTimeout(pending[kind]);
    pending[kind] = setTimeout(() => persistDraft(kind), 220);
  }

  function persistDraft(kind) {
    clearTimeout(pending[kind]);
    if (!dirty[kind]) return true;
    const writing = kind === "writing";
    const field = writing ? writingField : journalField;
    const target = writing ? writingStatus : journalStatus;
    const prompt = writing ? displayedPrompt : displayedJournalPrompt;
    try {
      let alreadySaved = false;
      store.update((state) => {
        alreadySaved = writing && Boolean(writingRecord(state, prompt));
        if (alreadySaved) return;
        if (field.value.trim() || (writing && prompt.generated)) {
          state.drafts[kind] = { text: field.value, prompt };
        } else {
          delete state.drafts[kind];
        }
      });
      if (alreadySaved) {
        status(target, "This prompt was saved in another tab. Keep this tab open if you want to copy your current response.", "error");
        return false;
      }
      dirty[kind] = false;
      status(target, field.value.trim() ? "Draft updated." : "");
      return true;
    } catch {
      status(target, "Couldn’t save your draft. Keep this tab open and try again.", "error");
      return false;
    }
  }

  function invalidate(field, target, message) {
    field.setAttribute("aria-invalid", "true");
    status(target, message, "error");
    field.focus();
  }

  function broadcastChange() {
    document.dispatchEvent(new Event("growth:change"));
  }

  writingField.addEventListener("input", (event) => {
    if (!event.isComposing) scheduleDraft("writing", writingField, writingStatus);
  });
  journalField.addEventListener("input", (event) => {
    if (!event.isComposing) scheduleDraft("journal", journalField, journalStatus);
  });
  writingField.addEventListener("compositionend", () => scheduleDraft("writing", writingField, writingStatus));
  journalField.addEventListener("compositionend", () => scheduleDraft("journal", journalField, journalStatus));

  byId("growth-writing-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = writingField.value.trim();
    if (!text) return invalidate(writingField, writingStatus, "Write a response before saving.");
    let duplicate = false;
    let state;
    try {
      state = store.update((current) => {
        duplicate = Boolean(writingRecord(current, displayedPrompt));
        if (duplicate) return;
        current.activities.push({ id: activityId("writing"), kind: "writing", at: Date.now(), text, prompt: displayedPrompt });
        if (current.drafts.writing?.prompt?.id === displayedPrompt.id) delete current.drafts.writing;
      });
    } catch {
      return status(writingStatus, "Couldn’t save your response in this browser. Try saving again.", "error");
    }
    if (duplicate) return status(writingStatus, "A response is already saved for this prompt in another tab.", "error");
    clearTimeout(pending.writing);
    dirty.writing = false;
    const finishedOlder = olderDraft;
    renderWriting(state);
    status(writingStatus, finishedOlder ? "Your earlier response is saved." : "Today’s response is saved.");
    if (displayedWriting) writingSaved.querySelector("summary").focus();
    else writingField.focus();
    broadcastChange();
  });

  promptButton.addEventListener("click", async () => {
    if (promptPending || writingField.value.trim() || olderDraft || displayedWriting) return;
    const state = store.load();
    const prompt = store.daily(state);
    const revision = requestRevision;
    const preferences = JSON.stringify(state.preferences);
    promptPending = true;
    setBusy(promptButton, true);
    status(writingStatus, "Finding a prompt for you…");
    try {
      const { prompt: result } = await requestStudygramAI("growth", {
        kind: "prompt",
        ...state.preferences,
        level: prompt.level,
        completed: store.progress(state).counts.writing
      });
      if (revision !== requestRevision) return;
      if (typeof result !== "string" || !result.trim()) throw new Error("Empty prompt");
      let applied = false;
      const updated = store.update((current) => {
        if (writingField.value.trim() || current.drafts.writing?.text?.trim() || writingRecord(current, prompt)
          || store.daily(current).id !== prompt.id || JSON.stringify(current.preferences) !== preferences) return;
        current.drafts.writing = { text: "", prompt: { ...prompt, text: result.trim(), generated: true } };
        applied = true;
      });
      if (applied) {
        renderWriting(updated);
        status(writingStatus, "Your personalized prompt is ready.");
      } else {
        status(writingStatus, "Your current prompt is still available.");
      }
    } catch {
      if (revision === requestRevision) status(writingStatus, "A personalized prompt is unavailable right now. You can use the current prompt or try again.", "error");
    } finally {
      promptPending = false;
      setBusy(promptButton, false);
      refreshPromptButton();
    }
  });

  encouragementButton.addEventListener("click", async () => {
    if (encouragementPending || !displayedWriting) return;
    const revision = requestRevision;
    const writingId = displayedWriting.id;
    const progress = store.progress(store.load());
    const target = byId("growth-encouragement-status");
    encouragementPending = true;
    setBusy(encouragementButton, true);
    status(target, "Preparing a note…");
    try {
      const { message } = await requestStudygramAI("growth", {
        kind: "encouragement", activity: "writing", count: progress.counts.writing, days: progress.days
      });
      if (revision !== requestRevision || displayedWriting?.id !== writingId) return;
      if (typeof message !== "string" || !message.trim()) throw new Error("Empty encouragement");
      byId("growth-encouragement-text").textContent = message.trim();
      status(target);
    } catch {
      if (revision === requestRevision && displayedWriting?.id === writingId) {
        status(target, "AI encouragement is unavailable right now. You can try again.", "error");
      }
    } finally {
      encouragementPending = false;
      setBusy(encouragementButton, false);
    }
  });

  byId("growth-journal-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = journalField.value.trim();
    if (!text) return invalidate(journalField, journalStatus, "Write a reflection before saving.");
    let state;
    try {
      state = store.update((current) => {
        current.activities.push({ id: activityId("journal"), kind: "journal", at: Date.now(), text, prompt: displayedJournalPrompt });
        delete current.drafts.journal;
      });
    } catch {
      return status(journalStatus, "Couldn’t save your entry in this browser. Try saving again.", "error");
    }
    clearTimeout(pending.journal);
    dirty.journal = false;
    renderJournalDraft(state);
    renderJournalHistory(state);
    status(journalStatus, "Entry added to your journal.");
    broadcastChange();
  });

  historyMore.addEventListener("click", () => {
    const oldLimit = historyLimit;
    historyLimit += historyPage;
    renderJournalHistory(store.load());
    historyList.children[oldLimit]?.querySelector("summary")?.focus();
  });

  function askConfirmation(title, description, action, run) {
    byId("growth-confirm-title").textContent = title;
    byId("growth-confirm-copy").textContent = description;
    byId("growth-confirm-action").textContent = action;
    confirmDialog.returnValue = "";
    confirmation = run;
    confirmDialog.showModal();
  }

  confirmDialog.addEventListener("close", () => {
    const run = confirmation;
    confirmation = null;
    if (confirmDialog.returnValue === "confirm") run?.();
  });

  historyList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-entry-id]");
    if (!button) return;
    askConfirmation("Delete this journal entry?", "This reflection and its contribution to your progress will be removed from your account.", "Delete entry", async () => {
      try {
        const state = store.update((current) => {
          current.activities = current.activities.filter((entry) => entry.kind !== "journal" || entry.id !== button.dataset.entryId);
        });
        await Storage.flush();
        renderJournalHistory(state);
        status(journalStatus, "Journal entry deleted.");
        byId("growth-entry-list-title").focus();
        broadcastChange();
      } catch {
        status(journalStatus, "Couldn’t delete the entry. Try again.", "error");
      }
    });
  });

  byId("growth-draft-discard").addEventListener("click", () => {
    askConfirmation("Discard this earlier draft?", "This unfinished response will be removed. Today’s prompt will open.", "Discard draft", () => {
      try {
        const state = store.update((current) => {
          if (current.drafts.writing?.prompt?.id === displayedPrompt.id) delete current.drafts.writing;
        });
        clearTimeout(pending.writing);
        dirty.writing = false;
        renderWriting(state);
        status(writingStatus, "Earlier draft discarded.");
        if (displayedWriting) writingSaved.querySelector("summary").focus();
        else writingField.focus();
      } catch {
        status(writingStatus, "Couldn’t discard the draft. Try again.", "error");
      }
    });
  });

  preferencesForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const preferences = Object.fromEntries(new FormData(preferencesForm));
    if (!persistDraft("writing") || !persistDraft("journal")) {
      return status(preferenceStatus, "Finish saving your open drafts before changing preferences.", "error");
    }
    try {
      const state = store.update((current) => { current.preferences = preferences; });
      if (!writingField.value.trim() && !displayedWriting) renderWriting(state);
      if (!journalField.value.trim()) renderJournalDraft(state);
      status(preferenceStatus, "Your preferences are saved.");
    } catch {
      status(preferenceStatus, "Couldn’t save your preferences. Try again.", "error");
    }
  });

  byId("growth-clear").addEventListener("click", () => {
    askConfirmation("Clear your Growth data?", "This removes Growth drafts, journal entries, practice history, and preferences from your account.", "Clear Growth data", async () => {
      try {
        cancelPendingDrafts();
        store.clear();
        await Storage.flush();
      } catch {
        return status(dataStatus, "Couldn’t clear your Growth data. Try again.", "error");
      }
      historyLimit = historyPage;
      const state = store.load();
      renderWriting(state);
      renderJournalDraft(state);
      renderJournalHistory(state);
      renderPreferences(state);
      for (const target of [writingStatus, journalStatus, preferenceStatus]) status(target);
      status(dataStatus, "Growth data cleared from your account.");
      document.dispatchEvent(new Event("growth:reset"));
      broadcastChange();
    });
  });

  function cancelPendingDrafts() {
    requestRevision++;
    for (const kind of Object.keys(pending)) {
      clearTimeout(pending[kind]);
      dirty[kind] = false;
    }
  }

  window.addEventListener("storage", (event) => {
    if (event.key === "sg_student" || event.key === null ||
      (event.newValue === null && event.key.startsWith("sg_growth_v1:"))) cancelPendingDrafts();
  });

  window.addEventListener("pagehide", () => {
    persistDraft("writing");
    persistDraft("journal");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      persistDraft("writing");
      persistDraft("journal");
      return;
    }
    const current = store.load();
    if (!dirty.writing && store.daily(current).id !== displayedDay) {
      renderWriting(current);
      status(writingStatus);
    }
    renderProgress(current);
  });
  window.addEventListener("beforeunload", (event) => {
    const savedWriting = persistDraft("writing");
    const savedJournal = persistDraft("journal");
    if (savedWriting && savedJournal) return;
    event.preventDefault();
    event.returnValue = true;
  });

  function highlightIndex() {
    const target = window.location.hash || "#growth-writing";
    for (const link of document.querySelectorAll(".growth-index a")) {
      if (link.hash === target) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
  }

  document.addEventListener("growth:change", () => renderProgress(store.load()));
  window.addEventListener("hashchange", highlightIndex);
  highlightIndex();
  const state = store.load();
  renderWriting(state);
  renderJournalDraft(state);
  renderJournalHistory(state);
  renderPreferences(state);
  renderProgress(state);
});
