const rooms = [
  { id: "technology", title: "Tech GC", description: "Talk about coding, robotics, and upcoming tech events." },
  { id: "research", title: "Research GC", description: "Swap research questions, compare methods, and discuss what you found." },
  { id: "study-lounge", title: "Study Lounge", description: "Ask a quick question or find someone to study with." },
];

const roomIds = new Set(rooms.map(room => room.id));
const reasons = new Set(["bullying", "personal-info", "spam", "other"]);
const dayMs = 86_400_000;
const messageLimit = 50;
const presenceWindow = 45_000;

function problem(status, message) {
  return Object.assign(new Error(message), { status });
}

function requireId(value) {
  if ((typeof value !== "number" && typeof value !== "string") || !/^[1-9]\d*$/.test(String(value))) {
    throw problem(400, "Check the message or session number.");
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id)) throw problem(400, "Check the message or session number.");
  return id;
}

function libraryIdFor(roomId) {
  if (roomIds.has(roomId)) return null;
  const library = typeof roomId === "string" && /^library:([1-9]\d*)$/.exec(roomId);
  if (!library) throw problem(404, "Room not found.");
  return requireId(library[1]);
}

function requireText(value, label, max) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > max) throw problem(400, `Enter ${label} with up to ${max} characters.`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(text)) {
    throw problem(400, "Remove unsupported control characters from your message.");
  }

  // Keep the approved event link in the stored message. Ignore it only during contact checks.
  const otherText = text.replace(/https:\/\/events\.vtools\.ieee\.org\/m\/[1-9]\d*(?=$|\s|[,!.):]+(?=$|\s))/gi, "");
  const url = /\b(?:[a-z][a-z0-9+.-]*:\/\/|www\.|(?:discord\.gg|t\.me|wa\.me)\b|[a-z0-9-]+\.(?:com|org|net)\b)/i;
  const email = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/u;
  const phone = /(?:\+\d{1,3}[ .-]+\d|\(\d{2,4}\)[ .-]*\d|\d{3}[- .]\d{3}[- .]\d{4}\b)[\d ().-]*/g;
  if (url.test(otherText) || email.test(otherText) || [...otherText.matchAll(phone)].some(([match]) => match.replace(/\D/g, "").length >= 10)) {
    throw problem(400, "Keep contact details and outside links out of the chat. IEEE event links are allowed.");
  }
  return text;
}

function createCommunityRooms(db, { now = Date.now } = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS community_library_sessions (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      creator_id INTEGER NOT NULL REFERENCES community_users(id),
      duration INTEGER NOT NULL CHECK (duration IN (25, 50)),
      started_at TEXT NOT NULL,
      ends_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS community_library_active ON community_library_sessions(ends_at);

    CREATE TABLE IF NOT EXISTS community_library_members (
      session_id INTEGER NOT NULL REFERENCES community_library_sessions(id),
      user_id INTEGER NOT NULL REFERENCES community_users(id),
      seen_at TEXT NOT NULL,
      PRIMARY KEY (session_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS community_messages (
      id INTEGER PRIMARY KEY,
      room_id TEXT NOT NULL,
      author_id INTEGER NOT NULL REFERENCES community_users(id),
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'visible' CHECK (state IN ('visible', 'queued', 'hidden', 'removed'))
    );
    CREATE INDEX IF NOT EXISTS community_messages_room ON community_messages(room_id, id);

    CREATE TABLE IF NOT EXISTS community_message_questions (
      message_id INTEGER PRIMARY KEY REFERENCES community_messages(id),
      helpful_answer_id INTEGER UNIQUE REFERENCES community_messages(id)
    );

    CREATE TABLE IF NOT EXISTS community_message_answers (
      message_id INTEGER PRIMARY KEY REFERENCES community_messages(id),
      question_id INTEGER NOT NULL REFERENCES community_message_questions(message_id)
    );

    -- The old community_learning_achievements table contains unverified claims.
    CREATE TABLE IF NOT EXISTS community_verified_achievements (
      user_id INTEGER NOT NULL REFERENCES community_users(id) ON DELETE CASCADE,
      achievement_id TEXT NOT NULL CHECK (achievement_id IN ('studySet', 'reel', 'streak')),
      PRIMARY KEY (user_id, achievement_id)
    );
    CREATE TABLE IF NOT EXISTS community_verified_learning_days (
      user_id INTEGER NOT NULL REFERENCES community_users(id) ON DELETE CASCADE,
      day INTEGER NOT NULL,
      PRIMARY KEY (user_id, day)
    );

    CREATE TABLE IF NOT EXISTS community_message_reports (
      id INTEGER PRIMARY KEY,
      reporter_id INTEGER NOT NULL REFERENCES community_users(id),
      message_id INTEGER NOT NULL REFERENCES community_messages(id),
      reason TEXT NOT NULL CHECK (reason IN ('bullying', 'personal-info', 'spam', 'other')),
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      UNIQUE (message_id, reporter_id)
    );
  `);

  const visibleMessage = alias => `${alias}.state = 'visible' AND NOT EXISTS (
    SELECT 1 FROM community_message_reports WHERE message_id = ${alias}.id AND reporter_id = $viewer
  )`;
  const messageSelection = `SELECT m.id, m.body, u.username AS author, m.created_at AS createdAt, m.author_id = $viewer AS canRemove,
      CASE WHEN own_question.message_id IS NOT NULL THEN 'question' WHEN a.message_id IS NOT NULL THEN 'answer' ELSE 'chat' END AS kind,
      parent.id AS questionId, parent.id IS NOT NULL AND q.helpful_answer_id = m.id AS helpful,
      parent.author_id = $viewer AND m.author_id <> $viewer AND q.helpful_answer_id IS NULL AS canMarkHelpful
    FROM community_messages m JOIN community_users u ON u.id = m.author_id
    LEFT JOIN community_message_questions own_question ON own_question.message_id = m.id
    LEFT JOIN community_message_answers a ON a.message_id = m.id
    LEFT JOIN community_message_questions q ON q.message_id = a.question_id
    LEFT JOIN community_messages parent ON parent.id = q.message_id AND ${visibleMessage("parent")}
    WHERE m.room_id = $roomId AND ${visibleMessage("m")}`;
  const readRecent = db.prepare(`${messageSelection} AND ($cursor IS NULL OR m.id < $cursor) ORDER BY m.id DESC LIMIT ${messageLimit + 1}`);
  const readNewer = db.prepare(`${messageSelection} AND m.id > $cursor ORDER BY m.id LIMIT ${messageLimit + 1}`);
  const insertMessage = db.prepare("INSERT INTO community_messages (room_id, author_id, body, created_at) VALUES (?, ?, ?, ?)");
  const insertQuestion = db.prepare("INSERT INTO community_message_questions (message_id) VALUES (?)");
  const insertAnswer = db.prepare("INSERT INTO community_message_answers (message_id, question_id) VALUES (?, ?)");
  const readQuestion = db.prepare(`
    SELECT 1 FROM community_message_questions q JOIN community_messages m ON m.id = q.message_id
    WHERE m.id = $questionId AND m.room_id = $roomId AND ${visibleMessage("m")}
  `);
  const readHelpfulCandidate = db.prepare(`
    SELECT m.author_id AS answerAuthorId, parent.author_id AS questionAuthorId,
      parent.id AS questionId, q.helpful_answer_id AS helpfulAnswerId
    FROM community_message_answers a JOIN community_messages m ON m.id = a.message_id
    JOIN community_message_questions q ON q.message_id = a.question_id
    JOIN community_messages parent ON parent.id = q.message_id
    WHERE m.id = $id AND ${visibleMessage("m")} AND ${visibleMessage("parent")}
  `);
  const setHelpfulAnswer = db.prepare("UPDATE community_message_questions SET helpful_answer_id = ? WHERE message_id = ?");
  // Keep the original selection so restored content regains its point without awarding it twice.
  const activeHelpfulAnswers = `
    FROM community_message_questions q
    JOIN community_messages question ON question.id = q.message_id
    JOIN community_messages answer ON answer.id = q.helpful_answer_id
    WHERE answer.state = 'visible' AND question.state = 'visible'
  `;
  const activeReelLikes = `
    FROM community_reel_likes likes
    JOIN community_reels reel ON reel.id = likes.post_id
    WHERE reel.removed_at IS NULL
  `;
  const readRewards = db.prepare(`
    SELECT (SELECT COUNT(*) ${activeHelpfulAnswers} AND answer.author_id = $userId) AS helpfulAnswers,
      (SELECT COUNT(*) FROM community_verified_achievements WHERE user_id = $userId) AS achievementPoints,
      (SELECT COUNT(*) ${activeReelLikes} AND reel.creator_id = $userId) AS reelLikes
  `);
  const insertAchievement = db.prepare(`
    INSERT INTO community_verified_achievements (user_id, achievement_id) VALUES (?, ?)
    ON CONFLICT (user_id, achievement_id) DO NOTHING
  `);
  const hasStreak = db.prepare("SELECT 1 FROM community_verified_achievements WHERE user_id = ? AND achievement_id = 'streak'");
  const pruneLearningDays = db.prepare("DELETE FROM community_verified_learning_days WHERE user_id = ? AND day < ?");
  const addLearningDay = db.prepare("INSERT INTO community_verified_learning_days VALUES (?, ?) ON CONFLICT DO NOTHING");
  const countLearningDays = db.prepare("SELECT COUNT(*) AS days FROM community_verified_learning_days WHERE user_id = ? AND day BETWEEN ? AND ?");
  const clearLearningDays = db.prepare("DELETE FROM community_verified_learning_days WHERE user_id = ?");
  const readLeaderboard = db.prepare(`
    WITH pointSources AS (
      SELECT answer.author_id AS userId, COUNT(*) AS points
      ${activeHelpfulAnswers}
      GROUP BY answer.author_id
      UNION ALL
      SELECT user_id AS userId, COUNT(*) AS points
      FROM community_verified_achievements
      GROUP BY user_id
      UNION ALL
      SELECT reel.creator_id AS userId, COUNT(*) AS points
      ${activeReelLikes}
      GROUP BY reel.creator_id
    ), totals AS (
      SELECT userId, SUM(points) AS points
      FROM pointSources
      GROUP BY userId
    )
    SELECT RANK() OVER (ORDER BY totals.points DESC) AS rank, users.username, totals.points
    FROM totals JOIN community_users users ON users.id = totals.userId
    ORDER BY totals.points DESC, users.username COLLATE NOCASE, users.id
    LIMIT 10
  `);
  const removeMessageRow = db.prepare("UPDATE community_messages SET state = 'removed', body = '' WHERE id = ? AND author_id = ? AND state <> 'removed'");
  const readReportTarget = db.prepare(`SELECT m.author_id AS authorId FROM community_messages m WHERE m.id = $id AND ${visibleMessage("m")}`);
  const alreadyReported = db.prepare("SELECT 1 FROM community_message_reports WHERE message_id = ? AND reporter_id = ?");
  const countReports = db.prepare("SELECT COUNT(*) AS total FROM community_message_reports WHERE message_id = ? AND resolved_at IS NULL");
  const insertReport = db.prepare("INSERT INTO community_message_reports (reporter_id, message_id, reason, created_at) VALUES (?, ?, ?, ?)");
  const setMessageState = db.prepare("UPDATE community_messages SET state = ? WHERE id = ? AND state <> 'removed'");
  const resolveReports = db.prepare("UPDATE community_message_reports SET resolved_at = ? WHERE message_id = ? AND resolved_at IS NULL");
  const readReports = db.prepare(`
    SELECT r.id, r.reason, r.created_at AS createdAt, reporter.username AS reporter,
      'message' AS targetType, m.id AS targetId, author.username AS author, m.room_id AS roomId, m.body, m.state
    FROM community_message_reports r JOIN community_messages m ON m.id = r.message_id
    JOIN community_users reporter ON reporter.id = r.reporter_id JOIN community_users author ON author.id = m.author_id
    WHERE r.resolved_at IS NULL ORDER BY (m.state = 'queued') DESC, r.id LIMIT 100
  `);

  const listActive = db.prepare(`
    SELECT s.id, s.title, s.duration, s.started_at AS startedAt, s.ends_at AS endsAt,
      (SELECT COUNT(*) FROM community_library_members WHERE session_id = s.id AND seen_at >= $cutoff) AS activeCount
    FROM community_library_sessions s WHERE s.ends_at > $date ORDER BY s.started_at DESC, s.id DESC
  `);
  const readSession = db.prepare("SELECT id, title, duration, started_at AS startedAt, ends_at AS endsAt FROM community_library_sessions WHERE id = ?");
  const insertSession = db.prepare("INSERT INTO community_library_sessions (title, creator_id, duration, started_at, ends_at) VALUES (?, ?, ?, ?, ?)");
  const upsertPresence = db.prepare(`
    INSERT INTO community_library_members (session_id, user_id, seen_at) VALUES (?, ?, ?)
    ON CONFLICT(session_id, user_id) DO UPDATE SET seen_at = excluded.seen_at
  `);
  const removePresence = db.prepare("DELETE FROM community_library_members WHERE session_id = ? AND user_id = ?");
  const readActiveMembers = db.prepare(`
    SELECT u.id, u.username FROM community_library_members m JOIN community_users u ON u.id = m.user_id
    WHERE m.session_id = ? AND m.seen_at >= ? ORDER BY u.username COLLATE NOCASE
  `);
  const isPresent = db.prepare("SELECT 1 FROM community_library_members WHERE session_id = ? AND user_id = ? AND seen_at >= ?");

  function inTransaction(action) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = action();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  function timestamps(clock = now()) {
    return { date: new Date(clock).toISOString(), cutoff: new Date(clock - presenceWindow).toISOString() };
  }

  function requireSession(id) {
    const session = readSession.get(id);
    if (!session) throw problem(404, "Library session not found.");
    return session;
  }

  function requireOpenSession(id, date) {
    const session = requireSession(id);
    if (session.endsAt <= date) throw problem(409, "This library session has ended.");
    return session;
  }

  function sessionWithPresence(session, userId, { date, cutoff }) {
    const members = session.endsAt > date ? readActiveMembers.all(session.id, cutoff) : [];
    return {
      ...session,
      activeCount: members.length,
      participants: members.map(({ username }) => ({ username })),
      joined: members.some(member => member.id === userId),
    };
  }

  function listMessages(roomId, userId, after, before) {
    const sessionId = libraryIdFor(roomId);
    if (sessionId !== null) requireSessionMembership(sessionId, userId, "reading the chat");
    const start = after == null || after === 0 || after === "0" ? null : requireId(after);
    const end = before == null ? null : requireId(before);
    if (start !== null && end !== null) throw problem(400, "Use one message cursor at a time.");
    const viewer = userId;
    const rows = start !== null
      ? readNewer.all({ roomId, viewer, cursor: start })
      : readRecent.all({ roomId, viewer, cursor: end });
    const overflow = rows.length > messageLimit;
    const page = rows.slice(0, messageLimit);
    if (start === null) page.reverse();
    const messages = page.map(row => ({
      ...row,
      canRemove: Boolean(row.canRemove),
      helpful: Boolean(row.helpful),
      canMarkHelpful: Boolean(row.canMarkHelpful),
    }));
    return start !== null ? { messages, hasMore: overflow } : { messages, hasOlder: overflow };
  }

  function postMessage(roomId, input, user) {
    const sessionId = libraryIdFor(roomId);
    const body = requireText(input?.body, "a message", 1200);
    const kind = input.kind === undefined ? "chat" : input.kind;
    if (!["chat", "question", "answer"].includes(kind)) throw problem(400, "Choose a valid message type.");
    if (sessionId !== null && kind !== "chat") throw problem(400, "Questions and answers are available in group chats.");
    const questionId = kind === "answer" ? requireId(input.questionId) : null;
    return inTransaction(() => {
      const { date, cutoff } = timestamps();
      if (sessionId !== null) {
        requireOpenSession(sessionId, date);
        if (!isPresent.get(sessionId, user.id, cutoff)) throw problem(409, "Join the library session before you chat.");
      }
      if (questionId !== null && !readQuestion.get({ questionId, roomId, viewer: user.id })) {
        throw problem(404, "Question not found in this room.");
      }
      const id = insertMessage.run(roomId, user.id, body, date).lastInsertRowid;
      if (kind === "question") insertQuestion.run(id);
      if (kind === "answer") insertAnswer.run(id, questionId);
      return { id };
    });
  }

  function markHelpful(value, user) {
    const id = requireId(value);
    return inTransaction(() => {
      const answer = readHelpfulCandidate.get({ id, viewer: user.id });
      if (!answer) throw problem(404, "Answer not found.");
      if (answer.questionAuthorId !== user.id) throw problem(403, "Only the person who asked can mark an answer helpful.");
      if (answer.answerAuthorId === user.id) throw problem(403, "You can't earn a point for answering your own question.");
      if (answer.helpfulAnswerId !== null && answer.helpfulAnswerId !== id) {
        throw problem(409, "A helpful answer has already been chosen for this question.");
      }
      if (answer.helpfulAnswerId === null) setHelpfulAnswer.run(id, answer.questionId);
      return { awarded: true };
    });
  }

  function getRewards(userId) {
    return { ...readRewards.get({ userId }) };
  }

  function recordVerifiedLearning(userId, activity) {
    inTransaction(() => {
      insertAchievement.run(userId, activity);
      if (hasStreak.get(userId)) return;
      const day = Math.floor(now() / dayMs);
      pruneLearningDays.run(userId, day - 2);
      addLearningDay.run(userId, day);
      if (countLearningDays.get(userId, day - 2, day).days === 3) {
        insertAchievement.run(userId, "streak");
        clearLearningDays.run(userId);
      }
    });
  }

  function startSession(input, user) {
    const title = requireText(input?.title, "a title", 80).replace(/\s+/g, " ");
    if (![25, 50].includes(input.duration)) throw problem(400, "Choose a 25- or 50-minute session.");
    return inTransaction(() => {
      const clock = now();
      const { date } = timestamps(clock);
      const endsAt = new Date(clock + input.duration * 60_000).toISOString();
      const id = insertSession.run(title, user.id, input.duration, date, endsAt).lastInsertRowid;
      upsertPresence.run(id, user.id, date);
      return { id };
    });
  }

  function joinSession(value, user) {
    const id = requireId(value);
    return inTransaction(() => {
      const times = timestamps();
      const session = requireOpenSession(id, times.date);
      upsertPresence.run(id, user.id, times.date);
      return sessionWithPresence(session, user.id, times);
    });
  }

  function getSession(value, userId) {
    return sessionWithPresence(requireSession(requireId(value)), userId, timestamps());
  }

  function requireSessionMembership(id, userId, activity = "using voice") {
    const { date, cutoff } = timestamps();
    const session = requireOpenSession(id, date);
    if (!isPresent.get(id, userId, cutoff)) throw problem(409, `Join the Library session before ${activity}.`);
    return session;
  }

  function leaveSession(value, user) {
    const id = requireId(value);
    removePresence.run(id, user.id);
    return { left: true };
  }

  function report(input, user) {
    if (!reasons.has(input?.reason)) throw problem(400, "Choose a valid report reason.");
    const id = requireId(input.targetId);
    return inTransaction(() => {
      if (alreadyReported.get(id, user.id)) return { reported: true };
      const item = readReportTarget.get({ id, viewer: user.id });
      if (!item) throw problem(404, "Message not found.");
      if (item.authorId === user.id) throw problem(400, "You can remove your own message.");
      insertReport.run(user.id, id, input.reason, timestamps().date);
      if (countReports.get(id).total >= 2) setMessageState.run("queued", id);
      return { reported: true };
    });
  }

  function removeMessage(value, user) {
    const id = requireId(value);
    return inTransaction(() => {
      if (!removeMessageRow.run(id, user.id).changes) throw problem(404, "Message not found.");
      resolveReports.run(timestamps().date, id);
      return { removed: true };
    });
  }

  function moderate(input) {
    if (!["hide", "restore"].includes(input?.action)) throw problem(400, "Choose a valid moderation action.");
    const id = requireId(input.targetId);
    const state = input.action === "hide" ? "hidden" : "visible";
    return inTransaction(() => {
      if (!setMessageState.run(state, id).changes) throw problem(404, "Message not found.");
      resolveReports.run(timestamps().date, id);
      return { id, state };
    });
  }

  return {
    listRooms: () => rooms.map(room => ({ ...room })),
    listMessages, postMessage, markHelpful, removeMessage, report, moderate,
    getRewards, recordVerifiedLearning,
    getLeaderboard: () => ({ leaders: readLeaderboard.all().map(row => ({ ...row })) }),
    listReports: () => readReports.all().map(row => ({ ...row })),
    listSessions: () => ({ sessions: listActive.all(timestamps()).map(row => ({ ...row })) }),
    startSession, joinSession, getSession, leaveSession, requireSessionMembership,
  };
}

module.exports = { createCommunityRooms, requireText };
