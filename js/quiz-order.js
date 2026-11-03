const QUIZ_LEVELS = ["easy", "medium", "hard"];

function nextQuizIndex(questions, seen, currentIndex = -1, correct = false) {
  const remaining = questions.map((_, index) => index).filter(index => !seen.has(index));
  const current = questions[currentIndex];
  const level = question => QUIZ_LEVELS.indexOf(question.difficulty);
  const currentLevel = current ? level(current) : 0;
  const target = current && correct ? Math.min(currentLevel + 1, 2) : currentLevel;

  if (!current) {
    const first = remaining.find(index => questions[index].difficulty === "easy"
      && remaining.some(other => other !== index && questions[other].difficulty === "easy"
        && questions[other].concept === questions[index].concept));
    if (first !== undefined) return first;
  }

  if (current && !correct) {
    const retry = remaining.find(index => {
      const question = questions[index];
      return question.concept === current.concept && level(question) <= currentLevel;
    });
    if (retry !== undefined) return retry;
  }

  remaining.sort((a, b) =>
    Math.abs(level(questions[a]) - target) - Math.abs(level(questions[b]) - target));
  return remaining[0] ?? -1;
}
