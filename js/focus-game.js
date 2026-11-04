function isFocusText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlayableFocusCard(card) {
  return card && isFocusText(card.question) && isFocusText(card.explanation) &&
    Array.isArray(card.options) && card.options.length === 4 &&
    Array.from(card.options).every(isFocusText) &&
    Number.isInteger(card.correctIndex) && card.correctIndex >= 0 && card.correctIndex < 4;
}

function selectFocusQuestions(questions) {
  const cards = Array.isArray(questions) ? questions.filter(isPlayableFocusCard) : [];
  const selected = [];
  const remaining = [];
  const concepts = new Set();
  for (const card of cards) {
    const concept = isFocusText(card.concept) ? card.concept.trim().toLowerCase() : "";
    if (!concept || concepts.has(concept)) {
      remaining.push(card);
      continue;
    }
    selected.push(card);
    concepts.add(concept);
    if (selected.length === 3) return selected;
  }
  return selected.concat(remaining.slice(0, 3 - selected.length));
}

function resolveFocusSources(topics, requestedTopicId, sample) {
  const sources = [];
  const ids = new Set();
  let lessonTopicId = null;
  let selectedSourceId = "sample";
  for (const topic of Array.isArray(topics) ? topics : []) {
    if (!topic || !Number.isSafeInteger(topic.id) || topic.id <= 0 || ids.has(topic.id)) continue;
    ids.add(topic.id);
    if (String(topic.id) === String(requestedTopicId)) lessonTopicId = topic.id;
    const questions = selectFocusQuestions(topic.content?.questions);
    if (questions.length === 0) continue;
    sources.push({ id: topic.id, name: isFocusText(topic.name) ? topic.name : "Untitled study set", questions });
    if (topic.id === lessonTopicId) selectedSourceId = topic.id;
  }
  sources.push({ id: "sample", name: sample.name, questions: selectFocusQuestions(sample.content?.questions) });
  return { lessonTopicId, sources, selectedSourceId };
}

function answerFocusCard(round, optionIndex) {
  const card = round.questions[round.index];
  if (!card || !Number.isInteger(optionIndex) || optionIndex < 0 ||
      optionIndex >= card.options.length || round.answers[round.index] !== undefined) return round;
  const answers = round.answers.slice();
  answers[round.index] = optionIndex;
  return { ...round, answers };
}
