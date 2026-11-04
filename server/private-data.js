const megabyte = 1024 * 1024;
const privateDataInputBytes = 7 * megabyte;
const maxAccountBytes = 6 * megabyte;
const arrayKeys = new Set(["sg_topics", "sg_scores", "sg_diary", "sg_lessons_done", "sg_lesson_activity"]);
const recordKeys = new Set(["sg_student", "sg_explore_v1", "sg_growth_v1", "sg_pursuit_v1", "sg_lily_checkin"]);
const achievementKeys = new Set(["studySet", "lesson", "quiz", "reflection", "streak"].map(id => `sg_achievement:${id}`));

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function textField(value, max) {
  return typeof value === "string" && value.length <= max && value.trim() && value.isWellFormed() && !/[\p{Cc}\p{Cs}]/u.test(value);
}

function validPassport(profile) {
  return textField(profile.name, 40) && textField(profile.school, 40) && textField(profile.year, 20) &&
    ["Science", "Commerce", "Humanities", "Engineering", "Medicine", "Law", "Design", "Computer Science", "Other"].includes(profile.stream) &&
    textField(profile.avatar, 48) && /^SG-\d{4}-\d{4}$/.test(profile.studentId) && textField(profile.joinedDate, 60) &&
    (!Object.hasOwn(profile, "portrait") || (typeof profile.portrait === "string" && profile.portrait.length <= 512 * 1024 &&
      /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(profile.portrait)));
}

function validValue(key, raw) {
  if (key === "sg_diary_pet_v1") return raw === null || ["hello-kitty", "spider-man", "batman"].includes(raw);
  if (achievementKeys.has(key)) return raw === null || raw === "1";
  if (!arrayKeys.has(key) && !recordKeys.has(key)) return false;
  if (raw === null) return true;
  if (typeof raw !== "string" || Buffer.byteLength(raw) > 4 * megabyte) return false;
  let value;
  try { value = JSON.parse(raw); } catch { return false; }
  if (key === "sg_student") return isRecord(value) && validPassport(value);
  return arrayKeys.has(key) ? Array.isArray(value) : isRecord(value);
}

function createPrivateData(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS studygram_private_state (
    user_id INTEGER NOT NULL REFERENCES community_users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT,
    version INTEGER NOT NULL,
    PRIMARY KEY (user_id, key)
  ) STRICT`);
  const select = db.prepare("SELECT key, version, value FROM studygram_private_state WHERE user_id = ?");
  const inventory = db.prepare("SELECT key, version, coalesce(length(CAST(value AS BLOB)), 0) AS bytes FROM studygram_private_state WHERE user_id = ?");
  const save = db.prepare(`INSERT INTO studygram_private_state (user_id, key, value, version) VALUES (?, ?, ?, ?)
    ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value, version = excluded.version`);

  return {
    read(userId) {
      return Object.fromEntries(select.all(userId).map(({ key, version, value }) => [key, { version, value }]));
    },
    write(userId, input) {
      if (!isRecord(input) || !Number.isSafeInteger(input.accountId) || !isRecord(input.changes)) {
        fail(400, "Choose valid changes to save.");
      }
      if (input.accountId !== userId) fail(409, "Your Studygram account changed. Sign in again and retry.");
      const changes = Object.entries(input.changes);
      if (!changes.length || changes.length > 16 || changes.some(([key, change]) => !isRecord(change) ||
          !Number.isSafeInteger(change.version) || change.version < 0 || !validValue(key, change.value))) {
        fail(400, "Some of this Studygram data could not be saved. Check the fields and try again.");
      }

      db.exec("BEGIN IMMEDIATE");
      try {
        const current = new Map(inventory.all(userId).map(row => [row.key, row]));
        let bytes = Array.from(current.values()).reduce((total, row) => total + row.bytes, 0);
        const versions = {};
        for (const [key, change] of changes) {
          const version = current.get(key)?.version ?? 0;
          if (change.version !== version) fail(409, "This data changed in another tab. Refresh before saving again.");
          const next = version + 1;
          bytes += Buffer.byteLength(change.value ?? "") - (current.get(key)?.bytes ?? 0);
          versions[key] = next;
          save.run(userId, key, change.value, next);
        }
        if (bytes > maxAccountBytes) fail(413, "Your private storage is full. Remove some saved study sets and try again.");
        db.exec("COMMIT");
        return versions;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

module.exports = { createPrivateData, privateDataInputBytes };
