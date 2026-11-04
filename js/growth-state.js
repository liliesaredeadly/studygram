const GrowthStore = (() => {
  const PREFIX = 'sg_growth_v1:';
  const DAY_MS = 86400000;
  const KINDS = ['writing', 'focus', 'journal', 'recall'];
  const THEMES = [
    { key: 'academics', category: 'Academic experiences', prompts: [
      'Choose a topic you are learning. How would you explain its most useful idea to a friend?',
      'Pick a question from a recent lesson. Explain how you would work toward an answer.'
    ] },
    { key: 'creativity', category: 'Creativity', prompts: [
      'Invent a new use for an object on your desk. Describe who would use it and what it would help them do.',
      'Imagine a room designed for curiosity. Describe what someone would discover when they walk in.'
    ] },
    { key: 'communication', category: 'Communication', prompts: [
      'Describe a time a clear explanation helped you understand something. What made the explanation work?',
      'Imagine you and a friend interpret the same message differently. Write what you could say to understand each other.'
    ] },
    { key: 'self-confidence', category: 'Self-confidence', prompts: [
      'Think of a skill that once felt unfamiliar. Describe one small piece of evidence that shows what you have learned.',
      'Write about something you tried before you felt ready. What did the experience teach you about starting?'
    ] },
    { key: 'philosophy', category: 'Philosophy', prompts: [
      'What makes a question worth asking? Use an example to explain your answer.',
      'What does it mean to listen well? Describe a situation that puts your definition to the test.'
    ] },
    { key: 'science', category: 'Critical thinking', prompts: [
      'Choose an everyday phenomenon that makes you curious. What evidence could help you choose between two explanations?',
      'Think of a surprising claim about nature. What would you check before deciding whether to believe it?'
    ] },
    { key: 'decision-making', category: 'Decision-making', prompts: [
      'Think of a small decision with two reasonable choices. Explain what would help you choose between them.',
      'Imagine your group has an hour to finish a project. What would you prioritize, and what would you save for later?'
    ] },
    { key: 'emotional-awareness', category: 'Emotional awareness', prompts: [
      'Think of a small moment that helped you feel settled. Describe one detail that made a difference.',
      'Imagine two friends feeling differently about the same new experience. What might each of them notice first?'
    ] },
    { key: 'personal-ambitions', category: 'Personal ambitions', prompts: [
      'What is a skill or project you would like to try someday? Describe one small step you could take toward it.',
      'Imagine you have an afternoon to work on something that matters to you. What would you choose and why?'
    ] }
  ];
  const APPROACHES = {
    story: 'Frame your answer as a short scene or story.',
    practical: 'Include a concrete example someone could try.',
    debate: 'Consider a second viewpoint and explain where you land.'
  };
  const GOALS = {
    express: 'Choose one sentence that expresses your main idea clearly.',
    focus: 'Stay with one main idea and choose details that support it.',
    reflect: 'End with a question or something you noticed while writing.'
  };
  const LEVELS = [
    { level: 'Beginner', min: 2, max: 3, instruction: '' },
    { level: 'Intermediate', min: 4, max: 5, instruction: 'Add a specific detail that supports your thinking.' },
    { level: 'Advanced', min: 6, max: 8, instruction: 'Explore a complication that makes the question worth thinking about.' }
  ];
  const ENCOURAGEMENT = {
    writing: [
      'One sentence is a place to start.',
      'Your first saved response gives you something to return to.',
      'You have another response to revisit if you want to see how you approached the prompt.',
      'Each saved response keeps a record of what you were thinking that day.'
    ],
    focus: [
      'Choose a short stretch of time and one thing to work on.',
      'You set aside time for a task and logged your first sprint.',
      'You logged another block of time for focused work.',
      'Your completed sprints show the time you chose to make for a task.'
    ],
    journal: [
      'If you feel like reflecting, a few words are enough to begin.',
      'You saved a moment you can revisit whenever you choose.',
      'You made room for another reflection.',
      'Your entries give you a private place to revisit what you noticed.'
    ],
    recall: [
      'Try putting one idea you remember into your own words.',
      'You made a record of what you could recall this time.',
      'You gave another idea a chance to come back to mind.',
      'Your saved responses give you examples to compare when you revisit a topic.'
    ]
  };

  function storageKey() {
    if (typeof StudygramPrivateSession !== 'undefined') return 'sg_growth_v1';
    let studentId;
    try {
      studentId = typeof Storage === 'undefined' ? null : Storage.getStudentProfile?.()?.studentId;
    } catch {
      studentId = null;
    }
    return studentId == null || studentId === ''
      ? `${PREFIX}guest`
      : `${PREFIX}student:${studentId}`;
  }

  function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function read(key) {
    let saved;
    try {
      saved = JSON.parse(typeof document === 'undefined' ? localStorage.getItem(key) : Storage.getPrivateValue(key));
    } catch {
      saved = null;
    }
    const preferences = saved?.preferences;
    return {
      preferences: {
        interest: typeof preferences?.interest === 'string' ? preferences.interest : '',
        approach: typeof preferences?.approach === 'string' ? preferences.approach : '',
        goal: typeof preferences?.goal === 'string' ? preferences.goal : ''
      },
      drafts: isRecord(saved?.drafts) ? saved.drafts : {},
      activities: recordedActivities(saved?.activities)
    };
  }

  function load() {
    return read(storageKey());
  }

  function update(mutator) {
    const key = storageKey();
    const state = read(key);
    mutator(state);
    if (typeof document === 'undefined') localStorage.setItem(key, JSON.stringify(state));
    else Storage.setPrivateValue(key, JSON.stringify(state));
    return state;
  }

  function clear() {
    if (typeof document === 'undefined') localStorage.removeItem(storageKey());
    else Storage.setPrivateValue(storageKey(), null);
  }

  function recordedActivities(activities) {
    if (!Array.isArray(activities)) return [];
    const seen = new Set();
    return activities.filter(activity => {
      if (!KINDS.includes(activity?.kind) || !activity.id || seen.has(activity.id) ||
          !Number.isFinite(activity.at) || !Number.isFinite(new Date(activity.at).getTime())) return false;
      seen.add(activity.id);
      return true;
    });
  }

  function dayId(value) {
    const date = new Date(value);
    const year = String(date.getFullYear()).padStart(4, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function usesPrompt(prompt, id) {
    return prompt?.id === id && typeof prompt.text === 'string' && Boolean(prompt.text.trim()) &&
      typeof prompt.category === 'string' && LEVELS.some(level => level.level === prompt.level) &&
      Number.isFinite(prompt.min) && Number.isFinite(prompt.max) && prompt.min > 0 && prompt.max >= prompt.min;
  }

  function rotate(items, day) {
    return items[((day % items.length) + items.length) % items.length];
  }

  function daily(state, now = Date.now()) {
    const id = dayId(now);
    const writing = recordedActivities(state.activities).filter(activity => activity.kind === 'writing');
    const completed = writing.find(activity => usesPrompt(activity.prompt, id));
    if (completed) return completed.prompt;
    const draftPrompt = state.drafts?.writing?.prompt;
    if (usesPrompt(draftPrompt, id)) return draftPrompt;

    const preferences = state.preferences ?? {};
    const preferred = THEMES.find(theme => theme.key === preferences.interest);
    // Rotate by local calendar days, even when a daylight saving transition changes the day length.
    const day = Math.floor(Date.parse(id) / DAY_MS);
    const pair = Math.floor(day / 2);
    let theme = rotate(THEMES, day);
    if (preferred) {
      theme = day % 2 === 0 ? preferred : rotate(THEMES.filter(other => other !== preferred), pair);
    }

    const earlierDays = new Set(writing.map(activity => dayId(activity.at)).filter(day => day < id));
    const levelIndex = earlierDays.size >= 6 ? 2 : earlierDays.size >= 3 ? 1 : 0;
    const { level, min, max, instruction } = LEVELS[levelIndex];
    const base = rotate(theme.prompts, preferred ? pair : Math.floor(day / THEMES.length));
    const approach = Object.hasOwn(APPROACHES, preferences.approach) ? APPROACHES[preferences.approach] : '';
    const goal = Object.hasOwn(GOALS, preferences.goal) ? GOALS[preferences.goal] : '';
    const text = [base, instruction, approach, goal].filter(Boolean).join(' ');
    return { id, text, category: theme.category, level, min, max };
  }

  function progress(state, now = Date.now()) {
    const counts = { writing: 0, focus: 0, journal: 0, recall: 0 };
    const activityByDay = new Map();
    const writingDays = new Set();
    const journalDays = new Set();
    let confidence = false;
    for (const activity of recordedActivities(state.activities)) {
      if (activity.at > now) continue;
      const day = dayId(activity.at);
      counts[activity.kind] += 1;
      activityByDay.set(day, (activityByDay.get(day) ?? 0) + 1);
      if (activity.kind === 'writing') {
        writingDays.add(day);
        confidence ||= activity.prompt?.category === 'Self-confidence';
      }
      if (activity.kind === 'journal') journalDays.add(day);
    }

    const days = activityByDay.size;
    const today = new Date(now);
    const week = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - 6 + index);
      return { label: date.toLocaleDateString('en', { weekday: 'short' }), count: activityByDay.get(dayId(date)) ?? 0 };
    });
    const milestones = [
      ['First Thoughts', 'Save a writing response or journal reflection.', counts.writing + counts.journal >= 1],
      ['Finding My Voice', 'Write on three different days.', writingDays.size >= 3],
      ['Focus Explorer', 'Complete two focus sprints.', counts.focus >= 2],
      ['Confidence Builder', 'Save a response to a self-confidence prompt.', confidence],
      ['Consistency Champion', 'Log an activity on seven different days.', days >= 7],
      ['Master of Reflection', 'Save journal reflections on five different days.', journalDays.size >= 5]
    ].map(([title, description, earned]) => ({ title, description, earned }));
    return { counts, days, week, milestones };
  }

  function encouragement(kind, stats) {
    const activity = KINDS.includes(kind) ? kind : 'writing';
    const count = stats?.counts?.[activity] ?? 0;
    const messages = ENCOURAGEMENT[activity];
    return messages[count <= 1 ? Math.max(0, count) : 2 + count % 2];
  }

  return { load, update, clear, daily, progress, encouragement };
})();
