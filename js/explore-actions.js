const ExploreActions = (() => {
  const categories = [...EXPLORE_HUMANITIES, ...EXPLORE_STEM];
  const categoryHints = [
    ["defence", /\b(?:army|navy|defen[cs]e|military|aviation)\b/i],
    ["arts", /\b(?:art|painting|sketch|photography|architecture|fashion|sculpture)\b/i],
    ["music", /\b(?:music|singing|piano|instrument|rhythm)\b/i],
    ["literature", /\b(?:poetry|poem|storytelling|novel|language|author)\b/i],
    ["science", /\b(?:physics|chemistry|biology|astronomy|mathematics|science)\b/i],
    ["technology", /\b(?:ai|programming|coding|cybersecurity|electronics|technology)\b/i],
    ["research", /\b(?:research|invention|innovation|prototype)\b/i],
  ];
  const guides = [
    {
      category: "defence", match: /\b(?:air force|afcat|iaf)\b/i,
      reply: "Start by comparing the Indian Air Force’s flying and ground duty roles. The right entry route depends on your education and the role you want. Use the official recruitment links in Career Paths for current eligibility and dates.",
      steps: ["Pick a role to learn about.", "Compare the education and entry routes listed by the Indian Air Force.", "Choose one subject or skill you can work on this month."],
    },
    {
      category: "music", match: /\bguitar\b/i,
      reply: "Begin with a tuned guitar, a steady beat, and two open chords. Practise slowly enough that each note rings clearly, then try a short chord change in rhythm.",
      steps: ["Learn to tune the six strings.", "Practise two beginner chords such as Em and Am.", "Set a slow beat and switch between them every four counts."],
    },
    {
      category: "research", match: /\b(?:researcher|research paper|research career)\b/i,
      reply: "A researcher turns a question into something they can investigate. They read previous work, collect or analyse evidence, and share what the evidence can and cannot support.",
      steps: ["Write a question you can investigate at home or school.", "Find one credible source and write down what it already explains.", "Plan a small comparison and record the results and limitations."],
    },
    {
      category: "science", match: /\bscientist\b/i,
      reply: "Start with a branch of science that makes you curious. Learn its core ideas, practise measuring and explaining what you observe, and try a small investigation before narrowing your interests.",
      steps: ["Pick a topic such as motion, plants, or space.", "Make a prediction and test it with a simple, safe activity.", "Compare relevant school subjects and degree options in Career Paths."],
    },
    {
      category: "technology", match: /\brobot(?:s|ics)?\b/i,
      reply: "Build a small robot idea around one input and one output. For example, a simulated distance sensor can tell a virtual robot when to stop. A simulator lets you test the logic before you need hardware.",
      steps: ["Sketch the input, decision, and output.", "Write a simple if–then rule in a block editor or simulator.", "Test the rule with several distances, then improve one thing."],
    },
  ];

  function openActivity(category, page) {
    if (typeof StudygramPrivateSession !== "undefined" && !StudygramPrivateSession.requireAccount()) return;
    const existing = Storage.getTopics().find(topic => topic.exploreCategory === category.id && topic.content);
    const topic = existing || Storage.saveStudySet({
      name: `${category.lesson.title} · Explore`,
      sourceText: category.tagline,
      exploreCategory: category.id,
      content: { scenes: category.lesson.scenes, questions: category.questions },
    });
    const navigate = () => window.location.assign(`${page}.html?topicId=${encodeURIComponent(topic.id)}`);
    return typeof StudygramPrivateSession === "undefined" ? navigate() : Storage.flush().then(navigate);
  }

  async function ask({ category: selected, message }) {
    const question = message.trim();
    if (!question || question.length > 800) throw new Error("Enter a question of up to 800 characters.");
    const selectedCategory = categories.find(item => item.id === selected);
    const guide = guides.find(item => (!selectedCategory || item.category === selectedCategory.id) && item.match.test(question));
    const inferred = guide?.category || categoryHints.find(([, match]) => match.test(question))?.[0];
    const category = selectedCategory || categories.find(item => item.id === (inferred || "science"));
    try {
      const { reply, steps } = await requestStudygramAI("explore", { category: category.id, message: question });
      return { reply, steps, mode: "live", category: category.title };
    } catch {
      return {
        reply: guide?.reply || `Here’s a starter path for ${category.title}. Try one small activity, then use what you learn to choose your next question.`,
        steps: guide?.steps || category.path,
        mode: "guide",
        category: category.title,
      };
    }
  }

  return {
    openLesson: category => openActivity(category, "lesson"),
    openQuiz: category => openActivity(category, "quiz"),
    ask,
  };
})();
