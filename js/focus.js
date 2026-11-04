(typeof StudygramPrivateSession === "undefined" ? callback => callback() : StudygramPrivateSession.start)(() => {
  const byId = id => document.getElementById(id);
  const timerKey = `sg_focus_timer_v1:${StudygramPrivateSession.user().id}`;
  const clock = byId("focus-clock");
  const timerAction = byId("focus-timer-action");
  const reset = byId("focus-reset");
  const timerStatus = byId("focus-timer-status");
  const presets = [...byId("focus-presets").querySelectorAll("[data-minutes]")];
  const actions = { idle: "Start", running: "Pause", paused: "Resume", finished: "Start" };
  const statusCopy = {
    idle: "Ready when you are.",
    running: "Sprint in progress.",
    paused: "Sprint paused.",
    finished: "Sprint complete. Take a break or try Quick Play.",
  };
  let interval = null;
  let timer;
  let storageCurrent = true;

  function storeTimer() {
    try {
      sessionStorage.setItem(timerKey, JSON.stringify(timer));
      storageCurrent = true;
    } catch {
      storageCurrent = false;
    }
  }

  function readTimer() {
    if (!storageCurrent && timer) return;
    let saved;
    try {
      saved = JSON.parse(sessionStorage.getItem(timerKey));
    } catch {
      if (timer) return;
    }
    timer = restoreFocusTimer(saved, Date.now());
    if (saved?.status === "running" && timer.status === "finished") storeTimer();
  }

  function renderTimer(now) {
    const seconds = Math.ceil(focusTimeLeft(timer, now) / 1000);
    const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
    const ss = String(seconds % 60).padStart(2, "0");
    const time = mm + ":" + ss;
    if (clock.textContent !== time) clock.textContent = time;
    const label = actions[timer.status];
    if (timerAction.textContent !== label) timerAction.textContent = label;
    const status = statusCopy[timer.status];
    if (timerStatus.textContent !== status) timerStatus.textContent = status;
    reset.disabled = timer.status === "idle";
    for (const button of presets) {
      button.disabled = timer.status === "running" || timer.status === "paused";
      button.setAttribute("aria-pressed", String(Number(button.dataset.minutes) * 60000 === timer.durationMs));
    }
    if (timer.status === "running" && interval === null) {
      interval = window.setInterval(() => dispatch({ type: "tick" }), 250);
    } else if (timer.status !== "running" && interval !== null) {
      window.clearInterval(interval);
      interval = null;
    }
  }

  function dispatch(action) {
    const now = Date.now();
    const next = updateFocusTimer(timer, action, now);
    if (next !== timer) {
      timer = next;
      storeTimer();
    }
    renderTimer(now);
  }

  readTimer();
  renderTimer(Date.now());
  timerAction.addEventListener("click", () => dispatch({ type: actions[timer.status].toLowerCase() }));
  reset.addEventListener("click", () => {
    dispatch({ type: "reset" });
    timerAction.focus();
  });
  for (const button of presets) {
    button.addEventListener("click", () => dispatch({ type: "select", minutes: Number(button.dataset.minutes) }));
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      readTimer();
      dispatch({ type: "tick" });
    }
  });
  window.addEventListener("pagehide", () => {
    if (interval !== null) window.clearInterval(interval);
    interval = null;
  });
  window.addEventListener("pageshow", event => {
    if (event.persisted) {
      readTimer();
      dispatch({ type: "tick" });
    }
  });

  const returnLink = byId("focus-return");
  const picker = byId("focus-source");
  const sourceNote = byId("focus-source-note");
  const roundPanel = byId("focus-round");
  const count = byId("focus-card-count");
  const question = byId("focus-question");
  const options = byId("focus-options");
  const feedback = byId("focus-feedback");
  const nextCard = byId("focus-next");
  const result = byId("focus-result");
  const score = byId("focus-score");
  let topics;
  try {
    topics = Storage.getTopics();
  } catch {
    topics = [];
  }

  const requestedTopicId = new URLSearchParams(location.search).get("topicId");
  const { lessonTopicId, sources, selectedSourceId } = resolveFocusSources(topics, requestedTopicId, KMAP_SAMPLE);
  if (lessonTopicId != null) {
    returnLink.href = "lesson.html?" + new URLSearchParams({ topicId: lessonTopicId });
    returnLink.textContent = "Back to lesson";
  }
  for (const source of sources) {
    const option = document.createElement("option");
    option.value = String(source.id);
    option.textContent = source.id === "sample" ? "K-map wraparound (built-in sample)" : source.name;
    picker.append(option);
  }
  picker.value = String(selectedSourceId);
  if (requestedTopicId && selectedSourceId === "sample") {
    sourceNote.hidden = false;
    sourceNote.textContent = lessonTopicId == null
      ? "This lesson is no longer available. You can play the K-map sample."
      : "This lesson has no Quick Play questions. You can play the K-map sample.";
    picker.setAttribute("aria-describedby", sourceNote.id);
  }

  let round;
  function showCard(moveFocus) {
    const card = round.questions[round.index];
    count.textContent = "Question " + (round.index + 1) + " of " + round.questions.length;
    question.textContent = card.question;
    options.replaceChildren();
    feedback.hidden = true;
    nextCard.hidden = true;
    card.options.forEach((label, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-secondary";
      button.textContent = label;
      button.addEventListener("click", () => chooseAnswer(index));
      options.append(button);
    });
    if (moveFocus) question.focus();
  }

  function chooseAnswer(index) {
    const answered = answerFocusCard(round, index);
    if (answered === round) return;
    round = answered;
    const card = round.questions[round.index];
    const correct = round.answers[round.index] === card.correctIndex;
    [...options.children].forEach((button, optionIndex) => {
      button.disabled = true;
      if (optionIndex === card.correctIndex) {
        button.classList.add("is-correct");
        button.textContent += " (Correct answer)";
      } else if (optionIndex === index) {
        button.classList.add("is-missed");
        button.textContent += " (Your answer)";
      }
    });
    feedback.textContent = (correct ? "Correct. " : "Not quite. The correct answer is " +
      card.options[card.correctIndex] + ". ") + card.explanation;
    feedback.hidden = false;
    nextCard.textContent = round.index + 1 === round.questions.length ? "See results" : "Next";
    nextCard.setAttribute("aria-describedby", feedback.id);
    nextCard.hidden = false;
    nextCard.focus();
  }

  function startRound(moveFocus) {
    const source = sources.find(item => String(item.id) === picker.value);
    round = { questions: mixQuizOptions(source?.questions ?? []), index: 0, answers: [] };
    result.hidden = true;
    roundPanel.hidden = round.questions.length === 0;
    if (round.questions.length) showCard(moveFocus);
  }

  nextCard.addEventListener("click", () => {
    if (round.answers[round.index] === undefined) return;
    if (round.index + 1 < round.questions.length) {
      round = { ...round, index: round.index + 1 };
      showCard(true);
      return;
    }
    const correct = round.questions.filter((card, index) => round.answers[index] === card.correctIndex).length;
    score.textContent = correct + " of " + round.questions.length + " correct";
    roundPanel.hidden = true;
    result.hidden = false;
    score.focus();
  });

  picker.addEventListener("change", () => startRound(false));
  byId("focus-replay").addEventListener("click", () => startRound(true));
  startRound(false);
});
