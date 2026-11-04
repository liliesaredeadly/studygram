// ============================================================
// storage.js — Private student data helpers
// ============================================================
// The browser uses the active account's in-memory copy backed by the server.
// ============================================================

/** Generate a unique student passport number, e.g. SG-2024-7842 */
function generateStudentId() {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SG-${year}-${rand}`;
}

const privateStore = typeof StudygramPrivateSession === "undefined" ? null : StudygramPrivateSession;
const legacyStore = typeof document === "undefined" && typeof localStorage !== "undefined" ? localStorage : null;

function getPrivateValue(key) {
  return privateStore ? privateStore.get(key) : legacyStore?.getItem(key) ?? null;
}

function setPrivateValue(key, value) {
  if (privateStore) return privateStore.set(key, value);
  if (!legacyStore) throw new Error("Sign in to save your work.");
  if (value === null) legacyStore.removeItem(key);
  else legacyStore.setItem(key, value);
}

function readStoredJson(key) {
  try {
    return JSON.parse(getPrivateValue(key));
  } catch {
    return null;
  }
}

function readStoredArray(key) {
  const records = readStoredJson(key);
  return Array.isArray(records) ? records : [];
}

function isStoredRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function localDay(timestamp) {
  if (!Number.isFinite(timestamp)) return NaN;
  const date = new Date(timestamp);
  // Compare local calendar days without using the varying length of a DST day.
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
}

function activityStreaks(timestamps) {
  const today = localDay(Date.now());
  const days = [...new Set(timestamps.map(localDay).filter(day => day <= today))].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let previous;
  for (const day of days) {
    run = previous === day - 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  return { current: previous >= today - 1 ? run : 0, longest };
}

const learningAchievements = {
  studySet: "First study set created",
  lesson: "First lesson completed",
  quiz: "First quiz taken",
  reflection: "First reflection written",
  streak: "Three-day learning streak",
};

function earnLearningAchievement(id) {
  try {
    setPrivateValue(`sg_achievement:${id}`, "1");
  } catch {
    // Progress can still be calculated from the underlying activity.
  }
}

const Storage = {
  getPrivateValue,
  setPrivateValue,
  flush: () => privateStore?.flush() ?? Promise.resolve(),

  // ---------- Student Profile (sign-in / ID card) ----------

  /** Save a student's profile after sign-in */
  saveStudentProfile(profile) {
    setPrivateValue("sg_student", JSON.stringify({
      ...profile,
      joinedDate: profile.joinedDate || new Date().toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" }),
      studentId: profile.studentId || generateStudentId()
    }));
  },

  /** Get the saved student profile (or null if not signed in) */
  getStudentProfile() {
    const profile = readStoredJson("sg_student");
    if (!isStoredRecord(profile)) return null;
    const name = typeof profile.name === "string" ? profile.name : "";
    const studentId = typeof profile.studentId === "string" ? profile.studentId : "";
    return name.trim() || studentId.trim() ? { ...profile, name, studentId } : null;
  },

  /** Remove the student profile (sign out) */
  clearStudentProfile() {
    setPrivateValue("sg_student", null);
  },

  /** Is a student currently signed in? */
  isSignedIn() {
    return privateStore ? Boolean(privateStore.user()) : Boolean(this.getStudentProfile());
  },

  // ---------- Explore notebook ----------

  getExploreNotebookKey() {
    return privateStore ? "sg_explore_v1" : `sg_explore_v1:${this.getStudentProfile()?.studentId || "guest"}`;
  },

  getExploreNotebook() {
    const notebook = readStoredJson(this.getExploreNotebookKey());
    return {
      saved: Array.isArray(notebook?.saved) ? notebook.saved : [],
      projects: isStoredRecord(notebook?.projects) ? notebook.projects : {},
    };
  },

  // ---------- Study sets ----------

  /** Save a new topic to the list */
  saveStudySet({ name, sourceText = "", focus = "", content, exploreCategory }) {
    const topics = this.getTopics();
    let id = Date.now();
    while (topics.some(topic => topic.id === id)) id++;
    const studySet = { id, name, sourceText, focus, content };
    if (exploreCategory) studySet.exploreCategory = exploreCategory;
    topics.push(studySet);
    setPrivateValue("sg_topics", JSON.stringify(topics));
    earnLearningAchievement("studySet");
    return studySet;
  },

  saveStudyContent(id, content) {
    const topics = this.getTopics();
    const topic = topics.find(item => item.id === Number(id));
    if (!topic) return;
    topic.content = content;
    delete topic.reelId;
    setPrivateValue("sg_topics", JSON.stringify(topics));
  },

  saveStudyReel(id, reelId) {
    const topics = this.getTopics();
    const topic = topics.find(item => item.id === Number(id));
    if (!topic) return;
    topic.reelId = reelId;
    setPrivateValue("sg_topics", JSON.stringify(topics));
  },

  /** Get all saved topics */
  getTopics() {
    return readStoredArray("sg_topics")
      .filter(topic => isStoredRecord(topic) && Number.isSafeInteger(topic.id) && topic.id > 0 &&
        typeof topic.name === "string" && topic.name.trim())
      .map(topic => ({
        ...topic,
        sourceText: [topic.sourceText, topic.originalSummary, topic.summary]
          .find(source => typeof source === "string") ?? "",
      }));
  },

  /** Get a single topic by its id */
  getTopicById(id) {
    return this.getTopics().find(t => t.id === Number(id));
  },

  /** Delete a topic by id */
  deleteTopic(id) {
    const topics = this.getTopics().filter(t => t.id !== Number(id));
    setPrivateValue("sg_topics", JSON.stringify(topics));
  },


  // ---------- Quiz Scores ----------

  /** Save a quiz result */
  saveQuizScore(score) {
    const scores = this.getQuizScores();
    scores.push({ ...score, id: Date.now(), date: new Date().toLocaleDateString() });
    setPrivateValue("sg_scores", JSON.stringify(scores));
    earnLearningAchievement("quiz");
  },

  /** Get all quiz scores */
  getQuizScores() {
    return readStoredArray("sg_scores").filter(isStoredRecord);
  },

  /** Get score for a specific topic (most recent) */
  getScoreForTopic(topicId) {
    const scores = this.getQuizScores().filter(s => s.topicId === topicId);
    return scores.length ? scores[scores.length - 1] : null;
  },


  // ---------- Diary Entries ----------

  /** Save a diary entry */
  saveDiaryEntry(entry) {
    const entries = this.getDiaryEntries();
    entries.unshift({ // unshift adds to the beginning (newest first)
      id: Date.now(),
      text: entry.text,
      aiResponse: entry.aiResponse,
      date: new Date().toLocaleString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      })
    });
    setPrivateValue("sg_diary", JSON.stringify(entries));
    earnLearningAchievement("reflection");
  },

  /** Get all diary entries */
  getDiaryEntries() {
    return readStoredArray("sg_diary").filter(entry => isStoredRecord(entry) && typeof entry.text === "string");
  },


  // ---------- Progress Tracking ----------

  /** Mark a lesson as completed */
  markLessonComplete(topicId) {
    const done = this.getCompletedLessons();
    if (!done.includes(topicId)) {
      done.push(topicId);
      setPrivateValue("sg_lessons_done", JSON.stringify(done));
    }
    earnLearningAchievement("lesson");

    // Track one completed viewing per local day, including reviews.
    try {
      const activity = this.getLessonActivity();
      const now = new Date();
      if (new Date(activity.at(-1)).toDateString() !== now.toDateString()) {
        activity.push(now.getTime());
        setPrivateValue("sg_lesson_activity", JSON.stringify(activity));
      }
    } catch {
      // Completion is saved separately and still counts if the activity log is unavailable.
    }
  },

  getLessonActivity() {
    return readStoredArray("sg_lesson_activity");
  },

  /** Get list of completed topic IDs */
  getCompletedLessons() {
    return readStoredArray("sg_lessons_done");
  },

  /** Check if a lesson is complete */
  isLessonComplete(topicId) {
    return this.getCompletedLessons().includes(topicId);
  },

  /** Shared milestones and streak, with optional data already read by the caller. */
  getLearningProgress({
    topics = this.getTopics(),
    completed = new Set(this.getCompletedLessons()),
    scores = this.getQuizScores(),
    diary = this.getDiaryEntries(),
  } = {}) {
    const streak = activityStreaks([
      ...this.getLessonActivity(),
      ...scores.map(score => score.id),
      ...diary.map(entry => entry.id),
    ]);
    const eligible = {
      studySet: topics.length > 0,
      lesson: completed.size > 0,
      quiz: scores.length > 0,
      reflection: diary.length > 0,
      streak: streak.longest >= 3,
    };
    const achievementIds = [];
    for (const id of Object.keys(learningAchievements)) {
      const earned = readStoredJson(`sg_achievement:${id}`) === 1;
      if (!earned && eligible[id]) earnLearningAchievement(id);
      if (earned || eligible[id]) achievementIds.push(id);
    }
    return {
      streak,
      milestones: achievementIds.map(id => learningAchievements[id]),
      achievementPoints: achievementIds.length,
      achievementIds,
    };
  },

  linkCommunityAchievements(accountId) {
    if (privateStore) return privateStore.user()?.id === accountId;
    const key = "sg_community_achievement_owner";
    const owner = readStoredJson(key);
    if (owner !== null) return owner === accountId;
    try {
      setPrivateValue(key, JSON.stringify(accountId));
      return readStoredJson(key) === accountId;
    } catch {
      return false;
    }
  },


  // ---------- Utility ----------

  /** Clear everything (use with caution!) */
  clearAll() {
    ["sg_topics", "sg_scores", "sg_diary", "sg_lessons_done", "sg_lesson_activity"].forEach(key => setPrivateValue(key, null));
    for (const id of Object.keys(learningAchievements)) setPrivateValue(`sg_achievement:${id}`, null);
  },

  /** Get a quick stats summary for the home page */
  getStats() {
    return {
      topics:         this.getTopics().length,
      lessonsCompleted: this.getCompletedLessons().length,
      quizzesTaken:   this.getQuizScores().length,
      diaryEntries:   this.getDiaryEntries().length,
    };
  }
};
