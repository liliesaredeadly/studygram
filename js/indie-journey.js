(typeof StudygramPrivateSession === "undefined" ? callback => callback() : StudygramPrivateSession.start)(() => {
  const stats = document.getElementById("indie-journey-stats");
  const progressLabel = document.getElementById("indie-progress-label");
  const progressMeter = document.getElementById("indie-progress-meter");
  const achievements = document.getElementById("indie-achievements");
  const achievementSummary = document.getElementById("indie-milestone-count");
  const passport = document.getElementById("indie-passport-label");
  const topicList = document.getElementById("topics-list");

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function link(label, href) {
    const node = element("a", label);
    node.href = href;
    return node;
  }

  function quizAccuracy(scores) {
    let correct = 0;
    let questions = 0;
    for (const score of scores) {
      if (!Number.isInteger(score.correct) || !Number.isInteger(score.total) ||
          score.correct < 0 || score.total <= 0 || score.correct > score.total) continue;
      correct += score.correct;
      questions += score.total;
    }
    return questions ? `${Math.round(correct / questions * 100)}%` : "—";
  }

  function renderTopics(topics, completed, latestScores) {
    if (topics.length === 0) {
      const empty = element("article", "", "indie-study-set");
      const actions = element("div", "", "indie-study-actions");
      actions.append(link("New study set ↗", "pages/study.html"));
      empty.append(
        element("h3", "No study sets yet"),
        element("p", "Add a topic and your notes, or try the K-map sample."),
        actions
      );
      topicList.replaceChildren(empty);
      return;
    }

    const cards = topics.map(topic => {
      const id = encodeURIComponent(topic.id);
      const score = latestScores.get(topic.id);
      const summary = String(topic.sourceText || "");
      const card = element("article", "", "indie-study-set");
      const actions = element("div", "", "indie-study-actions");
      card.append(element("h3", topic.name || "Untitled study set"));
      if (completed.has(topic.id)) card.append(element("small", "✓ Lesson completed", "indie-study-done"));
      if (summary) {
        card.append(element("p", summary.length > 100 ? `${summary.slice(0, 100)}…` : summary));
      }
      actions.append(
        link("Learn ↗", `pages/lesson.html?topicId=${id}`),
        link(score ? `Quiz (${score.correct}/${score.total}) ↗` : "Quiz ↗", `pages/quiz.html?topicId=${id}`)
      );
      card.append(actions);
      return card;
    });
    topicList.replaceChildren(...cards);
  }

  function renderJourney() {
    const topics = Storage.getTopics();
    const scores = Storage.getQuizScores();
    const diary = Storage.getDiaryEntries();
    const completed = new Set(Storage.getCompletedLessons());
    const completedSets = topics.filter(topic => completed.has(topic.id)).length;
    const { streak, milestones } = Storage.getLearningProgress({ topics, completed, scores, diary });

    const tiles = [
      ["Completed lessons", completed.size],
      ["Quiz accuracy", quizAccuracy(scores), `${scores.length} ${scores.length === 1 ? "quiz" : "quizzes"} taken`],
      ["Daily streak", `${streak.current} ${streak.current === 1 ? "day" : "days"}`],
      ["Diary entries", diary.length],
    ];
    stats.replaceChildren(...tiles.map(([label, value, note]) => {
      const tile = element("div", "", "indie-stat");
      const number = element("dd", String(value));
      if (note) number.append(element("small", note, "indie-stat-note"));
      tile.append(element("dt", label), number);
      return tile;
    }));

    progressMeter.max = topics.length || 1;
    progressMeter.value = completedSets;
    progressLabel.textContent = topics.length
      ? `${completedSets} of ${topics.length} study sets complete`
      : "Start a study set to track your progress.";

    achievementSummary.textContent = `${milestones.length} ${milestones.length === 1 ? "milestone" : "milestones"} reached`;
    const earned = milestones.map(label => element("li", label, "indie-achievement"));
    achievements.replaceChildren(...(earned.length ? earned : [
      element("li", "Create a study set to earn your first milestone.", "indie-achievement"),
    ]));

    const name = Storage.getStudentProfile()?.name?.trim().split(/\s+/)[0];
    passport.textContent = name ? `${name}’s Student Passport` : "Student Passport";
    renderTopics(topics, completed, new Map(scores.map(score => [score.topicId, score])));
  }

  renderJourney();
  window.addEventListener("pageshow", event => {
    if (event.persisted) renderJourney();
  });
  window.addEventListener("storage", event => {
    if (event.key === null || event.key.startsWith("sg_")) renderJourney();
  });
});
