// ============================================================
// storage.js — All localStorage read/write helpers
// ============================================================
// localStorage stores data in the user's browser — it stays
// even after the page refreshes. Think of it as a simple
// key-value database that lives on the user's device.
// ============================================================

/** Generate a unique student passport number, e.g. SG-2024-7842 */
function generateStudentId() {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SG-${year}-${rand}`;
}

const Storage = {

  // ---------- Student Profile (sign-in / ID card) ----------

  /** Save a student's profile after sign-in */
  saveStudentProfile(profile) {
    localStorage.setItem("sg_student", JSON.stringify({
      ...profile,
      joinedDate: new Date().toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" }),
      studentId: profile.studentId || generateStudentId()
    }));
  },

  /** Get the saved student profile (or null if not signed in) */
  getStudentProfile() {
    return JSON.parse(localStorage.getItem("sg_student") || "null");
  },

  /** Remove the student profile (sign out) */
  clearStudentProfile() {
    localStorage.removeItem("sg_student");
  },

  /** Is a student currently signed in? */
  isSignedIn() {
    return !!localStorage.getItem("sg_student");
  },

  // ---------- Study sets ----------

  /** Save a new topic to the list */
  saveStudySet({ name, sourceText = "", focus = "", content }) {
    const topics = this.getTopics();
    let id = Date.now();
    while (topics.some(topic => topic.id === id)) id++;
    const studySet = { id, name, sourceText, focus, content };
    topics.push(studySet);
    localStorage.setItem("sg_topics", JSON.stringify(topics));
    return studySet;
  },

  saveStudyContent(id, content) {
    const topics = this.getTopics();
    const topic = topics.find(item => item.id === Number(id));
    if (!topic) return;
    topic.content = content;
    localStorage.setItem("sg_topics", JSON.stringify(topics));
  },

  /** Get all saved topics */
  getTopics() {
    return JSON.parse(localStorage.getItem("sg_topics") || "[]").map(topic => ({
      ...topic,
      sourceText: topic.sourceText ?? topic.originalSummary ?? topic.summary ?? "",
    }));
  },

  /** Get a single topic by its id */
  getTopicById(id) {
    return this.getTopics().find(t => t.id === Number(id));
  },

  /** Delete a topic by id */
  deleteTopic(id) {
    const topics = this.getTopics().filter(t => t.id !== Number(id));
    localStorage.setItem("sg_topics", JSON.stringify(topics));
  },


  // ---------- Quiz Scores ----------

  /** Save a quiz result */
  saveQuizScore(score) {
    const scores = this.getQuizScores();
    scores.push({ ...score, id: Date.now(), date: new Date().toLocaleDateString() });
    localStorage.setItem("sg_scores", JSON.stringify(scores));
  },

  /** Get all quiz scores */
  getQuizScores() {
    return JSON.parse(localStorage.getItem("sg_scores") || "[]");
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
    localStorage.setItem("sg_diary", JSON.stringify(entries));
  },

  /** Get all diary entries */
  getDiaryEntries() {
    return JSON.parse(localStorage.getItem("sg_diary") || "[]");
  },


  // ---------- Progress Tracking ----------

  /** Mark a lesson as completed */
  markLessonComplete(topicId) {
    const done = this.getCompletedLessons();
    if (!done.includes(topicId)) {
      done.push(topicId);
      localStorage.setItem("sg_lessons_done", JSON.stringify(done));
    }
  },

  /** Get list of completed topic IDs */
  getCompletedLessons() {
    return JSON.parse(localStorage.getItem("sg_lessons_done") || "[]");
  },

  /** Check if a lesson is complete */
  isLessonComplete(topicId) {
    return this.getCompletedLessons().includes(topicId);
  },


  // ---------- Utility ----------

  /** Clear everything (use with caution!) */
  clearAll() {
    ["sg_topics", "sg_scores", "sg_diary", "sg_lessons_done"].forEach(k => localStorage.removeItem(k));
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
