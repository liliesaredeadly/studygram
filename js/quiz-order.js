const QUIZ_LEVELS = ["easy", "medium", "hard"];

function shuffledQuizItems(items) {
  const shuffled = items.slice();
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}

function mixQuizOptions(questions) {
  const slotsByOptionCount = new Map();
  const relativeChoice = /\b(?:all|none) of (?:the )?(?:above|below)\b/i;
  const letterChoice = /\b(?:[Oo]ption|[Cc]hoice|[Aa]nswer) [A-D]\b|\b[A-D] (?:and|or|nor) [A-D]\b/;

  return questions.map(question => {
    const { options, correctIndex } = question;
    if (!Array.isArray(options) || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      return question;
    }
    // Some older questions refer to the original letters or the options above them.
    if ([question.question, question.explanation, ...options].some(text => relativeChoice.test(text) || letterChoice.test(text))) {
      return question;
    }

    let slots = slotsByOptionCount.get(options.length);
    if (!slots?.length) {
      slots = shuffledQuizItems(Array.from({ length: options.length }, (_, index) => index));
      slotsByOptionCount.set(options.length, slots);
    }
    const nextCorrectIndex = slots.pop();
    const shuffled = shuffledQuizItems(options.filter((_, index) => index !== correctIndex));
    shuffled.splice(nextCorrectIndex, 0, options[correctIndex]);
    return { ...question, options: shuffled, correctIndex: nextCorrectIndex };
  });
}

function quizDifficulty(question) {
  const difficulty = typeof question.difficulty === "string" ? question.difficulty.toLowerCase() : "";
  return QUIZ_LEVELS.includes(difficulty) ? difficulty : "easy";
}

function nextQuizIndex(questions, seen, currentIndex = -1, correct = false) {
  const remaining = questions.map((_, index) => index).filter(index => !seen.has(index));
  const current = questions[currentIndex];
  const level = question => QUIZ_LEVELS.indexOf(quizDifficulty(question));
  const currentLevel = current ? level(current) : 0;
  const target = current && correct ? Math.min(currentLevel + 1, 2) : currentLevel;

  if (!current) {
    const first = remaining.find(index => quizDifficulty(questions[index]) === "easy"
      && remaining.some(other => other !== index && quizDifficulty(questions[other]) === "easy"
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
